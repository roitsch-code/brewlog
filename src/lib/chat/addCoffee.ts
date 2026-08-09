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

/** Minimal shape of a chat message for photo lookup. */
interface MessageLike {
  role: string;
  imageUrl?: string;
}

/**
 * The bag photo for an `add_coffee` action, taken from the conversation rather
 * than the current turn.
 *
 * The server can only attach the photo sent on the SAME turn as the tool call,
 * and that is almost never the turn that adds: the chat is instructed to ask
 * for the roast date first, so the add pill is offered a turn or two after the
 * photo. The result was bags landing in the library with no picture. The most
 * recent photo in the thread is the bag being discussed.
 *
 * Only ever FILLS a missing photo — a bagPhotoUrl the server already set (the
 * same-turn case) wins.
 */
export function lastAttachedPhoto(messages: MessageLike[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && m.imageUrl) return m.imageUrl;
  }
  return undefined;
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
