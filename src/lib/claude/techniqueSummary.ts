/**
 * The GENERAL coach's deterministic evidence block (2026-10-17).
 *
 * The Taste Profile coach stopped writing about single bags — that is the
 * per-coffee card's job (`coffeeInsight.ts`, shown on /coffees/[id]). What it
 * writes instead is the owner's own patterns: how he pours, how his timing
 * lands, whether he follows recipes, what he blames when a cup misses, and
 * which kinds of coffee he keeps rating high. Every number below is counted
 * from the logged sessions; nothing is estimated. The block is empty when the
 * log holds nothing measurable, and the prompt tells the model to say less
 * rather than invent.
 *
 * Pure: types + pure helpers only, so a test can bundle it without the DB.
 */
import type { Session } from "@/lib/types/session";
import { EVEN_POUR_CV, UNEVEN_POUR_CV, OVERSHOOT_REPORT_G } from "@/lib/brew/flowAnalysis";
import { brewMethodKey } from "@/lib/utils/brewMethodKey";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const star = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}★`;

function coffeeKey(s: Session): string {
  return `${s.coffee?.roaster ?? ""}__${s.coffee?.name ?? ""}`.toLowerCase();
}

/** Rated sessions grouped by a label; a bucket counts only with ≥ minBrews
 *  brews spread over ≥ minCoffees DIFFERENT bags, so a preference line can
 *  never be one bag in disguise. */
function preferenceLines(
  sessions: Session[],
  label: string,
  pick: (s: Session) => string | undefined,
  minBrews = 3,
  minCoffees = 2,
): string[] {
  const buckets: Record<string, { ratings: number[]; coffees: Set<string> }> = {};
  for (const s of sessions) {
    const v = pick(s)?.trim();
    const r = s.result?.rating;
    if (!v || r == null) continue;
    const key = v.toLowerCase();
    buckets[key] = buckets[key] ?? { ratings: [], coffees: new Set() };
    buckets[key].ratings.push(r);
    buckets[key].coffees.add(coffeeKey(s));
  }
  const rows = Object.entries(buckets)
    .filter(([, b]) => b.ratings.length >= minBrews && b.coffees.size >= minCoffees)
    .map(([k, b]) => ({ k, n: b.ratings.length, bags: b.coffees.size, avg: avg(b.ratings), top: b.ratings.filter((r) => r >= 4).length }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n)
    .slice(0, 8);
  if (rows.length < 2) return []; // one bucket cannot show a preference
  return [
    `${label}: ` +
      rows.map((r) => `${r.k} ${star(r.avg)} (${r.top} of ${r.n} brews 4★+, ${r.bags} bags)`).join("; "),
  ];
}

/**
 * Exported for tests and for the prompt. Returns "" when nothing is countable.
 */
export function formatTechniqueSummary(sessions: Session[]): string {
  const rated = sessions.filter((s) => s.result?.rating != null);
  if (rated.length === 0) return "";
  const out: string[] = [];

  // ── Pour technique (Acaia-measured brews only) ──────────────────────────
  const measured = rated.filter((s) => s.brew?.flowAnalysis);
  if (measured.length > 0) {
    const pour: string[] = [`Scale-measured brews: ${measured.length} of ${rated.length}.`];
    const withCv = measured.filter((s) => s.brew!.flowAnalysis!.pourSteadiness != null);
    if (withCv.length > 0) {
      const even = withCv.filter((s) => s.brew!.flowAnalysis!.pourSteadiness! <= EVEN_POUR_CV);
      const uneven = withCv.filter((s) => s.brew!.flowAnalysis!.pourSteadiness! >= UNEVEN_POUR_CV);
      const mixed = withCv.length - even.length - uneven.length;
      const cvs = withCv.map((s) => s.brew!.flowAnalysis!.pourSteadiness!);
      pour.push(
        `Pour steadiness (CV of per-pour rates; ≤${EVEN_POUR_CV} even, ≥${UNEVEN_POUR_CV} uneven): ` +
          `${even.length} even, ${mixed} in between, ${uneven.length} uneven; median CV ${median(cvs).toFixed(2)}.`,
      );
      if (even.length >= 2 && uneven.length >= 2) {
        pour.push(
          `Rating when the pour was even: ${star(avg(even.map((s) => s.result!.rating)))} over ${even.length}; ` +
            `when uneven: ${star(avg(uneven.map((s) => s.result!.rating)))} over ${uneven.length}.`,
        );
      }
    }
    const rates = measured
      .map((s) => s.brew!.flowAnalysis!.avgPourRateGPS)
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (rates.length > 0) {
      pour.push(
        `Hand pour rate (grams ÷ pouring seconds, rests excluded): median ${median(rates).toFixed(1)} g/s, ` +
          `range ${Math.min(...rates).toFixed(1)}–${Math.max(...rates).toFixed(1)} g/s over ${rates.length} brews.`,
      );
    }
    // overPourG only: the legacy overshootG measured running ahead of the
    // clock, not water past a target, and is not evidence of anything.
    const over = measured.filter((s) => (s.brew!.flowAnalysis!.overPourG ?? 0) > OVERSHOOT_REPORT_G);
    if (over.length > 0) {
      const rest = measured.filter((s) => !over.includes(s));
      pour.push(
        `Poured more than ${OVERSHOOT_REPORT_G} g past a pour target in ${over.length} of ${measured.length} measured brews` +
          (rest.length >= 2
            ? ` (those average ${star(avg(over.map((s) => s.result!.rating)))}, the rest ${star(avg(rest.map((s) => s.result!.rating)))}).`
            : "."),
      );
    }
    const graded = measured.map((s) => s.brew!.flowAnalysis!.derivedFlow).filter(Boolean);
    if (graded.length > 0) {
      const c = (k: string) => graded.filter((g) => g === k).length;
      pour.push(`Measured total time vs plan: ${c("perfect")} on target, ${c("too-fast")} too fast, ${c("too-slow")} too slow.`);
    }
    out.push(...pour);
  }

  // ── Timing (every brew with a clock) ────────────────────────────────────
  const timingVerdicts = rated.filter((s) => s.brew?.timing);
  if (timingVerdicts.length >= 3) {
    const c = (k: string) => timingVerdicts.filter((s) => s.brew!.timing === k);
    const fmt = (k: string, word: string) => {
      const g = c(k);
      return g.length ? `${g.length} ${word} (${star(avg(g.map((s) => s.result!.rating)))})` : "";
    };
    out.push(
      `Own timing verdicts over ${timingVerdicts.length} brews: ` +
        [fmt("as-expected", "as expected"), fmt("faster", "faster than planned"), fmt("slower", "slower than planned")]
          .filter(Boolean)
          .join(", ") + ".",
    );
  }
  const byBrewer: Record<string, number[]> = {};
  for (const s of rated) {
    const actual = s.brew?.actualTimeSec;
    const target = resolveBrewedRecipe(s).recipe?.targetTimeSec;
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    if (!actual || !target || !method) continue;
    const key = brewMethodKey(method);
    (byBrewer[key] = byBrewer[key] ?? []).push(actual - target);
  }
  const deltaLines = Object.entries(byBrewer)
    .filter(([, d]) => d.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([k, d]) => {
      const m = Math.round(median(d));
      return `${k} ${m >= 0 ? "+" : ""}${m} s (n=${d.length})`;
    });
  if (deltaLines.length > 0) {
    out.push(`Actual minus planned brew time, median per brewer: ${deltaLines.join("; ")}.`);
  }

  // ── Recipe adherence ────────────────────────────────────────────────────
  const followed = rated.filter((s) => s.brew?.followedRecipe === true);
  const modified = rated.filter((s) => s.brew?.followedRecipe === false || !!s.brew?.modifications?.trim());
  if (followed.length + modified.length >= 4) {
    const part = (g: Session[], word: string) =>
      g.length ? `${g.length} ${word} (${star(avg(g.map((s) => s.result!.rating)))})` : "";
    out.push(
      `Recipe adherence: ${[part(followed, "followed as written"), part(modified, "changed something")].filter(Boolean).join(", ")}.`,
    );
  }

  // ── What he blames when a cup misses ────────────────────────────────────
  const blamed = rated.filter((s) => s.result?.attribution);
  if (blamed.length >= 2) {
    const counts: Record<string, number> = {};
    for (const s of blamed) counts[s.result!.attribution!] = (counts[s.result!.attribution!] ?? 0) + 1;
    const words: Record<string, string> = { brew: "own execution", recipe: "the recipe", bean: "the bean", roaster: "the roaster" };
    out.push(
      `What held a low-rated cup back (his own verdict, ${blamed.length} cups): ` +
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${words[k] ?? k} ${n}`)
          .join(", ") + ".",
    );
  }

  // ── Taste preferences across bags ───────────────────────────────────────
  const prefs = [
    ...preferenceLines(rated, "By process", (s) => s.coffee?.process),
    ...preferenceLines(rated, "By origin", (s) => s.coffee?.origin),
    ...preferenceLines(rated, "By roast level", (s) => s.coffee?.roastLevel),
    ...preferenceLines(rated, "By variety", (s) => s.coffee?.variety),
    ...preferenceLines(rated, "By brewer", (s) => {
      const m = s.brew?.methodUsed || s.recommendation?.primaryMethod;
      return m ? brewMethodKey(m) : undefined;
    }),
    ...preferenceLines(rated, "By water", (s) => s.context?.waterSource),
    ...preferenceLines(rated, "By occasion", (s) => s.context?.occasion),
  ];
  if (prefs.length > 0) {
    out.push(
      "Average rating by coffee attribute — every bucket spans at least two different bags, so none of these is one coffee in disguise:",
      ...prefs.map((l) => `  ${l}`),
    );
  }

  if (out.length === 0) return "";
  return ["── Measured technique, habits and preferences (counted from the log) ──", ...out].join("\n");
}
