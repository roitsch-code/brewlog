/**
 * BLE transport seam for the ported AcaiaScale.
 *
 * Beanconqueror talks to the Cordova BLE plugin (`window.ble.*`) directly. We
 * inject a transport instead, so `acaia.ts` carries ZERO `@capacitor/*` import
 * — the BLE plugin is loaded only at runtime, inside the native shell, by
 * `manager.ts` (which builds a transport around `@capacitor-community/bluetooth-le`).
 * That keeps the live Safari PWA bundle free of the BLE plugin and makes the
 * protocol code unit-testable with a fake transport.
 */

export type AcaiaPlatform = "ios" | "android" | "web";

export interface AcaiaTransport {
  /** The host platform, so the scale can pick its connection-mode branch. */
  platform: AcaiaPlatform;
  /** Write a command to a characteristic (Acaia commands use writeWithoutResponse). */
  write(
    service: string,
    characteristic: string,
    data: ArrayBuffer,
    withoutResponse: boolean,
  ): Promise<void>;
  /** Subscribe to a characteristic; the callback receives each notification's bytes. */
  startNotifications(
    service: string,
    characteristic: string,
    callback: (value: ArrayBuffer) => void,
  ): Promise<void>;
}
