/**
 * The CoffeeIdentity a brew starts from, read off the library row — the one
 * shape the Action Pill's "Brew again", the chat's "Brew" and the "Try the
 * one you skipped" pill all hydrate the flow store with. Null when the row
 * cannot be read (offline, unknown id); the caller decides the fallback.
 */
import type { FieldZones } from "@/lib/field/types";
import type { BlendComponent, CoffeeIdentity } from "@/lib/types/session";

export interface CoffeeRowLite {
  id: string;
  roaster: string;
  name: string;
  origin: string;
  process: string;
  components?: BlendComponent[] | null;
  latestRoastDate?: string;
  bagPhotoUrl?: string;
  variety?: string | null;
  region?: string | null;
  roastLevel?: string | null;
  fieldZones?: FieldZones | null;
}

export function identityFromRow(row: CoffeeRowLite): CoffeeIdentity {
  return {
    roaster: row.roaster,
    name: row.name,
    origin: row.origin,
    process: row.process,
    components: row.components ?? undefined,
    roastLevel: row.roastLevel || "Light",
    roastDate: row.latestRoastDate,
    bagPhotoUrl: row.bagPhotoUrl,
    ...(row.variety ? { variety: row.variety } : {}),
    ...(row.region ? { region: row.region } : {}),
    aiExtracted: false,
    coffeeId: row.id,
  };
}

export async function fetchCoffeeIdentity(
  coffeeId: string,
): Promise<{ identity: CoffeeIdentity; fieldZones: FieldZones | null } | null> {
  try {
    const res = await fetch(`/api/coffees/${encodeURIComponent(coffeeId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const row = (await res.json()) as CoffeeRowLite | null;
    if (!row || !row.id) return null;
    return { identity: identityFromRow(row), fieldZones: row.fieldZones ?? null };
  } catch {
    return null;
  }
}
