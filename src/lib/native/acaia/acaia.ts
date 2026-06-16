/**
 * AcaiaScale — ported from Beanconqueror (MIT), src/classes/devices/acaia/acaia.ts,
 * itself converted from pyacaia (lucapinello). The protocol logic (ident
 * handshake, 1 s heartbeat, command encoders + checksums, message routing) is
 * preserved. The only structural change is the TRANSPORT: Beanconqueror calls
 * the Cordova `window.ble.*` plugin directly; we inject an `AcaiaTransport`
 * (built around @capacitor-community/bluetooth-le in manager.ts) so this file
 * carries no `@capacitor/*` import and the protocol stays unit-testable.
 *
 * Other swaps: lodash `memoize` → a local one; Angular `Logger`/`UISettingsStorage`
 * → local logger + constant defaults; `Capacitor.getPlatform()` → the injected
 * `transport.platform`. Connection mode defaults to 'V2' (the iOS path for the
 * owner's old-protocol Lunar/Pearl). Do NOT change the encoder byte payloads.
 */
import { Logger } from "./logger";
import { sleep, to128bitUUID } from "./util";
import {
  Button,
  Characteristic,
  DecoderResultType,
  MessageType,
  ParsedMessage,
  ScaleMessageType,
  Units,
  WorkerResult,
} from "./common";
import {
  MAGIC1,
  MAGIC2,
  PYXIS_RX_CHARACTERISTIC_UUID,
  PYXIS_TX_CHARACTERISTIC_UUID,
  SCALE_CHARACTERISTIC_UUID,
} from "./constants";
import { Decoder } from "./decoder";
import type { AcaiaTransport } from "./transport";

export enum EventType {
  WEIGHT,
  TIMER_START,
  TIMER_STOP,
  TIMER_RESET,
  TARE,
  SETTINGS,
}

type EventCallback = (eventType: EventType, data?: number) => void;

// DecodeWorker receives array buffers from notifications and emits parsed messages.
class DecoderWorker {
  private readonly decodeCallback: (msgs: ParsedMessage[]) => void;
  private readonly logger: Logger;
  private readonly decoder: Decoder;

  constructor(callback: (msgs: ParsedMessage[]) => void) {
    this.decodeCallback = callback;
    this.logger = new Logger("ACAIA DecodeWorker container");
    this.logger.debug("Decoder is imported, initalizing...");
    this.decoder = new Decoder();
  }

  public addBuffer(buffer: ArrayBuffer): void {
    setTimeout(() => {
      const result = this.decoder.process(buffer);
      if (result) {
        setTimeout(() => {
          this.handleMessage(result);
        });
      }
    });
  }

  private handleMessage(data: WorkerResult): void {
    this.logger.debug("Decoder sent a message", data);
    switch (data.type) {
      case DecoderResultType.LOG:
        this.logger.debug(...data.data);
        break;
      case DecoderResultType.DECODE_RESULT:
        this.decodeCallback(data.data);
        break;
    }
  }
}

const HEARTBEAT_INTERVAL = 1000;
const CONNECTION_MODE: string = "V2";

export class AcaiaScale {
  private readonly device_id: string;
  private rx_char_uuid!: string;
  private tx_char_uuid!: string;
  private weight_uuid!: string;

  private isPyxisStyle: boolean;
  private readonly characteristics: Characteristic[];
  private readonly transport: AcaiaTransport;

  private worker!: DecoderWorker;
  private readonly logger: Logger;

  private connected: boolean;
  private last_heartbeat: number;

  private timer_start_time: number;
  private paused_time: number;
  private readonly transit_delay: number;
  private weight: number | null;
  private battery: number | null;
  private units: Units | null;
  private auto_off: boolean | null;
  private beep_on: boolean | null;
  private timer_running: boolean;

  private command_queue: ArrayBuffer[];
  private callback!: EventCallback;

  private heartbeat_monitor_interval: ReturnType<typeof setInterval> | null = null;

  private recievesNotifications = false;
  private encodeNotificationRequestSend = false;

  constructor(device_id: string, characteristics: Characteristic[], transport: AcaiaTransport) {
    this.device_id = device_id;
    this.transport = transport;
    this.connected = false;
    this.logger = new Logger();

    this.logger.info("received characteristics: ", JSON.stringify(characteristics));
    this.characteristics = characteristics;
    this.isPyxisStyle = false;

    if (!this.findBLEUUIDs()) {
      throw new Error("Cannot find weight service and characteristics on the scale");
    }

    this.command_queue = [];
    this.last_heartbeat = 0;
    this.timer_start_time = 0;
    this.paused_time = 0;
    this.transit_delay = 200;
    this.weight = 0;
    this.battery = 0;
    this.units = null;
    this.auto_off = null;
    this.beep_on = null;
    this.timer_running = false;
  }

  public getElapsedTime(): number {
    if (this.timer_running) {
      return Date.now() - this.timer_start_time + this.transit_delay;
    } else {
      return this.paused_time;
    }
  }

  public async connect(callback: EventCallback): Promise<void> {
    this.logger.log("Connect scale with mode " + CONNECTION_MODE);

    if (this.connected) {
      this.logger.log("Already connected, bail.");
      return;
    }

    this.callback = callback;

    this.worker = new DecoderWorker((_data: ParsedMessage[]) => {
      this.messageParseCallback(_data);
    });
    this.logger.log("Subscribing to notifications", {
      device_id: this.device_id,
      weight_uuid: this.weight_uuid,
      char_uuid: this.rx_char_uuid,
    });

    // Moved here from notificationsReady (matches Beanconqueror): mark connected
    // before subscribing so heartbeat/ident can fire.
    this.connected = true;

    this.transport
      .startNotifications(this.weight_uuid, this.rx_char_uuid, (value: ArrayBuffer) => {
        this.recievesNotifications = true;
        this.handleNotification(value);
      })
      .catch((err: unknown) => {
        this.logger.error("failed to subscribe to notifications " + JSON.stringify(err));
        this.disconnect().catch((e) => this.logger.error(e));
      });

    // This 150 ms sleep is load-bearing on iOS — without it the scale often
    // never sends weight afterwards (Beanconqueror's note, kept verbatim).
    await sleep(150);

    if (this.isV1Path()) {
      await this.write(new Uint8Array([0, 1]).buffer);
      await this.notificationsReady();
    } else {
      this.notificationsReady();
    }

    this.startHeartbeatMonitor();
  }

  public disconnectTriggered(): void {
    this.logger.debug("Scale disconnect triggered");
    this.connected = false;
    this.stopHeartbeatMonitor();
  }

  public async disconnect(): Promise<void> {
    this.logger.debug("Scale disconnected");
    this.stopHeartbeatMonitor();
    if (this.connected) {
      this.connected = false;
    }
  }

  public tare(): boolean {
    if (!this.connected) {
      return false;
    }
    this.logger.debug("taring...");
    this.command_queue.push(encodeTare());
    return true;
  }

  public startTimer(): boolean {
    if (!this.connected) {
      return false;
    }
    this.logger.debug("start timer...");
    this.command_queue.push(encodeStartTimer());
    this.timer_start_time = Date.now();
    this.timer_running = true;
    return true;
  }

  public stopTimer(): boolean {
    if (!this.connected) {
      return false;
    }
    this.logger.debug("stop timer...");
    this.command_queue.push(encodeStopTimer());
    this.paused_time = Date.now() - this.timer_start_time;
    this.timer_running = false;
    return true;
  }

  public resetTimer(): boolean {
    if (!this.connected) {
      return false;
    }
    this.logger.debug("reset timer...");
    this.command_queue.push(encodeResetTimer());
    this.paused_time = 0;
    this.timer_running = false;
    return true;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  /** iOS V2 is the default fast path; only Android or an explicit V1 setting awaits. */
  private isV1Path(): boolean {
    return (
      this.transport.platform === "android" ||
      (CONNECTION_MODE === "V1" && this.transport.platform === "ios")
    );
  }

  private findBLEUUIDs(): boolean {
    let foundRx = false;
    let foundTx = false;
    for (const char of this.characteristics) {
      if (to128bitUUID(char.characteristic) === to128bitUUID(SCALE_CHARACTERISTIC_UUID)) {
        this.rx_char_uuid = char.characteristic.toLowerCase();
        this.tx_char_uuid = char.characteristic.toLowerCase();
        this.weight_uuid = char.service.toLowerCase();
        this.isPyxisStyle = false;
        foundRx = true;
        foundTx = true;
      } else if (to128bitUUID(char.characteristic) === to128bitUUID(PYXIS_RX_CHARACTERISTIC_UUID)) {
        this.rx_char_uuid = char.characteristic.toLowerCase();
        foundRx = true;
      } else if (to128bitUUID(char.characteristic) === to128bitUUID(PYXIS_TX_CHARACTERISTIC_UUID)) {
        this.tx_char_uuid = char.characteristic.toLowerCase();
        this.weight_uuid = char.service.toLowerCase();
        this.isPyxisStyle = true;
        foundTx = true;
      }
      if (foundRx && foundTx) {
        return true;
      }
    }
    return false;
  }

  private handleNotification(value: ArrayBuffer): void {
    if (this.connected) {
      this.worker.addBuffer(value);
      this.heartbeat();
    }
  }

  private startHeartbeatMonitor(): void {
    this.heartbeat_monitor_interval = setInterval(async () => {
      if (Date.now() > this.last_heartbeat + HEARTBEAT_INTERVAL) {
        if (this.isV1Path()) {
          await this.initScales();
        } else {
          this.initScales();
        }
        this.logger.info("Sent heartbeat reviving request.");
      }
    }, HEARTBEAT_INTERVAL * 2);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeat_monitor_interval) {
      clearInterval(this.heartbeat_monitor_interval);
      this.heartbeat_monitor_interval = null;
    }
  }

  private messageParseCallback(messages: ParsedMessage[]): void {
    messages.forEach((msg) => {
      this.logger.debug("Message recieved - " + JSON.stringify(msg));
      if (msg.type === MessageType.SETTINGS) {
        this.battery = msg.battery;
        this.units = msg.units;
        this.auto_off = msg.autoOff;
        this.beep_on = msg.beepOn;
        this.callback(EventType.SETTINGS);
      } else if (msg.type === MessageType.MESSAGE) {
        if (msg.msgType === ScaleMessageType.WEIGHT) {
          this.weight = msg.weight;
          this.callback(EventType.WEIGHT, this.weight ?? undefined);
          this.logger.debug("weight: " + msg.weight + " " + Date.now());
        } else if (msg.msgType === ScaleMessageType.TARE_START_STOP_RESET) {
          if (msg.button === Button.UNKNOWN) {
            if (this.timer_running) {
              msg.button = Button.STOP;
            } else if (this.paused_time > 0) {
              msg.button = Button.RESET;
            }
          }
          switch (msg.button) {
            case Button.TARE:
              this.weight = 0;
              this.callback(EventType.TARE, 0);
              break;
            case Button.START:
              this.timer_start_time = Date.now() - this.paused_time + this.transit_delay;
              this.timer_running = true;
              this.callback(EventType.TIMER_START, this.timer_start_time);
              break;
            case Button.STOP:
              this.paused_time = msg.time;
              this.timer_running = false;
              this.callback(EventType.TIMER_STOP, this.paused_time);
              break;
            case Button.RESET:
              this.paused_time = 0;
              this.timer_running = false;
              this.callback(EventType.TIMER_RESET, 0);
              break;
          }
        }
      }
    });
  }

  private async initScales(): Promise<void> {
    if (this.isV1Path()) {
      await this.ident();
    } else {
      this.ident();
    }
    this.last_heartbeat = Date.now();
  }

  private async notificationsReady(): Promise<void> {
    if (this.isV1Path()) {
      await this.initScales();
    } else {
      this.initScales();
    }
    this.logger.info("Scale Ready!");
  }

  private async write(data: ArrayBuffer, withoutResponse = false): Promise<void> {
    if (!this.connected) {
      this.logger.debug("Skipped write — scale not connected", new Uint8Array(data));
      return;
    }
    try {
      await this.transport.write(this.weight_uuid, this.tx_char_uuid, data, withoutResponse);
    } catch (err) {
      // Sometimes a write reports an error but actually landed; ignore (matches
      // Beanconqueror, which resolves both success and error paths).
      this.logger.error("write failed (ignored)", err, withoutResponse);
    }
  }

  private async ident(): Promise<void> {
    if (this.isV1Path()) {
      return new Promise((resolve) => {
        this.write(encodeId(this.isPyxisStyle), true);
        setTimeout(() => {
          this.write(encodeNotificationRequest(), true);
          setTimeout(() => {
            resolve();
          }, 50);
        }, 100);
      });
    } else {
      if (this.recievesNotifications === false) {
        this.write(encodeId(this.isPyxisStyle), true);
      }
      if (this.recievesNotifications === true && this.encodeNotificationRequestSend === false) {
        this.encodeNotificationRequestSend = true;
        setTimeout(() => {
          this.write(encodeNotificationRequest(), true);
        }, 100);
      }
    }
  }

  private heartbeat(): boolean {
    if (!this.connected) {
      return false;
    }
    setTimeout(async () => {
      try {
        if (!this.connected) {
          return;
        }
        while (this.command_queue.length) {
          const packet = this.command_queue.shift();
          if (packet) {
            this.write(packet, true).catch((e) => this.logger.error(e));
          }
        }

        if (Date.now() >= this.last_heartbeat + HEARTBEAT_INTERVAL) {
          this.logger.debug("Sending heartbeat...");
          this.last_heartbeat = Date.now();
          if (this.isPyxisStyle) {
            this.write(encodeId(this.isPyxisStyle)).catch((e) => this.logger.error(e));
          }
          this.write(encodeHeartbeat(), false).catch((e) => this.logger.error(e));
          this.logger.debug("Heartbeat success");
        }
      } catch (e) {
        this.logger.error("Heartbeat failed " + JSON.stringify(e));
        try {
          await this.disconnect();
        } catch (e2) {
          this.logger.error(e2);
        }
      }
    }, 0);
    return true;
  }
}

// ── Command encoders (memoized; payloads are the reverse-engineered protocol) ──

function memoize<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const cache = new Map<unknown, R>();
  return (...args: A): R => {
    const key = args.length ? args[0] : "__noarg__";
    if (cache.has(key)) {
      return cache.get(key) as R;
    }
    const val = fn(...args);
    cache.set(key, val);
    return val;
  };
}

const encodeEventData = memoize((payload: number[]): ArrayBuffer => {
  const bytes = new Array(payload.length + 1);
  bytes[0] = payload.length + 1;
  for (let i = 0, _pj_a = payload.length; i < _pj_a; i += 1) {
    bytes[i + 1] = payload[i] & 0xff;
  }
  return encode(12, bytes);
});

const encodeNotificationRequest = memoize((): ArrayBuffer => {
  const payload = [
    0, // weight
    1, // weight argument
    1, // battery
    2, // battery argument
    2, // timer
    5, // timer argument (number heartbeats between timer messages)
    3, // key
    4, // setting
  ];
  return encodeEventData(payload);
});

const encodeId = memoize((isPyxisStyle = false): ArrayBuffer => {
  let payload: number[];
  if (isPyxisStyle) {
    payload = [
      0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34,
    ];
  } else {
    payload = [
      0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d,
    ];
  }
  return encode(11, payload);
});

const encodeHeartbeat = memoize((): ArrayBuffer => {
  const payload = [2, 0];
  return encode(0, payload);
});

const encodeTare = memoize((): ArrayBuffer => {
  const payload = [0];
  return encode(4, payload);
});

const encodeStartTimer = memoize((): ArrayBuffer => {
  const payload = [0, 0];
  return encode(13, payload);
});

const encodeStopTimer = memoize((): ArrayBuffer => {
  const payload = [0, 2];
  return encode(13, payload);
});

const encodeResetTimer = memoize((): ArrayBuffer => {
  const payload = [0, 1];
  return encode(13, payload);
});

export function encode(msgType: number, payload: number[]): ArrayBuffer {
  let cksum1 = 0;
  let cksum2 = 0;
  let val: number;
  const bytes = new Uint8Array(5 + payload.length);
  bytes[0] = MAGIC1;
  bytes[1] = MAGIC2;
  bytes[2] = msgType;
  for (let i = 0, _pj_a = payload.length; i < _pj_a; i += 1) {
    val = payload[i] & 0xff;
    bytes[3 + i] = val;
    if (i % 2 === 0) {
      cksum1 += val;
    } else {
      cksum2 += val;
    }
  }
  bytes[payload.length + 3] = cksum1 & 0xff;
  bytes[payload.length + 4] = cksum2 & 0xff;
  return bytes.buffer;
}
