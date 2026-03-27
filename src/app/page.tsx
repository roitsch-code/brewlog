"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types/session";
import type { CoffeeIdentity } from "@/lib/types/session";
import SessionCard from "@/components/session/SessionCard";
import { useFlowStore } from "@/store/flowStore";
import TopMenu from "@/components/layout/TopMenu";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

function getRecentUniqueCoffees(sessions: Session[], limit = 3): CoffeeIdentity[] {
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

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { reset, setCoffee, setMode, setStep } = useFlowStore();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch("/api/sessions?limit=20", { cache: "no-store", signal: controller.signal })
      .then(r => r.json())
      .then((data: Session[]) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => { clearTimeout(timer); setLoading(false); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  const recentCoffees = getRecentUniqueCoffees(sessions, 4);

  const brewAgain = (coffee: CoffeeIdentity) => {
    reset();
    setMode("home");
    setCoffee(coffee);
    setStep("context");
    router.push("/brew/new");
  };

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl text-white leading-none">BrewLog</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/BrewLog.png" alt="" aria-hidden="true" width={25} height={30} style={{ objectFit: "contain" }} />
          </div>
          <p className="text-brew-muted text-sm mt-1">
            {sessions.length > 0 ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""}` : "Your coffee diary"}
          </p>
        </div>
        <TopMenu />
      </div>

      {/* Recent coffees — quick brew (2×2 grid) */}
      {!loading && recentCoffees.length > 0 && (
        <div className="px-5 mb-5">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-3">Brew again</p>
          <div className="grid grid-cols-2 gap-3">
            {recentCoffees.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => brewAgain(c)}
                className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-left active:scale-95 transition-all"
              >
                {c.roaster && <p className="text-brew-muted text-xs mb-1 truncate">{c.roaster}</p>}
                <p className="text-white text-sm font-medium leading-tight line-clamp-2">{c.name}</p>
                {(c.origin || c.process) && (
                  <p className="text-brew-muted text-xs mt-0.5 truncate">
                    {[c.origin, c.process].filter(Boolean).join(" – ")}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session feed — last 3 */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.slice(0, 3).map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </div>

    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-6">
      <CoffeeBeanGlow size={80} />
      <div>
        <h2 className="font-display text-2xl text-white mb-2">Start your first brew</h2>
        <p className="text-brew-muted text-sm max-w-[260px]">Scan a coffee bag, get a recipe recommendation, and document your results.</p>
      </div>
    </div>
  );
}
