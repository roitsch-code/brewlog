// Movement input for the adaptive hydration target (spec §6.2).
//
// Oura API v2 `daily_activity` → active calories for the day. Auth is a
// Personal Access Token (cloud.ouraring.com → Personal Access Tokens) passed
// as a Bearer header, kept in OURA_PAT (never committed).
//
// Caveat (spec §6.2): Oura's daily totals are only reliable the MORNING AFTER;
// during the day active_calories can still be incomplete. For the 20:30
// check-in it's usually usable, but treat as provisional.
//
// The exact JSON key (`active_calories`) is read defensively: if it's absent
// we log the actual keyset once so it can be verified against the live
// response, and return null (→ caller flags activity_data_missing).

export interface ActivityInput {
  /** Active calories for the day, or null if unavailable. */
  activeCalories: number | null;
}

interface OuraDailyActivityDoc {
  day?: string;
  active_calories?: number;
  [k: string]: unknown;
}

/**
 * Active calories for `day` (YYYY-MM-DD). Oura's `end_date` is exclusive, so
 * we query [day, day+1) to get exactly that day's document.
 */
export async function fetchActiveCalories(day: string): Promise<ActivityInput> {
  const pat = process.env.OURA_PAT;
  if (!pat) return { activeCalories: null };

  const end = nextDay(day);
  try {
    const url =
      `https://api.ouraring.com/v2/usercollection/daily_activity` +
      `?start_date=${day}&end_date=${end}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn(`oura daily_activity ${res.status}`);
      return { activeCalories: null };
    }
    const data = await res.json();
    const docs: OuraDailyActivityDoc[] = Array.isArray(data?.data) ? data.data : [];
    const doc = docs.find((d) => d.day === day) ?? docs[docs.length - 1];
    if (!doc) return { activeCalories: null };

    const cal = doc.active_calories;
    if (typeof cal === "number" && Number.isFinite(cal)) {
      return { activeCalories: cal };
    }
    // Key not where expected — surface the real shape once for verification.
    console.warn("oura daily_activity: no active_calories; keys =", Object.keys(doc));
    return { activeCalories: null };
  } catch (err) {
    console.warn("oura daily_activity fetch failed:", err);
    return { activeCalories: null };
  }
}

/** YYYY-MM-DD one day after the given date (UTC-safe, calendar only). */
function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
