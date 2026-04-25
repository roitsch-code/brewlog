"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@/lib/types/session";
import type { CoffeeIdentity } from "@/lib/types/session";
import SessionCard from "@/components/session/SessionCard";
import { useFlowStore } from "@/store/flowStore";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

function getRecentUniqueCoffees(sessions: Session[], limit = 6): CoffeeIdentity[] {
  const seen = new Set<string>();
  const result: CoffeeIdentity[] = [];
  for (const s of sessions) {
    if (!s.coffee?.name) continue;
    const key = `${s.coffee.roaster}__${s.coffee.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s.coffee);
    }
    if (result.length >= limit) break;
  }
  return result;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { reset, setCoffee, setStep, setMode, setSkipScan } = useFlowStore();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    Promise.all([
      fetch("/api/sessions?limit=15", { cache: "no-store", signal: controller.signal })
        .then(r => r.json())
        .then((data: Session[]) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => setSessions([])),
      fetch("/api/sessions?count=true", { cache: "no-store", signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then((data: { total: number } | null) => { if (data?.total != null) setTotalSessions(data.total); })
        .catch(() => {}),
    ]).finally(() => { clearTimeout(timer); setLoading(false); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  const recentCoffees = getRecentUniqueCoffees(sessions, 6);

  const brewAgain = (coffee: CoffeeIdentity) => {
    reset();
    setCoffee(coffee);
    setMode("home");
    setSkipScan(true);
    setStep("context");
    router.push("/brew/new");
  };

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div>
          <p className="text-brew-muted text-sm mb-0.5">{getGreeting()}</p>
          <h1 className="font-display text-3xl text-white leading-none">
            Welcome to <span style={{ color: "var(--primary)" }}>BrewLog</span>
          </h1>
          <p className="text-brew-muted text-sm mt-1.5">
            {loading ? "\u00A0" : (totalSessions ?? sessions.length) > 0
              ? `${totalSessions ?? sessions.length} session${(totalSessions ?? sessions.length) !== 1 ? "s" : ""} logged`
              : "Your coffee diary"}
          </p>
        </div>
      </div>

      {/* Brew Again — horizontal scroll carousel */}
      {!loading && recentCoffees.length > 0 && (
        <div className="mb-6">
          <p className="label-mono text-brew-muted px-5 mb-3">Brew Again</p>
          <div
            className="flex gap-3 overflow-x-auto"
            style={{ paddingLeft: "1.25rem", paddingRight: "1.25rem", scrollbarWidth: "none" }}
          >
            {recentCoffees.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => brewAgain(c)}
                className="shrink-0 w-36 bg-brew-surface border border-brew-border rounded-2xl px-3 py-3 text-left active:scale-95 transition-transform"
              >
                {c.roaster && (
                  <p className="text-brew-muted text-xs mb-1 truncate">{c.roaster}</p>
                )}
                <p className="text-white text-sm font-medium leading-tight line-clamp-2">{c.name}</p>
                {c.origin && (
                  <p className="text-brew-muted text-xs mt-1 truncate">{c.origin}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Café Visits shortcut */}
      <div className="px-5 mb-5">
        <Link
          href="/cafes"
          className="flex items-center justify-between w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brew-elevated flex items-center justify-center">
              <svg className="w-4 h-4 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <span className="text-white text-sm font-medium">Café Visits</span>
          </div>
          <svg className="w-4 h-4 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* Recent Brews */}
      <div className="flex-1 px-5">
        {!loading && sessions.length > 0 && (
          <p className="label-mono text-brew-muted mb-3">Recent Brews</p>
        )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.slice(0, 5).map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  const router = useRouter();
  const reset = useFlowStore(s => s.reset);
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-6">
      <CoffeeBeanGlow size={80} />
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Start your first brew</h2>
        <p className="text-brew-muted text-sm max-w-[260px]">Scan a coffee bag, get a recipe recommendation, and document your results.</p>
      </div>
      <button
        type="button"
        onClick={() => { reset(); router.push("/brew/new"); }}
        className="h-[52px] px-8 rounded-xl bg-brew-accent text-brew-accent-fg font-semibold text-base active:scale-95 transition-transform"
      >
        Brew your first cup
      </button>
    </div>
  );
}
