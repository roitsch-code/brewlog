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

export default function CafeDetailPage() {
  const params = useParams();
  const cafeName = decodeURIComponent(params.slug as string);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
      .then(r => r.json())
      .then((data: Session[]) => {
        const filtered = Array.isArray(data)
          ? data.filter(s => s.place?.name === cafeName)
          : [];
        setSessions(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cafeName]);

  const location = sessions[0]?.place?.location;
  const avgRating = sessions.length > 0
    ? (() => {
        const rated = sessions.filter((s: Session) => s.result?.rating);
        if (rated.length === 0) return null;
        return Math.round(rated.reduce((sum: number, x: Session) => sum + (x.result?.rating ?? 0), 0) / rated.length * 10) / 10;
      })()
    : null;

  const mapsUrl = location
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${cafeName} ${location}`)}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(cafeName)}`;

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <Link href="/cafes" className="flex items-center gap-1 text-brew-muted text-sm mb-3 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Cafés
        </Link>
        <h1 className="font-display text-3xl text-white leading-none">{cafeName}</h1>
        {location && (
          <p className="text-brew-muted text-sm mt-1">{location}</p>
        )}

        {/* Stats + Open in Maps */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {!loading && sessions.length > 0 && (
            <p className="text-brew-muted text-sm">
              {sessions.length} visit{sessions.length !== 1 ? "s" : ""}
              {avgRating != null && (
                <>
                  {" · "}
                  <span className="text-white">{avgRating.toFixed(1)}</span> avg
                </>
              )}
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 bg-brew-surface border border-brew-border rounded-full text-xs text-brew-muted active:scale-95 transition-transform"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Open in Maps
          </a>
        </div>
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
            <p className="text-brew-muted text-sm">No visits logged for this café.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s: Session) => {
              const method = s.place?.methodServed || s.brew?.methodUsed;
              return (
                <div key={s.id} className="bg-brew-surface border border-brew-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {s.coffee?.name && (
                        <>
                          {s.coffee.roaster && (
                            <p className="text-brew-muted text-xs truncate">{s.coffee.roaster}</p>
                          )}
                          <p className="text-white text-sm font-medium leading-snug truncate">{s.coffee.name}</p>
                        </>
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
