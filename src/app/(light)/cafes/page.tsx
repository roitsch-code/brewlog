"use client";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import type { CafeSummary } from "@/lib/types/cafes";
import type { Session, CoffeeIdentity } from "@/lib/types/session";
import StarRating from "@/components/ui/light/StarRating";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";

type Tab = "cafes" | "coffees";

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
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "coffees" ? "coffees" : "cafes";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

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
    if (activeTab === "coffees" && !sessionsFetched) {
      setSessionsLoading(true);
      fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
        .then(r => r.json())
        .then((data: Session[]) => setExternalSessions(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => { setSessionsLoading(false); setSessionsFetched(true); });
    }
  }, [activeTab, sessionsFetched]);

  const cafeCoffees = useMemo(() => deriveCafeCoffees(externalSessions), [externalSessions]);
  const totalVisits = cafes.reduce((sum, cafe) => sum + cafe.visits, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: "cafes", label: "Cafés" },
    { id: "coffees", label: "Coffees" },
  ];

  return (
    <div className="min-h-full bg-transparent flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-fraunces text-3xl leading-none text-light-foreground">Café Library</h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-light-card backdrop-saturate-150 active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        {!cafesLoading && (
          <p className="text-light-muted-foreground text-sm">
            {cafes.length === 0
              ? "No café visits yet"
              : <>
                  <span className="text-light-foreground">{cafes.length.toLocaleString()}</span> café{cafes.length !== 1 ? "s" : ""} ·{" "}
                  <span className="text-light-foreground">{totalVisits.toLocaleString()}</span> visit{totalVisits !== 1 ? "s" : ""}
                </>}
          </p>
        )}
      </div>

      {/* Tab bar — matches the filter-pill style on /coffees */}
      <div className="px-5 mb-4 flex gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === t.id
                ? "bg-light-foreground text-light-text-on-dark"
                : "bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 text-light-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5">
        {activeTab === "cafes" && (
          <CafesTab cafes={cafes} loading={cafesLoading} onSelect={cafe => router.push(`/cafes/place/${encodeURIComponent(cafe.name)}`)} />
        )}
        {activeTab === "coffees" && (
          <CoffeesTab
            coffees={cafeCoffees}
            loading={sessionsLoading}
            onSelect={(key, coffeeId) => {
              // Prefer the Coffee Library detail page when the bag has
              // a library row (coffeeId set on the persisted CoffeeIdentity).
              // Falls back to the cafe-only synthetic detail for coffees
              // that were tasted out but never logged at home.
              if (coffeeId) router.push(`/coffees/${coffeeId}`);
              else router.push(`/cafes/coffee/${key}`);
            }}
          />
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

/* ── Cafés tab ─────────────────────────────────────────────── */

function CafesTab({ cafes, loading, onSelect }: { cafes: CafeSummary[]; loading: boolean; onSelect: (cafe: CafeSummary) => void }) {
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
        <button
          key={cafe.name}
          type="button"
          onClick={() => onSelect(cafe)}
          className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-light-foreground font-medium leading-tight truncate">{cafe.name}</p>
              {cafe.location && (
                <p className="text-light-muted-foreground text-xs mt-0.5 truncate">{cafe.location}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-light-muted-foreground text-xs">{formatRelativeDate(cafe.lastVisitedMs)}</p>
              <p className="text-light-foreground/70 text-xs mt-0.5">
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
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Coffees tab — Coffee-Library-style cards with full-bleed photo on left ── */

function CoffeesTab({ coffees, loading, onSelect }: { coffees: CafeCoffee[]; loading: boolean; onSelect: (key: string, coffeeId: string | undefined) => void }) {
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
        const cafeLine = cafes.slice(0, 2).join(", ");
        const visitLabel = `${visitCount} tasting${visitCount === 1 ? "" : "s"}`;
        return (
          <div
            key={key}
            className="flex items-stretch bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl overflow-hidden w-full"
          >
            <button
              type="button"
              onClick={() => onSelect(key, coffee.coffeeId)}
              className="flex items-stretch flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
            >
              {/* Photo strip — full card height, same dimensions as the
                  coffee library card. */}
              <div className="relative w-24 shrink-0 bg-light-card-default">
                {coffee.bagPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coffee.bagPhotoUrl} alt={coffee.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CoffeeIcon className="w-7 h-7 text-light-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 px-3.5 py-3">
                {coffee.roaster && (
                  <p className="text-light-muted-foreground text-xs truncate mb-0.5">{coffee.roaster}</p>
                )}
                <p className="text-light-foreground text-sm font-medium leading-snug truncate">{coffee.name}</p>
                {sub && (
                  <p className="text-light-muted-foreground text-xs truncate mt-0.5">{sub}</p>
                )}
                {cafeLine && (
                  <p className="text-light-muted-foreground text-xs truncate mt-0.5">{cafeLine}</p>
                )}
                {avgRating != null && avgRating > 0 && (
                  <div className="mt-1.5">
                    <StarRating value={avgRating} readonly size="sm" />
                  </div>
                )}
              </div>
            </button>

            {/* Right column: tasting count. No Brew CTA — these are
                cafe coffees, not in the user's brewing rotation. */}
            <div className="flex flex-col items-center justify-center pr-3 shrink-0">
              <span className="text-light-muted-foreground text-[11px] whitespace-nowrap">{visitLabel}</span>
            </div>
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
        <div key={i} className="h-28 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-light-foreground font-medium">{title}</p>
        <p className="text-light-muted-foreground text-sm mt-1 max-w-[240px]">{body}</p>
      </div>
    </div>
  );
}

function LocationIcon({ className = "w-7 h-7 text-light-muted-foreground" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function CoffeeIcon({ className = "w-7 h-7 text-light-muted-foreground" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  );
}
