// Heat input for the adaptive hydration target (spec §6.1).
//
// Open-Meteo, free + keyless. We read the day's APPARENT (feels-like) max
// temperature — it folds in humidity, which is closer to real fluid need than
// raw air temp. Markus commutes Düsseldorf ↔ Bonn, so we fetch BOTH and take
// the HIGHER value (conservative: rather over- than under-drink), with no
// need to detect which city he's in.
//
// Variable names verified against https://open-meteo.com/en/docs
// (daily=apparent_temperature_max). Any failure → null, so the caller flags
// heat_data_missing and the surcharge is simply 0 — the day is never skipped.

interface Coord {
  label: string;
  lat: string;
  lon: string;
}

function locations(): Coord[] {
  return [
    {
      label: "Düsseldorf",
      lat: process.env.WEATHER_LATITUDE ?? "51.2277",
      lon: process.env.WEATHER_LONGITUDE ?? "6.7735",
    },
    {
      label: "Bonn",
      lat: process.env.HYDRATION_BONN_LATITUDE ?? "50.7374",
      lon: process.env.HYDRATION_BONN_LONGITUDE ?? "7.0982",
    },
  ];
}

async function apparentMaxFor(c: Coord): Promise<number | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
      `&daily=apparent_temperature_max&timezone=Europe%2FBerlin&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const v = data?.daily?.apparent_temperature_max?.[0];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export interface HeatInput {
  /** Higher of the two cities' apparent max temp °C, or null if both failed. */
  apparentTempMax: number | null;
  /** Which city drove the value (for the reason line), or null. */
  source: string | null;
}

/** Higher apparent-max of Düsseldorf / Bonn for today. */
export async function fetchApparentTempMax(): Promise<HeatInput> {
  const locs = locations();
  const results = await Promise.all(locs.map((c) => apparentMaxFor(c)));

  let best: number | null = null;
  let source: string | null = null;
  results.forEach((v, i) => {
    if (v != null && (best == null || v > best)) {
      best = v;
      source = locs[i].label;
    }
  });
  return { apparentTempMax: best, source };
}
