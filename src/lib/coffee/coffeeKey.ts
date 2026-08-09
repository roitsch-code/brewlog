/**
 * The `coffees` primary key — derived, not random.
 *
 * A coffee's id is a slug of its roaster and name, so the same bag always
 * lands on the same row no matter which path created it. This is what makes
 * the merge in POST /api/sessions work: a coffee added from the chat and then
 * scanned + brewed weeks later resolves to the same key, so the brew
 * accumulates onto the existing row instead of forking a second one.
 *
 * BOTH write paths MUST use this function. It was previously inlined in
 * src/app/api/sessions/route.ts, which was fine while sessions were the only
 * way to create a coffee; the moment a second creator exists (POST
 * /api/coffees), a drifted copy of this expression silently means duplicate
 * bags in the library.
 *
 * The exact expression is also mirrored in SQL by migration 0023's backfill
 * (`regexp_replace(lower(...), '[^a-z0-9]', '_', 'g')`), verified byte-for-byte
 * against this one including umlauts and ß.
 */
export function coffeeKeyFor(roaster: string, name: string): string {
  return `${roaster}__${name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
