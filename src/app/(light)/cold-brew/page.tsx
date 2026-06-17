"use client";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import {
  getActiveColdBrew,
  startColdBrew,
  cancelColdBrew,
  COLD_BREW_PRESETS,
  type ColdBrew,
} from "@/lib/coldBrew/coldBrew";

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "Ready";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ColdBrewPage() {
  const [active, setActive] = useState<ColdBrew | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coffeeName, setCoffeeName] = useState("");
  const [minutes, setMinutes] = useState(COLD_BREW_PRESETS[1].minutes); // 12h default
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActive(getActiveColdBrew());
    setNow(Date.now());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const remaining = active ? active.endMs - now : 0;
  const ready = active ? remaining <= 0 : false;
  const progress = active
    ? Math.min(1, Math.max(0, (now - active.startMs) / (active.endMs - active.startMs)))
    : 0;

  async function handleStart() {
    setBusy(true);
    const cb = await startColdBrew(coffeeName, minutes);
    setActive(cb);
    setNow(Date.now());
    setBusy(false);
  }

  async function handleClear() {
    setBusy(true);
    await cancelColdBrew();
    setActive(null);
    setCoffeeName("");
    setBusy(false);
  }

  return (
    <div className="min-h-full flex flex-col pb-8">
      <div
        className="px-5 pb-4 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <h1 className="font-fraunces text-3xl leading-none text-light-foreground">Cold Brew</h1>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark shadow-light-float active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 px-5">
        {!loaded ? null : active ? (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 p-6">
            <p className="text-light-muted-foreground text-xs tracking-widest uppercase mb-1">
              {ready ? "Ready" : "Steeping"}
            </p>
            <p className="font-fraunces text-2xl text-light-foreground leading-tight mb-5">
              {active.coffeeName || "Long steep"}
            </p>
            <p className="font-fraunces text-[44px] leading-none text-light-foreground mb-2 tabular-nums">
              {fmtRemaining(remaining)}
            </p>
            <p className="text-light-muted-foreground text-sm mb-5">
              {ready ? "Steep complete." : `Ready at ${fmtClock(active.endMs)}`}
            </p>
            <div className="h-1.5 rounded-full bg-light-foreground/15 overflow-hidden mb-6">
              <div
                className="h-full bg-light-foreground rounded-full transition-[width] duration-1000"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform"
            >
              {ready ? "Done" : "Cancel brew"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="text-light-muted-foreground text-xs tracking-widest uppercase">Coffee</label>
              <input
                value={coffeeName}
                onChange={(e) => setCoffeeName(e.target.value)}
                placeholder="What are you steeping?"
                className="mt-2 w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-3 text-light-foreground placeholder:text-light-muted-foreground outline-none"
                style={{ fontSize: "16px" }}
              />
            </div>
            <div>
              <label className="text-light-muted-foreground text-xs tracking-widest uppercase">Steep time</label>
              <div className="mt-2 flex gap-2">
                {COLD_BREW_PRESETS.map((p) => (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => setMinutes(p.minutes)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all ${
                      minutes === p.minutes
                        ? "bg-light-foreground text-light-text-on-dark"
                        : "bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 text-light-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={busy}
              className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform"
            >
              {busy ? "Starting…" : "Start steep"}
            </button>
            <p className="text-light-muted-foreground text-xs leading-relaxed">
              We&apos;ll remind you when it&apos;s ready — even if the app is closed.
            </p>
          </div>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
