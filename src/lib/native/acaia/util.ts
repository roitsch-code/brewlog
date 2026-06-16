/**
 * UUID + timing helpers — ported VERBATIM from Beanconqueror (MIT),
 * src/classes/devices/common/util.ts. `to128bitUUID` normalises any of the
 * three UUID forms to the canonical uppercase 128-bit string so a scale's
 * 16-bit characteristic compares equal to our full-length constant.
 */

export function to128bitUUID(uuid: string): string {
  switch (uuid.length) {
    case 4:
      return `0000${uuid.toUpperCase()}-0000-1000-8000-00805F9B34FB`;
    case 8:
      return `${uuid.toUpperCase()}-0000-1000-8000-00805F9B34FB`;
    case 36:
      return uuid.toUpperCase();
    default:
      throw new Error("invalid uuid: " + uuid);
  }
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
