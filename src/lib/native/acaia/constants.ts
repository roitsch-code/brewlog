/**
 * Acaia scale BLE constants — ported VERBATIM from Beanconqueror (MIT),
 * src/classes/devices/acaia/constants.ts. Do not "tidy" these values; they are
 * the reverse-engineered protocol. See src/lib/native/acaia/README.md.
 */

// Old-protocol scales (the owner's Lunar 2017 + original Pearl).
export const SCALE_SERVICE_UUID = "00001820-0000-1000-8000-00805f9b34fb";
export const SCALE_CHARACTERISTIC_UUID = "00002a80-0000-1000-8000-00805f9b34fb";

// New-protocol (Pyxis / Lunar 2021 / Pearl S) — handled for free via
// characteristic-based detection in findBLEUUIDs().
export const PYXIS_SERVICE_UUID = "49535343-FE7D-4AE5-8FA9-9FAFD205E455";
export const PYXIS_TX_CHARACTERISTIC_UUID = "49535343-8841-43F4-A8D4-ECBE34729BB3";
export const PYXIS_RX_CHARACTERISTIC_UUID = "49535343-1E4D-4BD9-BA61-23C647249616";

export const MAGIC1 = 0xef;
export const MAGIC2 = 0xdd;
