"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Coffee } from "@/lib/types/coffee";
import type { Session } from "@/lib/types/session";
import SessionCard from "@/components/session/SessionCard";
import StarRating from "@/components/ui/StarRating";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

export default function CoffeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const coffeeRes = await fetch(`/api/coffees/${id}`, { cache: "no-store" });
        if (!coffeeRes.ok) { setLoading(false); return; }
        const found: Coffee = await coffeeRes.json();
        setCoffee(found);

        if (found?.sessionIds?.length) {
          // Fetch all sessions and filter by IDs (avoids needing a separate endpoint)
          const sessRes = await fetch(`/api/sessions?limit=200`, { cache: "no-store" });
          const allSessions: Session[] = sessRes.ok ? await sessRes.json() : [];
          const idSet = new Set(found.sessionIds);
          setSessions(allSessions.filter(s => idSet.has(s.id)));
        }
      } catch {
        // fail silently — show "not found"
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col">
        <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
          <button onClick={() => router.push("/coffees")} className="text-brew-muted text-sm">← Library</button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
      </div>
    );
  }

  if (!coffee) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center gap-4">
        <p className="text-brew-muted">Coffee not found</p>
        <button onClick={() => router.push("/coffees")} className="text-white underline">Back to library</button>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Hero */}
      <div className="relative">
        {coffee.bagPhotoUrl ? (
          <div className="relative h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coffee.bagPhotoUrl} alt={coffee.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 card-scrim" />
          </div>
        ) : (
          <div className="h-40 bg-brew-surface flex items-center justify-center">
            <svg className="w-12 h-12 text-brew-muted opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a3.75 3.75 0 01-3.75 3.75H7.95A3.75 3.75 0 014.2 15m15.6 0H4.2m15.6 0H4.2" />
            </svg>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => router.push("/coffees")}
          className="absolute left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Title overlay */}
        <div className={`${coffee.bagPhotoUrl ? "absolute bottom-0 left-0 right-0" : ""} p-5`}>
          {coffee.process && (
            <p className="text-brew-muted text-xs tracking-widest uppercase mb-1">{coffee.process}</p>
          )}
          <h1 className="font-display text-3xl text-white">{coffee.name}</h1>
          <p className="text-white/60 text-sm mt-1">{coffee.roaster}{coffee.origin ? ` · ${coffee.origin}` : ""}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 flex items-center gap-6 border-b border-brew-border">
        <div className="text-center">
          <p className="font-mono-num text-2xl text-white font-medium">{coffee.sessionCount}</p>
          <p className="text-brew-muted text-xs uppercase tracking-widest mt-0.5">Brew{coffee.sessionCount !== 1 ? "s" : ""}</p>
        </div>
        {coffee.avgRating != null && coffee.avgRating > 0 && (
          <div className="flex flex-col items-center">
            <StarRating value={coffee.avgRating} readonly size="sm" />
            <p className="text-brew-muted text-xs uppercase tracking-widest mt-1">Avg Rating</p>
          </div>
        )}
        {coffee.bestMethod && (
          <div className="text-center">
            <p className="text-white text-sm font-medium">{coffee.bestMethod}</p>
            <p className="text-brew-muted text-xs uppercase tracking-widest mt-0.5">Best Method</p>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="px-5 py-5 flex flex-col gap-4 pb-safe pb-8">
        <p className="text-brew-muted text-xs uppercase tracking-widest">All Brews</p>
        {sessions.length === 0 ? (
          <p className="text-brew-muted text-sm">No sessions found.</p>
        ) : (
          sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onDeleted={(id) => setSessions(prev => prev.filter(x => x.id !== id))}
            />
          ))
        )}
      </div>
    </div>
  );
}
