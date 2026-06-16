/**
 * Acaia message types + parsed-message shapes — ported VERBATIM from
 * Beanconqueror (MIT), src/classes/devices/acaia/common.ts. The numeric enum
 * values ARE the protocol; do not renumber.
 */

export enum ScaleMessageType {
  WEIGHT = 5,
  HEARTBEAT = 11,
  TIMER = 7,
  TARE_START_STOP_RESET = 8,
}

export enum Button {
  TARE = "tare",
  START = "start",
  STOP = "stop",
  RESET = "reset",
  UNKNOWN = "unknown",
}

export enum Units {
  GRAMS = "grams",
  OUNCES = "ounces",
}

export enum MessageType {
  MESSAGE,
  SETTINGS,
}

export interface Message {
  type: MessageType.MESSAGE;
  msgType: ScaleMessageType | null;
  weight: number | null;
  time: number;
  button: Button | null;
}

export interface Settings {
  type: MessageType.SETTINGS;
  units: Units | null;
  battery: number | null;
  beepOn: boolean | null;
  autoOff: boolean | null;
}

export type ParsedMessage = Settings | Message;

export enum DecoderResultType {
  LOG,
  DECODE_RESULT,
  ENCODE_RESULT,
}

export interface DecoderResult {
  type: DecoderResultType.DECODE_RESULT;
  data: ParsedMessage[];
}

export interface DecoderLog {
  type: DecoderResultType.LOG;
  data: unknown[];
}

export type WorkerResult = DecoderLog | DecoderResult;

/** Characteristic descriptor (service + characteristic UUID pair). */
export interface Characteristic {
  service: string;
  characteristic: string;
}
