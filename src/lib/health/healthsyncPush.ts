// One-way, fire-and-forget caffeine push to the co-hosted HealthSync app.
//
// Principle "never-switch-projects": BrewLog forwards ONLY caffeine — the drink
// volume in ml, an optional mg figure, and the timestamp. No other health data,
// no merge, no reverse direction. HealthSync's ingest endpoint is one-way and
// only accepts caffeine.
//
// Best-effort by design: a HealthSync outage (or a missing config) must never
// block the user or fail a brew save. We deliberately do NOT await the request
// so it can't add HealthSync's latency to every save; BrewLog runs as a
// long-lived Node server (docker-compose `app`), so an un-awaited fetch keeps
// running after the save response returns.

/** The exact shape HealthSync's POST /api/ingest/brewlog accepts. */
export interface CaffeinePushPayload {
  /** Drink volume in millilitres. Omitted when the brew carries no water figure
   *  (e.g. a coffee-shop log with no recipe). */
  caffeine_ml?: number;
  /** Caffeine in milligrams — only sent when BrewLog actually has it. BrewLog
   *  does not currently measure mg, so this is omitted rather than fabricated. */
  caffeine_mg?: number;
  /** ISO-8601 timestamp of the coffee. */
  ts: string;
  /** Always "coffee" — this bridge never forwards anything else. */
  drink: "coffee";
}

/** Minimal view of a just-saved session that this bridge reads. */
export interface CaffeineSource {
  type: string;
  createdAt: string;
  brew?: { waterGrams?: number } | null;
}

/**
 * Build the caffeine payload from a just-saved session, or `null` when the
 * session carries no caffeine to report (a wine log). Pure + exported so the
 * payload shape is unit-testable without a network.
 */
export function buildCaffeinePayload(session: CaffeineSource): CaffeinePushPayload | null {
  if (session.type !== "coffee") return null;

  const ts = session.createdAt || new Date().toISOString();
  const payload: CaffeinePushPayload = { ts, drink: "coffee" };

  // waterGrams ≈ the drink's ml (1 g water ≈ 1 ml). It's the best "ml of the
  // coffee" BrewLog has; external coffee-shop logs may lack it → omit, don't
  // invent one.
  const ml = session.brew?.waterGrams;
  if (typeof ml === "number" && Number.isFinite(ml) && ml > 0) {
    payload.caffeine_ml = ml;
  }

  return payload;
}

/**
 * Fire-and-forget: push the session's caffeine to HealthSync. No-op when the
 * bridge isn't configured (env absent) or the session isn't a coffee. Never
 * throws, never blocks — safe to call inline in a save handler.
 */
export function pushCaffeineToHealthSync(session: CaffeineSource): void {
  const url = process.env.HEALTHSYNC_INGEST_URL;
  const secret = process.env.HEALTHSYNC_INGEST_SECRET;
  if (!url || !secret) return; // not wired up → silently skip

  const payload = buildCaffeinePayload(session);
  if (!payload) return;

  try {
    // Not awaited: the save response returns immediately regardless of
    // HealthSync. AbortSignal keeps a wedged socket from lingering.
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ingest-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    // AbortSignal.timeout / fetch construction can't realistically throw here,
    // but a caffeine push must never be able to break a brew save.
  }
}
