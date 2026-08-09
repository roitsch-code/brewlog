/**
 * Shared payload types for the home chat's terminal action tools.
 *
 * Lives in lib/types (not the route) so pure helpers and client components can
 * use it without importing an API route module — the server/client boundary
 * rule in CLAUDE.md.
 */

/**
 * A bag the chat read that isn't in the library yet — the payload of an
 * `add_coffee` action. Field names match CoffeeIdentity and the POST
 * /api/coffees body so the pill can post it straight through with no mapping.
 */
export interface NewCoffeePayload {
  roaster: string;
  name: string;
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  roastLevel?: string;
  roastDate?: string;
  fermentationStyle?: string;
  cuppingScore?: number;
  tastingNotesFromBag?: string[];
  /** Set server-side from the photo the user attached this turn, not by the model. */
  bagPhotoUrl?: string;
}
