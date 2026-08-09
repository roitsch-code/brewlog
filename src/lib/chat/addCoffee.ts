/**
 * Turn the chat's raw `add_coffee` tool input into the action payload the
 * ActionPill posts to /api/coffees.
 *
 * Pure and free of route/DB imports so it can be unit-tested — the mapping is
 * worth locking down because a silent drop here means a bag lands in the
 * library missing its variety or its photo, with nothing to indicate anything
 * went wrong.
 */
import type { NewCoffeePayload } from "@/lib/types/chatActions";

/** Whatever the model emitted for the add_coffee tool. All fields untrusted. */
export interface AddCoffeeToolInput {
  roaster?: string;
  name?: string;
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  roastLevel?: string;
  roastDate?: string;
  fermentationStyle?: string;
  cuppingScore?: number;
  tastingNotes?: string[];
}

/** Trimmed value, or undefined when the field carries nothing usable. */
function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/**
 * `attachedImageUrl` is the photo the user attached this turn. It becomes the
 * bag's photo here rather than being asked of the model: a model-echoed URL
 * can drift, and a wrong one would put someone else's picture on the coffee.
 */
export function buildNewCoffeePayload(
  input: AddCoffeeToolInput,
  attachedImageUrl?: string | null,
): NewCoffeePayload {
  const notes = (input.tastingNotes ?? [])
    .map((n) => n?.trim())
    .filter((n): n is string => !!n);

  return {
    roaster: (input.roaster ?? "").trim(),
    name: (input.name ?? "").trim(),
    origin: clean(input.origin),
    region: clean(input.region),
    variety: clean(input.variety),
    process: clean(input.process),
    roastLevel: clean(input.roastLevel),
    roastDate: clean(input.roastDate),
    fermentationStyle: clean(input.fermentationStyle),
    cuppingScore: typeof input.cuppingScore === "number" ? input.cuppingScore : undefined,
    tastingNotesFromBag: notes.length > 0 ? notes : undefined,
    bagPhotoUrl: attachedImageUrl ?? undefined,
  };
}

/**
 * A coach note only exists when the model supplied BOTH halves — an
 * observation with no suggestion is a statement, not advice, and would write a
 * useless note the recommender then has to carry forever.
 */
export function coachNoteFrom(
  observation: string | undefined,
  suggestion: string | undefined,
  citationFields: string[] | undefined,
): { observation: string; suggestion: string; citationFields?: string[] } | null {
  const o = observation?.trim();
  const s = suggestion?.trim();
  if (!o || !s) return null;
  return { observation: o, suggestion: s, citationFields };
}
