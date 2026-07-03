/**
 * Post-scan clarifications — deterministic, field-targeted follow-up questions.
 *
 * The old flow let the vision model free-write "clarifications", then round-
 * tripped each answer through Haiku to "update the coffee data". That produced
 * random, repetitive, off-field questions ("any additional lot or harvest year
 * details from the roaster's website?") whose answers had no field to land in —
 * so they vanished. This module replaces both halves with pure functions:
 *
 *  - buildClarifications() asks ONLY about fields the scan left empty, in a
 *    fixed priority, each tied to exactly one CoffeeIdentity field. Nothing the
 *    scan already knows is ever asked; roast date / cupping score are never
 *    asked (the form's date picker + optional-score field own those).
 *  - applyClarificationAnswer() maps an answer straight onto its target field —
 *    no model call, so an answer can never "verpuffen".
 *
 * The caller re-checks each field against the live form before showing it, so a
 * value the user typed into the form above also suppresses its question.
 */
import type { CoffeeIdentity } from "@/lib/types/session";

export type ClarificationField =
  | "variety"
  | "tastingNotesFromBag"
  | "region"
  | "process"
  | "origin";

export interface Clarification {
  field: ClarificationField;
  question: string;
  /** Tap-to-answer chips; the caller also always offers a free-text box + "Not sure". */
  chips?: string[];
}

type CoffeeLike = Partial<CoffeeIdentity>;

const PROCESS_CHIPS = ["Washed", "Natural", "Honey", "Anaerobic"];

// Region chips for the origins where a handful of well-known growing regions
// covers most bags. Unknown origins fall back to a free-text answer.
const REGION_CHIPS: Record<string, string[]> = {
  ethiopia: ["Yirgacheffe", "Guji", "Sidama", "Harrar", "Limu"],
  kenya: ["Nyeri", "Kirinyaga", "Kiambu", "Embu"],
  colombia: ["Huila", "Nariño", "Tolima", "Cauca"],
  brazil: ["Cerrado", "Sul de Minas", "Mogiana"],
  guatemala: ["Antigua", "Huehuetenango", "Atitlán"],
};

/** True when a field carries no usable value the scan could act on. */
export function isFieldEmpty(coffee: CoffeeLike, field: ClarificationField): boolean {
  if (field === "tastingNotesFromBag") {
    return (coffee.tastingNotesFromBag?.length ?? 0) === 0;
  }
  const v = (coffee[field] as string | undefined)?.trim();
  if (!v) return true;
  // "Other" / "Unknown" are non-answers the scan falls back to — worth asking.
  return /^(other|unknown|n\/?a)$/i.test(v);
}

/**
 * Ordered, field-targeted questions for whatever the scan left empty. Capped at
 * `max` (default 2) so the chat stays a quick confirm, never an interrogation.
 */
export function buildClarifications(coffee: CoffeeLike, max = 2): Clarification[] {
  const out: Clarification[] = [];

  const origin = (coffee.origin ?? "").trim().toLowerCase();

  const candidates: Clarification[] = [
    {
      field: "variety",
      question: "Which variety is it, if the bag names one?",
    },
    {
      field: "tastingNotesFromBag",
      question: "What tasting notes does the roaster print on the bag?",
    },
    {
      field: "region",
      question: origin
        ? `Which region within ${(coffee.origin ?? "").trim()}?`
        : "Which growing region is it from?",
      chips: REGION_CHIPS[origin],
    },
    {
      field: "process",
      question: "How was it processed?",
      chips: PROCESS_CHIPS,
    },
    {
      field: "origin",
      question: "Which country is this coffee from?",
    },
  ];

  for (const c of candidates) {
    if (out.length >= max) break;
    // Don't ask for a region when we don't even have the country yet — the
    // origin question comes first and is more useful.
    if (c.field === "region" && !origin) continue;
    if (isFieldEmpty(coffee, c.field)) out.push(c);
  }
  return out;
}

/** Canonical process bucket from a free-text answer. */
export function normalizeProcess(answer: string): string {
  const a = answer.trim().toLowerCase();
  if (/anaerob|carbonic|macerat|co-?ferment/.test(a)) return "Anaerobic";
  if (/wash|fully.?wash/.test(a)) return "Washed";
  if (/honey|pulped|semi/.test(a)) return "Honey";
  if (/natural|dry.?process|dry-?natural/.test(a)) return "Natural";
  return answer.trim();
}

/** Whether an answer means "I don't know" (skip without writing anything). */
export function isSkipAnswer(answer: string): boolean {
  return /^(not sure|no idea|dunno|don'?t know|skip|n\/?a|-)$/i.test(answer.trim());
}

/**
 * Map a single answer onto its target field. Returns the patch to merge into the
 * coffee (or null for a skip). tasting notes merge with (don't replace) whatever
 * the scan already found, deduped case-insensitively.
 */
export function applyClarificationAnswer(
  field: ClarificationField,
  answer: string,
  coffee: CoffeeLike,
): Partial<CoffeeIdentity> | null {
  if (isSkipAnswer(answer)) return null;
  const trimmed = answer.trim();
  if (!trimmed) return null;

  if (field === "tastingNotesFromBag") {
    const incoming = trimmed
      .split(/[,;/]|·|•/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length === 0) return null;
    const existing = coffee.tastingNotesFromBag ?? [];
    const seen = new Set(existing.map((n) => n.toLowerCase()));
    const merged = [...existing];
    for (const n of incoming) {
      if (!seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        merged.push(n);
      }
    }
    return { tastingNotesFromBag: merged };
  }

  if (field === "process") return { process: normalizeProcess(trimmed) };
  return { [field]: trimmed } as Partial<CoffeeIdentity>;
}
