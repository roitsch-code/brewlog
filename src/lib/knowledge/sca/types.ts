/**
 * SCA knowledge module — Specialty Coffee Association brewing foundations
 * extracted from the SCA Introduction to Coffee + SCA Coffee Brewing
 * Foundation course transcripts (taught by AST Adam, since 2015 — YouTube).
 *
 * Mixed-provenance corpus. Topics marked `verified: true` are SCA-canonical
 * (Gold Cup Brewing Control Chart, the 18–22% / 1.15–1.45% TDS targets,
 * the Golden Ratio band, the 90–96°C water range). Topics marked
 * `verified: false` are the AST's pedagogical framing of SCA material
 * (the "Five Commandments" mnemonic, the "Make every bean shine" mission,
 * specific demo ratios).
 *
 * Numbers from Part 14 (Water Quality) are qualitative only — the SCA
 * Water Quality Handbook calcium/alkalinity/magnesium/sodium/pH/TDS
 * targets are NOT present in the transcripts and must be sourced from
 * the published handbook before being added here (per the
 * "aggregators are NOT primary sources" sub-rule in CLAUDE.md).
 */

export interface ScaFact {
  /** Short label for the fact. */
  label: string;
  /** The fact itself — number range, threshold, claim. */
  value: string;
}

export interface ScaTopic {
  id: string;
  /** Display title. */
  title: string;
  /** 2–4 sentences of canonical content Haiku can quote or paraphrase. */
  body: string;
  /** Concrete numerical / threshold facts the AI can cite verbatim. */
  facts: ScaFact[];
  /** True for SCA-published canon; false for AST pedagogy / instructor's
   * framing. Distinguishes "the standard says X" from "the trainer
   * teaches X." Lessons should weight verified content higher. */
  verified: boolean;
  /** Provenance — where this came from. */
  source: string;
}
