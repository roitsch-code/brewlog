"use client";

import { useCallback, useEffect, useState } from "react";

// Adaptive hydration check-in surface (spec §4 + §5). Self-contained: fetches
// today's target from /api/hydration and renders, bottom-anchored, ONLY when
// something is relevant —
//   • a "target raised" banner (acknowledge once, anti-spam handled server-side), or
//   • the evening check-in (5 ordinal buttons + optional note), shown from the
//     configured check-in time until answered.
// Otherwise it renders nothing, keeping the home quiet.

interface RaisePayload {
  show: boolean;
  basisLabel: string;
  zielLabel: string;
  reason: string;
}

interface HydrationToday {
  basisLabel: string;
  hitzeMl: number;
  bewegungMl: number;
  zielMl: number;
  zielLabel: string;
  selfAssessment: number | null;
  checkinTime: string;
  raise: RaisePayload;
}

// Spec §4 — ordinal labels (1..5).
const LEVELS: { level: number; label: string }[] = [
  { level: 1, label: "Deutlich zu wenig" },
  { level: 2, label: "Etwas zu wenig" },
  { level: 3, label: "Etwa am Ziel" },
  { level: 4, label: "Reichlich" },
  { level: 5, label: "Sehr viel / drüber" },
];

function berlinHHMM(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

const CARD =
  "pointer-events-auto rounded-2xl bg-light-foreground px-5 py-4 text-light-text-on-dark shadow-light-float";

export default function HydrationCheckin() {
  const [data, setData] = useState<HydrationToday | null>(null);
  const [raiseDismissed, setRaiseDismissed] = useState(false);
  const [note, setNote] = useState("");
  const [savedLevel, setSavedLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/hydration")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HydrationToday | null) => {
        if (alive && d && !("error" in d)) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const ackRaise = useCallback(() => {
    setRaiseDismissed(true);
    fetch("/api/hydration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ackRaise" }),
    }).catch(() => {});
  }, []);

  const assess = useCallback(
    (level: number) => {
      if (busy) return;
      setBusy(true);
      setSavedLevel(level);
      fetch("/api/hydration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assess", level, notiz: note.trim() || undefined }),
      })
        .catch(() => {})
        .finally(() => setBusy(false));
    },
    [busy, note],
  );

  if (!data) return null;

  const alreadyAnswered = data.selfAssessment != null || savedLevel != null;
  const showRaise = data.raise.show && !raiseDismissed;
  const isEvening = berlinHHMM() >= data.checkinTime;
  const showCheckin = isEvening && !alreadyAnswered;

  if (savedLevel != null) {
    return (
      <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
        <div className={CARD}>
          <p className="font-fraunces text-lg">Notiert — danke.</p>
        </div>
      </div>
    );
  }

  if (!showRaise && !showCheckin) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 px-5 pb-3">
      {showRaise && (
        <div className={`${CARD} mb-2 flex items-start justify-between gap-3`}>
          <p className="text-sm leading-snug">
            <span className="font-fraunces text-base">Trinkziel heute angehoben</span>
            <br />
            {data.raise.basisLabel} → {data.raise.zielLabel}
            {data.raise.reason ? ` (${data.raise.reason})` : ""}
          </p>
          <button
            type="button"
            onClick={ackRaise}
            aria-label="Verstanden"
            className="shrink-0 rounded-full px-3 py-1 text-sm underline underline-offset-2"
          >
            ok
          </button>
        </div>
      )}

      {showCheckin && (
        <div className={CARD}>
          <p className="font-fraunces text-lg leading-tight">
            Dein Trinkziel heute: {data.zielLabel}
          </p>
          <p className="mt-0.5 text-xs opacity-70">
            Basis {data.basisLabel.replace("≈ ", "")}
            {data.hitzeMl > 0 ? ` + ${(data.hitzeMl / 1000).toFixed(1).replace(".", ",")} l Hitze` : ""}
            {data.bewegungMl > 0
              ? ` + ${(data.bewegungMl / 1000).toFixed(1).replace(".", ",")} l Bewegung`
              : ""}
          </p>
          <p className="mt-3 text-sm">Wie nah dran warst du?</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {LEVELS.map(({ level, label }) => (
              <button
                key={level}
                type="button"
                disabled={busy}
                onClick={() => assess(level)}
                className="rounded-xl border border-white/25 px-3 py-2 text-left text-sm transition active:scale-[0.99] hover:bg-white/10 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz (optional) — z. B. viel Kaffee"
            className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
