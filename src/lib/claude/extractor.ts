import type { BrewSignature } from "./brewSignature";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ExtractorVariableFinding {
  variable: string;     // "water source", "grind direction", "temperature", etc.
  tier: 1 | 2 | 3;
  finding: string;      // qualitative, NO numbers — e.g. "diluted water appears in most strong cups"
  significance: "strong" | "moderate" | "weak" | "none";
}

export interface ExtractorOutput {
  granularity: "cold-start" | "per-coffee" | "per-type";
  label: string;        // "this Kenyan" | "East African Naturals on V60" | "your brewing"
  sessionCount: number;
  hasPattern: boolean;
  variableFindings: ExtractorVariableFinding[];
  personalPatterns: string[];   // cross-coffee: pace, craft score, occasion
  missingData: string[];        // variables never captured
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function countLabel(n: number): string {
  if (n === 2) return "twice";
  if (n <= 4) return "a few times";
  return "several times";
}

// ─── Variable correlation finders ────────────────────────────────────────────

function findWaterCorrelation(
  good: BrewSignature[],
  poor: BrewSignature[]
): ExtractorVariableFinding {
  if (good.length < 2 || poor.length < 2) {
    return { variable: "water source", tier: 1, finding: "not enough data to assess water source pattern", significance: "none" };
  }

  const goodDiluted = good.filter(s => s.waterPpm <= 150).length / good.length;
  const poorDiluted = poor.filter(s => s.waterPpm <= 150).length / poor.length;
  const diff = goodDiluted - poorDiluted;

  if (diff > 0.5) {
    return {
      variable: "water source", tier: 1,
      finding: `diluted or softer water appears ${countLabel(good.filter(s => s.waterPpm <= 150).length)} in the stronger cups, tap water more often in the weaker ones`,
      significance: diff > 0.7 ? "strong" : "moderate",
    };
  }
  if (diff < -0.5) {
    return {
      variable: "water source", tier: 1,
      finding: "tap and diluted water appear similarly across good and poor cups — water source does not seem to be a distinguishing factor here",
      significance: "none",
    };
  }
  // Mixed
  const allDiluted = [...good, ...poor].filter(s => s.waterPpm <= 150).length;
  const total = good.length + poor.length;
  if (allDiluted === total) {
    return { variable: "water source", tier: 1, finding: "all sessions used diluted water — no variation to assess", significance: "none" };
  }
  if (allDiluted === 0) {
    return { variable: "water source", tier: 1, finding: "all sessions used tap water — no variation to assess", significance: "none" };
  }
  return {
    variable: "water source", tier: 1,
    finding: "water source shows only a weak pattern — not yet distinguishing",
    significance: "weak",
  };
}

function findGrindCorrelation(
  good: BrewSignature[],
  poor: BrewSignature[]
): ExtractorVariableFinding {
  const goodGrinds = good.map(s => s.grindNumeric).filter((g): g is number => g != null);
  const poorGrinds = poor.map(s => s.grindNumeric).filter((g): g is number => g != null);

  if (goodGrinds.length < 2 || poorGrinds.length < 2) {
    return { variable: "grind setting", tier: 1, finding: "not enough grind data to find a pattern", significance: "none" };
  }

  const goodAvg = avg(goodGrinds);
  const poorAvg = avg(poorGrinds);
  const diff = goodAvg - poorAvg;

  if (Math.abs(diff) < 2) {
    return {
      variable: "grind setting", tier: 1,
      finding: "grind setting sits at a similar position in both stronger and weaker cups — not the separating variable here",
      significance: "none",
    };
  }
  if (diff > 2) {
    return {
      variable: "grind setting", tier: 1,
      finding: `the stronger cups have appeared ${countLabel(goodGrinds.length)} with a coarser grind; the weaker cups tend toward the finer end of the range`,
      significance: diff > 5 ? "strong" : "moderate",
    };
  }
  return {
    variable: "grind setting", tier: 1,
    finding: `the stronger cups have appeared ${countLabel(goodGrinds.length)} with a finer grind; the weaker cups tend toward the coarser end`,
    significance: Math.abs(diff) > 5 ? "strong" : "moderate",
  };
}

function findTempCorrelation(
  good: BrewSignature[],
  poor: BrewSignature[]
): ExtractorVariableFinding {
  const goodTemps = good.map(s => s.tempC).filter((t): t is number => t != null);
  const poorTemps = poor.map(s => s.tempC).filter((t): t is number => t != null);

  if (goodTemps.length < 2 || poorTemps.length < 2) {
    return { variable: "brew temperature", tier: 1, finding: "not enough temperature data to find a pattern", significance: "none" };
  }

  const goodAvg = avg(goodTemps);
  const poorAvg = avg(poorTemps);
  const diff = goodAvg - poorAvg;

  if (Math.abs(diff) < 1.5) {
    return {
      variable: "brew temperature", tier: 1,
      finding: "temperature shows no distinguishing pattern — similar levels appear in both strong and weak cups",
      significance: "none",
    };
  }
  if (diff > 1.5) {
    return {
      variable: "brew temperature", tier: 1,
      finding: `higher temperature appears ${countLabel(goodTemps.length)} in the stronger cups`,
      significance: diff > 3 ? "strong" : "moderate",
    };
  }
  return {
    variable: "brew temperature", tier: 1,
    finding: `lower temperature appears ${countLabel(goodTemps.length)} in the stronger cups — this coffee may prefer a gentler approach`,
    significance: Math.abs(diff) > 3 ? "strong" : "moderate",
  };
}

function findAgitationCorrelation(
  good: BrewSignature[],
  poor: BrewSignature[]
): ExtractorVariableFinding | null {
  const goodKnown = good.filter(s => s.agitationProfile !== "unknown");
  const poorKnown = poor.filter(s => s.agitationProfile !== "unknown");
  if (goodKnown.length < 2 || poorKnown.length < 2) return null;

  const goodFollowed = goodKnown.filter(s => s.agitationProfile === "followed").length / goodKnown.length;
  const poorFollowed = poorKnown.filter(s => s.agitationProfile === "followed").length / poorKnown.length;
  const diff = goodFollowed - poorFollowed;

  if (diff > 0.4) {
    return {
      variable: "agitation", tier: 3,
      finding: "following the agitation cue correlates with the stronger cups — skipping or modifying it appears more often when things go flat",
      significance: "moderate",
    };
  }
  return null;
}

function findFlowCorrelation(
  good: BrewSignature[],
  poor: BrewSignature[]
): ExtractorVariableFinding | null {
  const goodKnown = good.filter(s => s.flowOutcome !== "unknown");
  const poorKnown = poor.filter(s => s.flowOutcome !== "unknown");
  if (goodKnown.length < 2 || poorKnown.length < 2) return null;

  const goodFast = goodKnown.filter(s => s.flowOutcome === "too-fast").length / goodKnown.length;
  const poorFast = poorKnown.filter(s => s.flowOutcome === "too-fast").length / poorKnown.length;

  if (poorFast - goodFast > 0.4) {
    return {
      variable: "draw-down speed", tier: 2,
      finding: `fast draw-down appears ${countLabel(poorKnown.filter(s => s.flowOutcome === "too-fast").length)} in the weaker cups — the grind may be running too coarse for this combination`,
      significance: "moderate",
    };
  }
  const poorSlow = poorKnown.filter(s => s.flowOutcome === "too-slow").length / poorKnown.length;
  if (poorSlow - goodFast > 0.4) {
    return {
      variable: "draw-down speed", tier: 2,
      finding: `slow draw-down appears ${countLabel(poorKnown.filter(s => s.flowOutcome === "too-slow").length)} in the weaker cups — possible fine grind or high agitation`,
      significance: "moderate",
    };
  }
  return null;
}

// ─── Personal patterns (cross-coffee) ────────────────────────────────────────

function detectPersonalPatterns(signatures: BrewSignature[]): string[] {
  const patterns: string[] = [];

  // Craft-to-outcome correlation
  const exceptional = signatures.filter(s => s.craft === "exceptional");
  const off = signatures.filter(s => s.craft === "off");
  if (exceptional.length >= 2 && off.length >= 2) {
    const excAvg = avg(exceptional.map(s => s.ratingWeight));
    const offAvg = avg(off.map(s => s.ratingWeight));
    if (excAvg - offAvg > 0.7) {
      patterns.push("execution quality has a consistent relationship with the cup — careful, unhurried sessions produce measurably stronger results than rushed ones");
    }
  }

  // Occasion patterns
  const byOccasion: Record<string, BrewSignature[]> = {};
  for (const s of signatures) {
    if (s.occasion === "unknown") continue;
    byOccasion[s.occasion] = byOccasion[s.occasion] ?? [];
    byOccasion[s.occasion].push(s);
  }
  const occasions = Object.entries(byOccasion).filter(([, g]) => g.length >= 2);
  if (occasions.length >= 2) {
    const sorted = occasions
      .map(([occ, group]) => ({ occ, avg: avg(group.map(s => s.ratingWeight)) }))
      .sort((a, b) => b.avg - a.avg);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.avg - worst.avg > 0.8) {
      patterns.push(`${best.occ} sessions consistently produce the strongest cups — the context of the brew matters, not just the recipe`);
    }
  }

  return patterns;
}

// ─── Missing data detector ────────────────────────────────────────────────────

function detectMissingData(signatures: BrewSignature[]): string[] {
  const missing: string[] = [];
  const noGrind = signatures.filter(s => s.grindNumeric === null).length;
  const noTemp = signatures.filter(s => s.tempC === null).length;
  const noAgitation = signatures.filter(s => s.agitationProfile === "unknown").length;

  if (noGrind > signatures.length * 0.5) missing.push("grind setting (not yet captured for most sessions)");
  if (noTemp > signatures.length * 0.5) missing.push("actual brew temperature (not yet captured for most sessions)");
  if (noAgitation > signatures.length * 0.5) missing.push("agitation confirmation (not yet captured)");

  return missing;
}

// ─── Core cluster analysis ────────────────────────────────────────────────────

function analyzeCluster(
  signatures: BrewSignature[],
  granularity: "per-coffee" | "per-type",
  label: string
): ExtractorOutput {
  const good = signatures.filter(s => s.ratingWeight >= 3.5);
  const poor = signatures.filter(s => s.ratingWeight <= 2.5);
  const hasPattern = good.length >= 2 || poor.length >= 2;

  const variableFindings: ExtractorVariableFinding[] = [];

  if (hasPattern) {
    // Tier 1 variables
    variableFindings.push(findWaterCorrelation(good, poor));
    variableFindings.push(findGrindCorrelation(good, poor));
    variableFindings.push(findTempCorrelation(good, poor));

    // Tier 2 variables
    const flowFinding = findFlowCorrelation(good, poor);
    if (flowFinding) variableFindings.push(flowFinding);

    // Tier 3 variables
    const agitationFinding = findAgitationCorrelation(good, poor);
    if (agitationFinding) variableFindings.push(agitationFinding);
  }

  // Keep only findings that are not "none" significance
  const meaningfulFindings = variableFindings.filter(f => f.significance !== "none");

  return {
    granularity,
    label,
    sessionCount: signatures.length,
    hasPattern,
    variableFindings: meaningfulFindings,
    personalPatterns: detectPersonalPatterns(signatures),
    missingData: detectMissingData(signatures),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ExtractorContext {
  currentCoffeeKey?: string;
  currentTypeCluster?: string;
  currentCoffeeName?: string;
}

export function extract(
  signatures: BrewSignature[],
  context: ExtractorContext = {}
): ExtractorOutput {
  if (signatures.length < 3) {
    return {
      granularity: "cold-start",
      label: "your brewing",
      sessionCount: signatures.length,
      hasPattern: false,
      variableFindings: [],
      personalPatterns: [],
      missingData: detectMissingData(signatures),
    };
  }

  // Try per-coffee first
  if (context.currentCoffeeKey) {
    const coffeeSigs = signatures.filter(s => s.coffeeKey === context.currentCoffeeKey);
    if (coffeeSigs.length >= 3) {
      const label = context.currentCoffeeName
        ? `this ${context.currentCoffeeName}`
        : "this coffee";
      return analyzeCluster(coffeeSigs, "per-coffee", label);
    }
  }

  // Fall back to type cluster
  if (context.currentTypeCluster) {
    const typeSigs = signatures.filter(s => s.coffeeTypeCluster === context.currentTypeCluster);
    if (typeSigs.length >= 4) {
      const clusterLabel = context.currentTypeCluster
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
      return analyzeCluster(typeSigs, "per-type", clusterLabel);
    }
  }

  // Fall back to all signatures with meaningful data
  if (signatures.length >= 5) {
    const personalPatterns = detectPersonalPatterns(signatures);
    if (personalPatterns.length > 0) {
      return {
        granularity: "cold-start",
        label: "your brewing overall",
        sessionCount: signatures.length,
        hasPattern: true,
        variableFindings: [],
        personalPatterns,
        missingData: detectMissingData(signatures),
      };
    }
  }

  return {
    granularity: "cold-start",
    label: "your brewing",
    sessionCount: signatures.length,
    hasPattern: false,
    variableFindings: [],
    personalPatterns: [],
    missingData: detectMissingData(signatures),
  };
}

// ─── Serialise for Escher transformer ────────────────────────────────────────

export function serialiseForEscher(output: ExtractorOutput): string {
  if (!output.hasPattern) {
    const missingNote = output.missingData.length > 0
      ? `\nNot yet captured: ${output.missingData.join(", ")}.`
      : "";
    return `Context: ${output.sessionCount} sessions logged, not yet enough data at the ${output.granularity} level for pattern claims.${missingNote} Reasoning is physics-based only.`;
  }

  const lines: string[] = [
    `Analysis for: ${output.label}`,
    `Sessions in this cluster: ${output.sessionCount}`,
    `Granularity: ${output.granularity}`,
    "",
    "Variable findings:",
    ...output.variableFindings.map(f =>
      `  ${f.variable} (tier ${f.tier}, ${f.significance}): ${f.finding}`
    ),
  ];

  if (output.personalPatterns.length > 0) {
    lines.push("", "Personal patterns (cross-coffee):");
    output.personalPatterns.forEach(p => lines.push(`  ${p}`));
  }

  if (output.missingData.length > 0) {
    lines.push("", "Missing data (honest gap, mention if relevant):");
    output.missingData.forEach(m => lines.push(`  ${m}`));
  }

  return lines.join("\n");
}
