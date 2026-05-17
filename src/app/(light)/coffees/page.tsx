"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import type { Coffee } from "@/lib/types/coffee";
import type { CoffeeIdentity } from "@/lib/types/session";
import StarRating from "@/components/ui/light/StarRating";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { reset, setCoffee, setStep, setMode, setSkipScan, setFieldZones } = useFlowStore();

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
    // Generative Field v1.1 — lift this coffee's persisted Field
    // composition for the Brew Again flow.
    setFieldZones(coffee.fieldZones ?? null);
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
    <div className="min-h-full bg-transparent flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-fraunces text-3xl leading-none text-light-foreground">Coffee Library</h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150 active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        {loading ? (
          <div className="h-4 w-48 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 rounded-full animate-pulse mt-2" />
        ) : !error && coffees.length > 0 ? (
          <p className="text-light-muted-foreground text-sm">
            <span className="text-light-foreground">{sessionTotal.toLocaleString()}</span> sessions ·{" "}
            <span className="text-light-foreground">{coffees.length.toLocaleString()}</span> coffees ·{" "}
            <span className="text-light-foreground">{roasterCount.toLocaleString()}</span> roasters
          </p>
        ) : null}
      </div>

      {/* Search bar */}
      {!loading && !error && coffees.length > 0 && (
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2 px-1 py-2">
            <svg className="w-4 h-4 text-light-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search coffees..."
              className="flex-1 bg-transparent text-light-foreground placeholder:text-light-muted-foreground outline-none border-0 appearance-none"
              style={{ fontSize: "16px", WebkitAppearance: "none", boxShadow: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-light-muted-foreground">
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
                  ? "bg-light-foreground text-[hsl(36_55%_96%)]"
                  : "bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 text-light-muted-foreground"
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
              <div key={i} className="h-20 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <p className="font-fraunces text-xl text-light-foreground">Couldn&apos;t load your library</p>
            <p className="text-light-muted-foreground text-sm">Check your connection and try again.</p>
            <button onClick={() => setRetryCount(c => c + 1)} className="text-light-foreground text-sm underline">Retry</button>
          </div>
        ) : coffees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <svg className="w-12 h-12 text-light-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <p className="font-fraunces text-xl text-light-foreground">No coffees yet</p>
            <p className="text-light-muted-foreground text-sm">Coffees you scan will appear here.</p>
          </div>
        ) : filteredCoffees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <p className="text-light-muted-foreground text-sm">No results for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredCoffees.map(coffee => {
              const sub = [coffee.origin, coffee.process].filter(Boolean).join(" · ");
              const brewCount = coffee.sessionCount;
              const brewLabel = brewCount > 0 ? `${brewCount} brew${brewCount === 1 ? "" : "s"}` : null;
              return (
                <div
                  key={coffee.id}
                  className="flex items-stretch bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl overflow-hidden w-full"
                >
                  {/* Tap target — opens detail page. Full-card click area
                      uses items-stretch so the photo fills the left edge
                      flush with the card border, no padding gap. */}
                  <button
                    type="button"
                    onClick={() => router.push(`/coffees/${coffee.id}`)}
                    className="flex items-stretch flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
                  >
                    {/* Photo — full-height left strip (w-24 = 96px).
                        Bag photos are portrait-ish; this gives more of
                        the label visible than a 56px circular thumb. */}
                    <div className="relative w-24 shrink-0 bg-light-card-default">
                      {coffee.bagPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coffee.bagPhotoUrl} alt={coffee.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-7 h-7 text-light-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0 px-3.5 py-3">
                      {coffee.roaster && (
                        <p className="text-light-muted-foreground text-xs truncate mb-0.5">{coffee.roaster}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {coffee.inRotation && (
                          <svg
                            className="w-3.5 h-3.5 shrink-0 text-light-foreground"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-label="In rotation"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        )}
                        <p className="text-light-foreground text-sm font-medium leading-snug truncate">{coffee.name}</p>
                      </div>
                      {sub && (
                        <p className="text-light-muted-foreground text-xs truncate mt-0.5">{sub}</p>
                      )}
                      {coffee.latestRoastDate && (
                        <p className="text-light-muted-foreground text-xs truncate mt-0.5">
                          Roasted {new Date(coffee.latestRoastDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {/* Rating row — brew count moved to the right
                          column above the Brew CTA so the two pieces of
                          meta about the same coffee live together. */}
                      {coffee.avgRating != null && coffee.avgRating > 0 && (
                        <div className="mt-1.5">
                          <StarRating value={coffee.avgRating} readonly size="sm" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Right column: brew-count meta over the Brew CTA.
                      Renders even when the coffee is not in rotation —
                      count still shows, button just hides. */}
                  {(brewLabel || coffee.inRotation) && (
                    <div className="flex flex-col items-center justify-center gap-1.5 pr-3 shrink-0">
                      {brewLabel && (
                        <span className="text-light-muted-foreground text-[11px] whitespace-nowrap">{brewLabel}</span>
                      )}
                      {coffee.inRotation && (
                        <button
                          type="button"
                          onClick={() => brewThis(coffee)}
                          aria-label={`Brew ${coffee.name}`}
                          className="shrink-0 px-3 py-2 rounded-full text-xs font-medium bg-light-foreground text-[hsl(36_55%_96%)] active:scale-95 transition-transform"
                        >
                          Brew
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
