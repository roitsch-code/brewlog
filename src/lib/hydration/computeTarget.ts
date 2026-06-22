// Adaptive daily hydration target (spec §3.1).
//
//   ziel_ml = basis_ml + hitze_aufschlag_ml + bewegungs_aufschlag_ml
//
// Pure and total: missing inputs (null/NaN) contribute a 0 surcharge — the
// CALLER decides whether to flag heat_data_missing / activity_data_missing.
// Every surcharge is capped, and the whole target is hard-capped, so a sensor
// glitch can't produce an absurd goal.

import { hydrationConfig, type HydrationConfig } from "./config";

export interface ComputeTargetInput {
  /** Apparent (feels-like) max temp °C for the day; null/missing → 0 heat surcharge. */
  apparentTempMax?: number | null;
  /** Active calories for the day; null/missing → 0 movement surcharge. */
  activeCalories?: number | null;
  /** Override the base volume; defaults to config.basisMl. */
  basisMl?: number;
  /** Override any config constant (used by tests for determinism). */
  config?: Partial<HydrationConfig>;
}

export interface ComputeTargetResult {
  zielMl: number;
  hitzeMl: number;
  bewegungMl: number;
  basisMl: number;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function computeTarget(input: ComputeTargetInput = {}): ComputeTargetResult {
  const cfg: HydrationConfig = { ...hydrationConfig(), ...(input.config ?? {}) };
  const basisMl = isNum(input.basisMl) ? input.basisMl : cfg.basisMl;

  // Heat: delta = max(0, apparentTemp - threshold); surcharge = min(delta * ml/°C, cap).
  const hitzeMl = !isNum(input.apparentTempMax)
    ? 0
    : Math.min(
        Math.round(Math.max(0, input.apparentTempMax - cfg.schwelleC) * cfg.mlProGrad),
        cfg.hitzeCapMl,
      );

  // Movement: extra = max(0, activeCalories - baseline); surcharge = min(extra * ml/kcal, cap).
  const bewegungMl = !isNum(input.activeCalories)
    ? 0
    : Math.min(
        Math.round(Math.max(0, input.activeCalories - cfg.aktivBasisKcal) * cfg.mlProKcal),
        cfg.bewegungCapMl,
      );

  const zielMl = Math.min(basisMl + hitzeMl + bewegungMl, cfg.zielCapMl);

  return { zielMl, hitzeMl, bewegungMl, basisMl };
}
