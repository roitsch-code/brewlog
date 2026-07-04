/**
 * Tare tracker — turns the raw Acaia reading into "water poured so far".
 *
 * The scale sits UNDER the whole brewer, so its raw reading is the TOTAL mass on
 * the plate: dripper + carafe + coffee + whatever water has been poured. Two
 * things have to be stripped out to get "water poured", the only signal the pour
 * coach + the post-brew analysis actually want:
 *
 *   1. The empty-vessel weight — zeroed out at brew start (the baseline). If the
 *      user never pressed the physical Tare, that vessel mass would otherwise be
 *      read as poured water (the "+583 g overshoot" class).
 *   2. VESSEL HANDLING during the brew — putting the carafe on the scale, taking
 *      it off, dropping the filter/dripper on top, lifting the dripper to swirl,
 *      tapping the app's Tare. None of that is water, yet each shifts the raw
 *      reading by ~100–400 g in a single sample.
 *
 * The tell that separates the two: a POUR adds water GRADUALLY — a kettle tops
 * out around ~15 g/s, so between two ~10 Hz samples it moves a couple of grams.
 * Vessel handling is a STEP change — hundreds of g/s. So any change faster than
 * a physically-possible pour (and large enough not to be jitter) is absorbed
 * into the baseline, leaving `net` a continuous water-poured signal that only
 * ever moves when you actually pour.
 *
 * The caller only feeds samples recorded between Start and Done, so setup and
 * teardown never reach this at all. Pure + deterministic; unit-tested.
 */

export interface TareState {
  /** Current zero offset (raw grams). Null until the first reading seeds it. */
  baseline: number | null;
  /** Previous raw reading, to measure the step between samples. */
  lastRaw: number | null;
  /** Wall-clock ms of the previous reading, to turn a step into a rate. */
  lastMs: number;
}

export function createTareState(): TareState {
  return { baseline: null, lastRaw: null, lastMs: 0 };
}

/** Above this rate of change (g/s) a reading is vessel handling, not a pour. A
 * kettle pour is ~4–15 g/s; 60 g/s leaves generous headroom below the hundreds
 * of g/s a vessel placement/removal produces. */
export const MAX_POUR_RATE_GPS = 60;

/** …and the step has to be at least this big to count as handling at all, so BLE
 * jitter between two near-instant samples can never trip the rate test. A real
 * pour practically never moves this much in ONE sample. */
export const MIN_STEP_G = 25;

/**
 * Feed one raw reading; returns net water poured. Mutates `state` (mirrors the
 * ref the brew screen keeps). The first reading seeds the baseline and returns
 * 0 — i.e. "zero at start". Thereafter a step-change too fast to be a pour is
 * folded into the baseline so it's not counted as water; a gradual change is
 * counted normally.
 */
export function netWaterPoured(state: TareState, raw: number, atMs: number): number {
  if (state.baseline == null || state.lastRaw == null) {
    state.baseline = raw;
    state.lastRaw = raw;
    state.lastMs = atMs;
    return 0;
  }
  const delta = raw - state.lastRaw;
  const dtSec = Math.max(0.1, (atMs - state.lastMs) / 1000);
  const absDelta = Math.abs(delta);
  if (absDelta >= MIN_STEP_G && absDelta / dtSec >= MAX_POUR_RATE_GPS) {
    // Vessel placed / lifted / tared — absorb the jump so net stays continuous.
    state.baseline += delta;
  }
  state.lastRaw = raw;
  state.lastMs = atMs;
  return raw - state.baseline;
}
