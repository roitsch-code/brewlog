"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";

function formatRelativeDate(iso: string): string {
  const ms = new Date(iso).getTime();
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function toCoffeeKey(roaster: string, name: string): string {
  return `${roaster}__${name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export default function CafeCoffeeDetailPage() {
  const params = useParams();
  const coffeeKey = params.id as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
      .then(r => r.json())
      .then((data: Session[]) => {
        const filtered = Array.isArray(data)
          ? data.filter(s => s.coffee?.name && toCoffeeKey(s.coffee.roaster ?? "", s.coffee.name) === coffeeKey)
          : [];
        setSessions(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coffeeKey]);

  const coffee = sessions[0]?.coffee;
  const avgRating = sessions.length > 0
    ? (() => {
        const rated = sessions.filter((s: Session) => s.result?.rating);
        if (rated.length === 0) return null;
        return Math.round(rated.reduce((sum: number, x: Session) => sum + (x.result?.rating ?? 0), 0) / rated.length * 10) / 10;
      })()
    : null;

  const uniqueCafes = Array.from(new Set(
    (sessions.map((s: Session) => s.place?.name) as (string | undefined)[]).filter((n): n is string => Boolean(n))
  ));
  const sub = coffee ? [coffee.origin, coffee.process].filter(Boolean).join(" · ") : "";

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <Link href="/cafes?tab=coffees" className="flex items-center gap-1 text-brew-muted text-sm mb-3 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Coffees
        </Link>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-48 bg-brew-surface rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-brew-surface rounded-full animate-pulse" />
          </div>
        ) : coffee ? (
          <>
            {coffee.roaster && (
              <p className="text-brew-muted text-sm mb-0.5">{coffee.roaster}</p>
            )}
            <h1 className="font-display text-3xl text-white leading-none">{coffee.name}</h1>
            {sub && <p className="text-brew-muted text-sm mt-1">{sub}</p>}
            <p className="text-brew-muted text-sm mt-1.5">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              {avgRating != null && (
                <> · <span className="text-white">{avgRating.toFixed(1)}</span> avg</>
              )}
            </p>
          </>
        ) : (
          <h1 className="font-display text-3xl text-white leading-none">Coffee</h1>
        )}

        {/* Cafés that served it */}
        {uniqueCafes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {uniqueCafes.map(name => (
              <span
                key={name}
                className="text-xs text-brew-muted border border-brew-border rounded-lg px-2 py-0.5"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3">
            <p className="text-white font-medium">No sessions found</p>
            <p className="text-brew-muted text-sm">Could not find sessions for this coffee.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s: Session) => {
              const method = s.place?.methodServed || s.brew?.methodUsed;
              return (
                <div key={s.id} className="bg-brew-surface border border-brew-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {s.place?.name && (
                        <p className="text-brew-accent text-xs font-medium truncate mb-0.5">{s.place.name}</p>
                      )}
                      {s.place?.location && (
                        <p className="text-brew-muted text-xs truncate">{s.place.location}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-brew-muted text-xs">{formatRelativeDate(s.createdAt)}</p>
                      {s.result?.rating != null && s.result.rating > 0 && (
                        <div className="mt-1">
                          <StarRating value={s.result.rating} readonly size="sm" />
                        </div>
                      )}
                    </div>
                  </div>

                  {method && (
                    <div className="mt-2">
                      <span className="text-xs text-brew-muted border border-brew-border rounded-lg px-2 py-0.5">
                        {method}
                      </span>
                    </div>
                  )}

                  {s.result?.flavorNotes && s.result.flavorNotes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.result.flavorNotes.slice(0, 3).map((note: string) => (
                        <span
                          key={note}
                          className="text-xs text-brew-muted border border-brew-border rounded-lg px-2 py-0.5"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
