import type { FieldZones } from "@/lib/field/types";

/**
 * A single-serve **drip bag** record (e.g. the INNO "Signature Drip
 * Coffee" sachet). Unlike a brewed `Session`, a drip bag has a fixed
 * brew — 200 ml of hot water through the built-in filter — so there is
 * no recipe to generate and no gear to log. It's pure documentation:
 * scan the package, keep the identity, record the flavours tasted and
 * a star rating.
 *
 * Deliberately ISOLATED from `sessions` / `coffees` / the AI corpus
 * (it lives in its own `drip_bags` table, mirroring the `cafe_visits`
 * precedent) so it can never skew `/recommend`, `/api/insights`,
 * `/taste`, or the Café Library. Surfaced only in the Coffee Library
 * list (flagged) + its own detail page.
 */
export interface DripBag {
  id: string;
  roaster: string;
  name: string;
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  roastLevel?: string;
  /** Flavour notes printed on the package (from the bag scan). */
  bagNotes: string[];
  /** Flavours the user actually tasted (their flavour-wheel picks). */
  flavorNotes: string[];
  /** 1–5, half-star. */
  rating: number;
  freeNotes?: string;
  bagPhotoUrl?: string;
  bagPhotoPath?: string;
  /** Generative Field v1.1 composition, computed from `bagNotes` at scan. */
  fieldZones?: FieldZones | null;
  aiExtracted: boolean;
  createdAt: string; // ISO timestamp
  createdAtMs: number;
}
