"use client";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import type { CafeSummary } from "@/lib/types/cafes";
import type { Session, CoffeeIdentity } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";

type Tab = "cafes" | "coffees" | "sessions";

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

interface CafeCoffee {
  key: string;
  coffee: CoffeeIdentity;
  cafes: string[];
  avgRating: number | null;
  visitCount: number;
}

function deriveCafeCoffees(sessions: Session[]): CafeCoffee[] {
  const map = new Map<string, { coffee: CoffeeIdentity; cafes: Set<string>; ratingSum: number; ratedCount: number; visitCount: number }>();
  for (const s of sessions) {
    if (!s.coffee?.name) continue;
    const key = `${s.coffee.roaster}__${s.coffee.name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const entry = map.get(key);
    const cafeName = s.place?.name ?? "";
    const rating = s.result?.rating;
    if (entry) {
      entry.visitCount++;
      if (cafeName) entry.cafes.add(cafeName);
      if (rating) { entry.ratingSum += rating; entry.ratedCount++; }
    } else {
      map.set(key, {
        coffee: s.coffee,
        cafes: cafeName ? new Set([cafeName]) : new Set(),
        ratingSum: rating ?? 0,
        ratedCount: rating ? 1 : 0,
        visitCount: 1,
      });
    }
  }
  return Array.from(map.entries()).map(([key, v]) => ({
    key,
    coffee: v.coffee,
    cafes: Array.from(v.cafes),
    avgRating: v.ratedCount > 0 ? Math.round((v.ratingSum / v.ratedCount) * 10) / 10 : null,
    visitCount: v.visitCount,
  }));
}

export default function CafesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("cafes");

  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [cafesLoading, setCafesLoading] = useState(true);

  const [externalSessions, setExternalSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsFetched, setSessionsFetched] = useState(false);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then(r => r.json())
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCafesLoading(false));
  }, []);

  useEffect(() => {
    if ((activeTab === "coffees" || activeTab === "sessions") && !sessionsFetched) {
      setSessionsLoading(true);
      fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
        .then(r => r.json())
        .then((data: Session[]) => setExternalSessions(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => { setSessionsLoading(false); setSessionsFetched(true); });
    }
  }, [activeTab, sessionsFetched]);

  const cafeCoffees = useMemo(() => deriveCafeCoffees(externalSessions), [externalSessions]);

  const totalVisits = cafes.reduce((sum: number, cafe: CafeSummary) => sum + cafe.visits, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: "cafes", label: "Cafés" },
    { id: "coffees", label: "Coffees" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <h1 className="font-display text-3xl text-white leading-none">Café Library</h1>
        {!cafesLoading && (
          <p className="text-brew-muted text-sm mt-1.5">
            {cafes.length === 0
              ? "No café visits yet"
              : `${cafes.length} café${cafes.length !== 1 ? "s" : ""} · ${totalVisits} visit${totalVisits !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-5 mb-4 flex gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === t.id
                ? "bg-brew-accent text-brew-accent-fg"
                : "bg-brew-surface border border-brew-border text-brew-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5">
        {activeTab === "cafes" && (
          <CafesTab cafes={cafes} loading={cafesLoading} />
        )}
        {activeTab === "coffees" && (
          <CoffeesTab coffees={cafeCoffees} loading={sessionsLoading} />
        )}
        {activeTab === "sessions" && (
          <SessionsTab sessions={externalSessions} loading={sessionsLoading} />
        )}
      </div>
    </div>
  );
}

/* ── Cafés tab ─────────────────────────────────────────────── */

function CafesTab({ cafes, loading }: { cafes: CafeSummary[]; loading: boolean }) {
  if (loading) return <LoadingSkeletons />;
  if (cafes.length === 0) return (
    <EmptyState
      icon={<LocationIcon />}
      title="No café visits yet"
      body={'Log a brew with "Visit a café" and it will appear here.'}
    />
  );

  return (
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
              <StarRating value={cafe.avgRating} readonly size="sm" />
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
  );
}

/* ── Coffees tab ───────────────────────────────────────────── */

function CoffeesTab({ coffees, loading }: { coffees: CafeCoffee[]; loading: boolean }) {
  if (loading) return <LoadingSkeletons />;
  if (coffees.length === 0) return (
    <EmptyState
      icon={<CoffeeIcon />}
      title="No coffees yet"
      body="Coffees you try at cafés will appear here."
    />
  );

  return (
    <div className="flex flex-col gap-2">
      {coffees.map(({ key, coffee, cafes, avgRating, visitCount }) => {
        const sub = [coffee.origin, coffee.process].filter(Boolean).join(" · ");
        return (
          <div
            key={key}
            className="flex items-center gap-3 bg-brew-surface border border-brew-border rounded-2xl p-3"
          >
            {/* Placeholder thumbnail */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-brew-elevated shrink-0">
              {coffee.bagPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coffee.bagPhotoUrl} alt={coffee.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CoffeeIcon className="w-6 h-6 text-brew-muted" />
                </div>
              )}
              <div className="absolute top-0.5 right-0.5 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center">
                <span className="text-white font-mono-num" style={{ fontSize: "8px" }}>{visitCount}</span>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {coffee.roaster && (
                <p className="text-brew-muted text-xs truncate mb-0.5">{coffee.roaster}</p>
              )}
              <p className="text-white text-sm font-medium leading-snug truncate">{coffee.name}</p>
              {sub && (
                <p className="text-brew-muted text-xs truncate mt-0.5">{sub}</p>
              )}
              {cafes.length > 0 && (
                <p className="text-brew-muted text-xs truncate mt-0.5">
                  {cafes.slice(0, 2).join(", ")}
                </p>
              )}
              {avgRating != null && avgRating > 0 && (
                <div className="mt-1.5">
                  <StarRating value={avgRating} readonly size="sm" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sessions tab ──────────────────────────────────────────── */

function SessionsTab({ sessions, loading }: { sessions: Session[]; loading: boolean }) {
  if (loading) return <LoadingSkeletons />;
  if (sessions.length === 0) return (
    <EmptyState
      icon={<LocationIcon />}
      title="No sessions yet"
      body={'Log a brew with "Visit a café" and it will appear here.'}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {sessions.map(s => {
        const method = s.place?.methodServed || s.brew?.methodUsed;
        const createdAtMs = typeof s.createdAt === "string" ? new Date(s.createdAt).getTime() : Date.now();
        return (
          <div key={s.id} className="bg-brew-surface border border-brew-border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {s.place?.name && (
                  <p className="text-brew-accent text-xs font-medium truncate mb-0.5">{s.place.name}</p>
                )}
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
                <p className="text-brew-muted text-xs">{formatRelativeDate(createdAtMs)}</p>
                {s.result?.rating != null && s.result.rating > 0 && (
                  <div className="mt-1">
                    <StarRating value={s.result.rating} readonly size="sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Partial brew info */}
            {(method || s.place?.location) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {method && (
                  <span className="text-xs text-brew-muted border border-brew-border rounded-lg px-2 py-0.5">
                    {method}
                  </span>
                )}
                {s.place?.location && (
                  <span className="text-xs text-brew-muted border border-brew-border rounded-lg px-2 py-0.5">
                    {s.place.location}
                  </span>
                )}
              </div>
            )}

            {/* Flavor notes */}
            {s.result?.flavorNotes && s.result.flavorNotes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.result.flavorNotes.slice(0, 3).map(note => (
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
  );
}

/* ── Shared helpers ────────────────────────────────────────── */

function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-28 rounded-2xl bg-brew-surface animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-brew-surface border border-brew-border flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-white font-medium">{title}</p>
        <p className="text-brew-muted text-sm mt-1 max-w-[240px]">{body}</p>
      </div>
    </div>
  );
}

function LocationIcon({ className = "w-7 h-7 text-brew-muted" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function CoffeeIcon({ className = "w-7 h-7 text-brew-muted" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  );
}
