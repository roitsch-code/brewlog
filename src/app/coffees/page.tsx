"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Coffee } from "@/lib/types/coffee";
import type { CoffeeIdentity } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";
import { useFlowStore } from "@/store/flowStore";

type Filter = "recent" | "favorites" | "roaster";

export default function CoffeesPage() {
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("recent");
  const router = useRouter();
  const { reset, setCoffee, setStep, setMode, setSkipScan } = useFlowStore();

  const brewThis = (coffee: Coffee) => {
    // Synthesize a CoffeeIdentity from the aggregate. roastLevel isn't stored
    // on the Coffee row — default to "Light" (matches the user's profile).
    // Downstream /recommend gets the rest from preferences + history.
    const identity: CoffeeIdentity = {
      roaster: coffee.roaster,
      name: coffee.name,
      origin: coffee.origin,
      process: coffee.process,
      roastLevel: "Light",
      roastDate: coffee.latestRoastDate,
      bagPhotoUrl: coffee.bagPhotoUrl,
      aiExtracted: false,
      coffeeId: coffee.id,
    };
    reset();
    setCoffee(identity);
    setMode("home");
    setSkipScan(true);
    setStep("context");
    router.push("/brew/new");
  };

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch("/api/coffees", { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then((data: Coffee[]) => {
          const sorted = [...data].sort((a, b) => (b.firstSeenAt || "").localeCompare(a.firstSeenAt || ""));
          setCoffees(sorted);
        })
        .catch(() => setError(true)),
      fetch("/api/sessions?count=true&mode=home", { cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then((d: { total: number } | null) => { if (d?.total != null) setTotalSessions(d.total); })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [retryCount]);

  const sessionTotal = totalSessions ?? coffees.reduce((s, c) => s + c.sessionCount, 0);
  const roasterCount = useMemo(() => new Set(coffees.map(c => c.roaster).filter(Boolean)).size, [coffees]);

  const filteredCoffees = useMemo(() => {
    let list = coffees;
    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.roaster?.toLowerCase().includes(q) ||
        c.origin?.toLowerCase().includes(q)
      );
    }
    // Category filter
    if (filter === "favorites") {
      list = [...list].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    } else if (filter === "roaster") {
      list = [...list].sort((a, b) => (a.roaster ?? "").localeCompare(b.roaster ?? ""));
    }
    // "recent" stays as-is — already sorted by firstSeenAt desc
    return list;
  }, [coffees, search, filter]);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "favorites", label: "Favorites" },
    { id: "roaster", label: "Roaster" },
  ];

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <Link href="/library" className="flex items-center gap-1 text-brew-muted text-sm mb-3 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Library
        </Link>
        <h1 className="font-display text-3xl text-white leading-none">Coffee Library</h1>
        {loading ? (
          <div className="h-4 w-48 bg-brew-surface rounded-full animate-pulse mt-2" />
        ) : !error && coffees.length > 0 ? (
          <p className="text-brew-muted text-sm mt-1.5">
            <span className="text-white">{sessionTotal.toLocaleString()}</span> sessions ·{" "}
            <span className="text-white">{coffees.length.toLocaleString()}</span> coffees ·{" "}
            <span className="text-white">{roasterCount.toLocaleString()}</span> roasters
          </p>
        ) : null}
      </div>

      {/* Search bar */}
      {!loading && !error && coffees.length > 0 && (
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2 px-1 py-2">
            <svg className="w-4 h-4 text-brew-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search coffees..."
              className="flex-1 bg-transparent text-white placeholder:text-brew-muted outline-none border-0 appearance-none"
              style={{ fontSize: "16px", WebkitAppearance: "none", boxShadow: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-brew-muted">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter row */}
      {!loading && !error && coffees.length > 0 && (
        <div className="px-5 mb-4 flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-brew-accent text-brew-accent-fg"
                  : "bg-brew-surface border border-brew-border text-brew-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <p className="font-display text-xl text-white">Couldn&apos;t load your library</p>
            <p className="text-brew-muted text-sm">Check your connection and try again.</p>
            <button onClick={() => setRetryCount(c => c + 1)} className="text-brew-accent text-sm underline">Retry</button>
          </div>
        ) : coffees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <svg className="w-12 h-12 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <p className="font-display text-xl text-white">No coffees yet</p>
            <p className="text-brew-muted text-sm">Coffees you scan will appear here.</p>
          </div>
        ) : filteredCoffees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <p className="text-brew-muted text-sm">No results for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredCoffees.map(coffee => {
              const sub = [coffee.origin, coffee.process].filter(Boolean).join(" · ");
              return (
                <div
                  key={coffee.id}
                  className="flex items-center gap-3 bg-brew-surface border border-brew-border rounded-2xl p-3 w-full"
                >
                  {/* Tap target — opens detail page */}
                  <button
                    type="button"
                    onClick={() => router.push(`/coffees/${coffee.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-brew-elevated shrink-0">
                      {coffee.bagPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coffee.bagPhotoUrl} alt={coffee.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                          </svg>
                        </div>
                      )}
                      {/* Session count badge */}
                      <div className="absolute top-0.5 right-0.5 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center">
                        <span className="text-white font-mono-num" style={{ fontSize: "8px" }}>{coffee.sessionCount}</span>
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
                      {coffee.latestRoastDate && (
                        <p className="text-brew-muted text-xs truncate mt-0.5">
                          Roasted {new Date(coffee.latestRoastDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {coffee.avgRating != null && coffee.avgRating > 0 && (
                        <div className="mt-1.5">
                          <StarRating value={coffee.avgRating} readonly size="sm" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Brew this — jumps to the brew context step with this coffee preloaded */}
                  <button
                    type="button"
                    onClick={() => brewThis(coffee)}
                    aria-label={`Brew ${coffee.name}`}
                    className="shrink-0 px-3 py-2 rounded-full text-xs font-medium bg-brew-accent text-brew-accent-fg active:scale-95 transition-transform"
                  >
                    Brew
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
