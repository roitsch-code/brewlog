"use client";
import { useEffect, useState } from "react";
import type { CafeSummary } from "@/lib/types/cafes";

function formatRelativeDate(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const d = new Date(ms);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.25 && rating % 1 < 0.75;
  return (
    <span className="font-mono-num text-brew-accent text-xs">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(5 - full - (half ? 1 : 0))}
      <span className="text-brew-muted ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function CafesPage() {
  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then(r => r.json())
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <h1 className="font-display text-3xl text-white leading-none">Café Visits</h1>
        {!loading && (
          <p className="text-brew-muted text-sm mt-1.5">
            {cafes.length === 0
              ? "No café visits yet"
              : `${cafes.length} café${cafes.length !== 1 ? "s" : ""} · ${cafes.reduce((s, c) => s + c.visits, 0)} visits`}
          </p>
        )}
      </div>

      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : cafes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {cafes.map(cafe => (
              <div key={cafe.name} className="bg-brew-surface border border-brew-border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium leading-tight truncate">{cafe.name}</p>
                    {cafe.location && (
                      <p className="text-brew-muted text-xs mt-0.5 truncate">{cafe.location}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-brew-muted text-xs">{formatRelativeDate(cafe.lastVisitedMs)}</p>
                    <p className="text-white/60 text-xs mt-0.5">
                      {cafe.visits} visit{cafe.visits !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {cafe.avgRating !== null && (
                  <div className="mt-2">
                    <Stars rating={cafe.avgRating} />
                  </div>
                )}

                {cafe.coffees.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cafe.coffees.map(name => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-brew-surface border border-brew-border flex items-center justify-center">
        <svg className="w-7 h-7 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </div>
      <div>
        <p className="text-white font-medium">No café visits yet</p>
        <p className="text-brew-muted text-sm mt-1 max-w-[240px]">
          Log a brew with &ldquo;Visit a café&rdquo; and it will appear here.
        </p>
      </div>
    </div>
  );
}
