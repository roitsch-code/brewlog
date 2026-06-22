// Adaptive hydration check-in — tunable constants (spec §3).
//
// Every number here is a START heuristic, explicitly meant for tuning — not
// derived from a study for this exact user. They live in ENV (with the
// defaults below) rather than being hardcoded, so the target can be retuned
// without a redeploy. See docs/ for the spec.

export interface HydrationConfig {
  /** Base drink volume in ml (NOT total water incl. food). Tuned to body weight. */
  basisMl: number;
  /** Apparent-temperature threshold (°C) above which the heat surcharge starts. */
  schwelleC: number;
  /** ml added per °C of apparent temp above the threshold. */
  mlProGrad: number;
  /** Hard cap on the heat surcharge (ml). */
  hitzeCapMl: number;
  /** Active-calorie baseline; only kcal above this drive the movement surcharge. */
  aktivBasisKcal: number;
  /** ml added per active kcal above the baseline. */
  mlProKcal: number;
  /** Hard cap on the movement surcharge (ml). */
  bewegungCapMl: number;
  /** Hard cap on the whole target (ml) — absorbs sensor-error outliers. */
  zielCapMl: number;
  /** Anti-spam: only re-announce a raised target if it grew by ≥ this (ml). */
  meldeDeltaMl: number;
}

function num(envVal: string | undefined, fallback: number): number {
  const n = envVal != null ? Number(envVal) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read the hydration config from ENV, falling back to the spec defaults.
 * Basis default is 2700 ml — tuned to Markus' ~112 kg (≈ 32.5 ml/kg × 0.73
 * from drinks), not the generic 2500 ml spec example for 95 kg.
 */
export function hydrationConfig(): HydrationConfig {
  return {
    basisMl: num(process.env.HYDRATION_BASIS_ML, 2700),
    schwelleC: num(process.env.HYDRATION_SCHWELLE_C, 23),
    mlProGrad: num(process.env.HYDRATION_ML_PRO_GRAD, 60),
    hitzeCapMl: num(process.env.HYDRATION_HITZE_CAP_ML, 1000),
    aktivBasisKcal: num(process.env.HYDRATION_AKTIV_BASIS_KCAL, 400),
    mlProKcal: num(process.env.HYDRATION_ML_PRO_KCAL, 1.0),
    bewegungCapMl: num(process.env.HYDRATION_BEWEGUNG_CAP_ML, 1200),
    zielCapMl: num(process.env.HYDRATION_ZIEL_CAP_ML, 4500),
    meldeDeltaMl: num(process.env.HYDRATION_MELDE_DELTA_ML, 300),
  };
}

/** Evening check-in time (local, Europe/Berlin), HH:MM. Spec default 20:30. */
export function checkinTime(): string {
  return process.env.HYDRATION_CHECKIN_TIME ?? "20:30";
}
