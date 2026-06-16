/**
 * Acaia connection manager — the scan / connect / discover / lifecycle shell
 * around the ported AcaiaScale protocol. This is the ONLY module that touches
 * @capacitor-community/bluetooth-le, and it does so via a runtime dynamic
 * import so the BLE plugin never enters the live Safari PWA bundle's main chunk
 * and never loads off the native shell.
 *
 * Capability gate: everything no-ops unless we're inside the Capacitor shell
 * (`Capacitor.isNativePlatform()`). On the PWA / desktop / CI, `acaiaCapable()`
 * is false and nothing here runs.
 *
 * Device matching mirrors Beanconqueror's `LunarScale.test` exactly — a scan
 * result is an Acaia iff the first 5 chars of its advertised name are one of
 * ACAIA / LUNAR / PYXIS / PROCH / PEARL / CINCO (PROCH = old Pearls advertising
 * as "PROCHBT001"). Old-protocol scales expose the single weight characteristic
 * `00002a80-…`; AcaiaScale.findBLEUUIDs handles both old and Pyxis layouts.
 */
import { AcaiaScale, EventType } from "./acaia";
import type { Characteristic } from "./common";
import { PYXIS_SERVICE_UUID, SCALE_SERVICE_UUID } from "./constants";
import type { AcaiaPlatform, AcaiaTransport } from "./transport";

const NAME_PREFIXES = ["ACAIA", "LUNAR", "PYXIS", "PROCH", "PEARL", "CINCO"];
const SCAN_TIMEOUT_MS = 20000;

export type AcaiaStatus =
  | "unsupported"
  | "scanning"
  | "connecting"
  | "connected"
  | "disconnected"
  | "not-found"
  | "error";

export interface AcaiaHandlers {
  /** Live weight in grams (can be negative). */
  onWeight?: (grams: number) => void;
  /** Connection-lifecycle updates. */
  onStatus?: (status: AcaiaStatus) => void;
  /** Hardware button events on the scale (tare / timer start/stop/reset). */
  onButton?: (event: EventType, data?: number) => void;
}

export interface AcaiaHandle {
  deviceId: string;
  tare(): void;
  startTimer(): void;
  stopTimer(): void;
  resetTimer(): void;
  disconnect(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the native shell, where the BLE plugin can exist. */
export function acaiaCapable(): boolean {
  try {
    return !!cap()?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function platform(): AcaiaPlatform {
  const p = cap()?.getPlatform?.() ?? "web";
  return p === "ios" || p === "android" ? p : "web";
}

function nameMatches(name: string | undefined): boolean {
  if (!name) return false;
  return NAME_PREFIXES.includes(name.slice(0, 5).toUpperCase());
}

// One connection at a time (single-user app, one scale).
let active: { scale: AcaiaScale; deviceId: string } | null = null;

/**
 * Scan for an Acaia, connect, and start streaming weight. Resolves with a
 * handle once the scale is subscribed and its heartbeat is running; rejects on
 * timeout / no device / BLE failure. Safe to call only when `acaiaCapable()`.
 */
export async function connectAcaia(handlers: AcaiaHandlers): Promise<AcaiaHandle> {
  const status = (s: AcaiaStatus) => handlers.onStatus?.(s);

  if (!acaiaCapable()) {
    status("unsupported");
    throw new Error("Acaia BLE is only available in the native app");
  }

  // Tear down any prior connection first.
  await disconnectAcaia();

  // Loaded at runtime, in the shell only — never bundled into the PWA's main chunk.
  const { BleClient } = await import("@capacitor-community/bluetooth-le");

  await BleClient.initialize();

  status("scanning");
  const deviceId = await scanForAcaia(BleClient);
  if (!deviceId) {
    status("not-found");
    throw new Error("No Acaia scale found nearby");
  }

  status("connecting");
  await BleClient.connect(deviceId, () => {
    // onDisconnect (cable pulled / scale powered off).
    if (active?.deviceId === deviceId) {
      active.scale.disconnectTriggered();
      active = null;
    }
    status("disconnected");
  });

  const characteristics = await discoverCharacteristics(BleClient, deviceId);

  const transport: AcaiaTransport = {
    platform: platform(),
    async write(service, characteristic, data, withoutResponse) {
      const dv = new DataView(data);
      if (withoutResponse) {
        await BleClient.writeWithoutResponse(deviceId, service, characteristic, dv);
      } else {
        await BleClient.write(deviceId, service, characteristic, dv);
      }
    },
    async startNotifications(service, characteristic, callback) {
      await BleClient.startNotifications(deviceId, service, characteristic, (value: DataView) => {
        // DataView from BLE is always ArrayBuffer-backed; copy out the exact view.
        const copy = value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength,
        ) as ArrayBuffer;
        callback(copy);
      });
    },
  };

  const scale = new AcaiaScale(deviceId, characteristics, transport);
  active = { scale, deviceId };

  await scale.connect((event: EventType, data?: number) => {
    if (event === EventType.WEIGHT && typeof data === "number") {
      handlers.onWeight?.(data);
    }
    handlers.onButton?.(event, data);
  });

  status("connected");

  return {
    deviceId,
    tare: () => scale.tare(),
    startTimer: () => scale.startTimer(),
    stopTimer: () => scale.stopTimer(),
    resetTimer: () => scale.resetTimer(),
    disconnect: () => disconnectAcaia(),
  };
}

/** Disconnect the active scale (if any). Safe to call any time. */
export async function disconnectAcaia(): Promise<void> {
  if (!active) return;
  const { scale, deviceId } = active;
  active = null;
  try {
    await scale.disconnect();
  } catch {
    /* ignore */
  }
  try {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    await BleClient.disconnect(deviceId);
  } catch {
    /* already gone */
  }
}

type BleClientLike = typeof import("@capacitor-community/bluetooth-le")["BleClient"];

async function scanForAcaia(BleClient: BleClientLike): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (id: string | null) => {
      if (settled) return;
      settled = true;
      BleClient.stopLEScan().catch(() => {});
      clearTimeout(timer);
      resolve(id);
    };
    const timer = setTimeout(() => finish(null), SCAN_TIMEOUT_MS);

    BleClient.requestLEScan(
      // Scan broadly (the scale doesn't always advertise its service); match by
      // name in the callback. optionalServices lets iOS read the service post-connect.
      { allowDuplicates: false, optionalServices: [SCALE_SERVICE_UUID, PYXIS_SERVICE_UUID] },
      (result) => {
        if (nameMatches(result.device.name) || nameMatches(result.localName)) {
          finish(result.device.deviceId);
        }
      },
    ).catch(() => finish(null));
  });
}

async function discoverCharacteristics(
  BleClient: BleClientLike,
  deviceId: string,
): Promise<Characteristic[]> {
  const services = await BleClient.getServices(deviceId);
  const out: Characteristic[] = [];
  for (const service of services) {
    for (const characteristic of service.characteristics) {
      out.push({ service: service.uuid, characteristic: characteristic.uuid });
    }
  }
  return out;
}
