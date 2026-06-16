/**
 * Minimal logger replacing Beanconqueror's `../common/logger` so the ported
 * decoder/scale keep their `this.log.log(...)` call sites unchanged. Silent by
 * default — flip ACAIA_DEBUG to surface protocol traffic during an on-device
 * spike. (Beanconqueror's Logger is an Angular service we don't want to pull
 * in; the protocol logic never depends on logging.)
 */

export const ACAIA_DEBUG = false;

export class Logger {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_name?: string) {}

  private emit(args: unknown[]): void {
    if (!ACAIA_DEBUG) return;
    try {
      // eslint-disable-next-line no-console
      console.log("ACAIA:", ...args);
    } catch {
      /* ignore */
    }
  }

  log(...args: unknown[]): void {
    this.emit(args);
  }
  debug(...args: unknown[]): void {
    this.emit(args);
  }
  info(...args: unknown[]): void {
    this.emit(args);
  }
  error(...args: unknown[]): void {
    this.emit(args);
  }
}
