/**
 * Does a candidate's `basedOn` actually name something this turn offered?
 *
 * WHY THIS EXISTS: `/recommend` scores and rotates a small library of reference
 * recipes for each brew, but nothing checked whether the model USED it. It
 * could — and structurally did — reach past the rotated menu for whatever was
 * most salient, which is why the menu measurably varied while the candidates
 * did not. `resolveReference` (the fidelity guard) searches all ~135 corpus
 * recipes, so it can't tell the difference either.
 *
 * This is a MEASUREMENT and a soft signal, never an exclusion: the owner's
 * standing rule is that nothing is ever banned and best fit always decides. A
 * candidate that reaches outside the menu for a genuinely better fit is
 * legitimate — the prompt just asks it to say why. What we want is to know how
 * often it happens, because that number tells us whether menu rotation can
 * possibly help.
 */

/** Matching mirrors resolveReference: exact, or containment with a specificity
 * floor. The model writes short forms ("Kasuya 4:6") for corpus names like
 * "Kasuya 4:6 Method — Standard", and an exact-only compare silently never
 * matches — the bug that made an earlier demotion lever a no-op in production. */
const MIN_CONTAINMENT_LEN = 6;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matches(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= MIN_CONTAINMENT_LEN && y.includes(x)) return true;
  if (y.length >= MIN_CONTAINMENT_LEN && x.includes(y)) return true;
  return false;
}

/**
 * True when `basedOn` names a recipe from this turn's menu, one of the user's
 * own references, or is the explicit own-work sentinel.
 *
 * The sentinels count as in-menu on purpose: a self-designed experiment is a
 * legitimate, encouraged answer (it is the only honest alternative to
 * reconstructing a published recipe from memory), so it must not read as the
 * model ignoring what it was given.
 */
export function isInMenu(basedOn: string | undefined, menuNames: string[]): boolean {
  const b = norm(basedOn ?? "");
  if (!b) return true;
  if (b === "own recipe" || b === "own experiment") return true;
  // Own-reference entries are formatted "Your <method> — <coffee> (<date>)".
  if (b.startsWith("your ")) return true;
  return menuNames.some((n) => matches(b, n));
}

/** Every name this turn's menu can legitimately be cited as. */
export function menuNamesOf(
  selected: { recipe: { name: string; shortName?: string } }[],
  ownReferenceNames: string[] = [],
): string[] {
  const out: string[] = [];
  for (const s of selected) {
    out.push(s.recipe.name);
    if (s.recipe.shortName) out.push(s.recipe.shortName);
  }
  return out.concat(ownReferenceNames);
}
