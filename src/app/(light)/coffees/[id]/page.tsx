"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import type { Coffee } from "@/lib/types/coffee";
import type { Session, CoffeeIdentity } from "@/lib/types/session";
import SessionCard from "@/components/session/SessionCard";
import StarRating from "@/components/ui/light/StarRating";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import { useFieldConfig } from "@/lib/field/FieldContext";
import { rememberSessionField } from "@/lib/field/cache";
import { useOnline } from "@/hooks/useOnline";
import { startBrewAgain, startBrewAgainOffline } from "@/lib/flow/brewAgain";
import {
  cacheBrewableCoffee,
  getBrewableCoffee,
  type BrewableCoffee,
  type BrewableRecipe,
} from "@/lib/storage/offlineLibrary";

interface RoasterInfo {
  region?: string;
  styleSummary?: string;
  notes?: string;
  confidence?: string;
}

export default function CoffeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [roasterInfo, setRoasterInfo] = useState<RoasterInfo | null>(null);
  const [roasterGenerating, setRoasterGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offlineCoffee, setOfflineCoffee] = useState<BrewableCoffee | null>(null);
  const router = useRouter();
  const online = useOnline();

  // Personal notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      // Offline — render this coffee from the local re-brew cache.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const cached = await getBrewableCoffee(id);
        setOfflineCoffee(cached);
        setLoading(false);
        return;
      }
      try {
        const coffeeRes = await fetch(`/api/coffees/${id}`, { cache: "no-store" });
        if (!coffeeRes.ok) { setLoading(false); return; }
        const found: Coffee = await coffeeRes.json();
        setCoffee(found);

        // Fetch roaster info and sessions in parallel
        await Promise.all([
          found.roaster
            ? (async () => {
                try {
                  const r = await fetch(`/api/roasters?name=${encodeURIComponent(found.roaster)}`, { cache: "no-store" });
                  if (r.ok) {
                    const data: RoasterInfo = await r.json();
                    if (data?.styleSummary) { setRoasterInfo(data); return; }
                  }
                  // Not in static list or Firestore — generate on-demand
                  setRoasterGenerating(true);
                  const gen = await fetch("/api/roasters/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: found.roaster }),
                  });
                  if (gen.ok) {
                    const generated: RoasterInfo = await gen.json();
                    if (generated?.styleSummary) {
                      setRoasterInfo(generated);
                      // Save to Firestore so next visit is instant
                      fetch("/api/roasters", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...generated, name: found.roaster }),
                      }).catch(() => {});
                    }
                  }
                } catch {
                  // fail silently
                } finally {
                  setRoasterGenerating(false);
                }
              })()
            : Promise.resolve(),
          found?.sessionIds?.length
            ? fetch(`/api/sessions?ids=${found.sessionIds.join(",")}`, { cache: "no-store" })
                .then(r => r.ok ? r.json() : [])
                .then((coffeeSessions: Session[]) => {
                  setSessions(coffeeSessions.sort((a, b) => {
                    const aMs = (a as Session & { createdAtMs?: number }).createdAtMs ?? new Date(a.createdAt).getTime();
                    const bMs = (b as Session & { createdAtMs?: number }).createdAtMs ?? new Date(b.createdAt).getTime();
                    return bMs - aMs;
                  }));
                  // Pre-warm the Field cache for every session of this
                  // coffee so a downstream /brew/[id] navigation paints
                  // the coffee's Field immediately on mount instead of
                  // flashing through default for the coffee fetch.
                  if (found.fieldZones) {
                    coffeeSessions.forEach(s => rememberSessionField(s.id, found.fieldZones));
                  }
                  // Warm the offline re-brew cache for this coffee.
                  void cacheBrewableCoffee(found, coffeeSessions);
                })
                .catch(() => {})
            : Promise.resolve(),
        ]);
      } catch {
        // fail silently — show "not found"
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, online]);

  // Adopt this coffee's Field composition so the page paints in its
  // cup-specific colours, matching the brew-session detail and the
  // brew flow's "Brew Again" path. Offline, lift it from the cache.
  const activeFieldZones = coffee?.fieldZones ?? offlineCoffee?.fieldZones ?? null;
  useFieldConfig(activeFieldZones ? { fieldZones: activeFieldZones, rotation: 0 } : null);

  if (loading) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col">
        <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
          <button onClick={() => router.push("/coffees")} className="text-light-muted-foreground text-sm">← Library</button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
      </div>
    );
  }

  // Offline — slim detail with the re-brew recipe picker (the network
  // sections like roaster info and notes editing aren't available).
  if (!coffee && offlineCoffee) {
    return <OfflineCoffeeDetail coffee={offlineCoffee} router={router} />;
  }

  if (!coffee) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col items-center justify-center gap-4">
        <p className="text-light-muted-foreground">Coffee not found</p>
        <button onClick={() => router.push("/coffees")} className="text-light-foreground underline">Back to library</button>
      </div>
    );
  }

  // Derive scan details from most recent session — works for all existing data
  const latestCoffee = sessions[0]?.coffee;
  const roastDate = coffee.latestRoastDate ?? latestCoffee?.roastDate;
  const variety = latestCoffee?.variety;
  const roastLevel = latestCoffee?.roastLevel;
  const region = latestCoffee?.region;
  const farm = latestCoffee?.farm;
  const altitude = latestCoffee?.altitudeMeters;
  const process = latestCoffee?.process || coffee.process;
  const fermentationStyle = latestCoffee?.fermentationStyle;
  const cuppingScore = latestCoffee?.cuppingScore;
  const tastingNotes = latestCoffee?.tastingNotesFromBag ?? [];
  const commonNotes = coffee.commonNotes ?? [];
  const origin = latestCoffee?.origin || coffee.origin;

  const brewThis = () => {
    // Prefer the most-recent scanned CoffeeIdentity (has variety, tasting notes,
    // roast level). Fall back to the aggregate if the coffee somehow has no
    // sessions yet — defaults match the user's profile (light roast).
    const identity: CoffeeIdentity = latestCoffee
      ? { ...latestCoffee, coffeeId: coffee.id }
      : {
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
    startBrewAgain(identity, coffee.fieldZones ?? null);
    router.push("/brew/new");
  };

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      {/* Hero */}
      <div className="relative">
        {coffee.bagPhotoUrl ? (
          <div className="relative h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coffee.bagPhotoUrl} alt={coffee.name} className="w-full h-full object-cover" />
            {/* Cream-to-transparent scrim so the anthracite title stays
                readable over a bag photo of any colour. The dark
                card-scrim utility is for the dark theme — using it here
                left anthracite text painted on near-black, illegible. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, hsl(30 60% 92% / 0.95) 0%, hsl(30 60% 92% / 0.45) 45%, transparent 80%)",
              }}
            />
          </div>
        ) : (
          <div className="h-40 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 flex items-center justify-center">
            <svg className="w-12 h-12 text-light-muted-foreground opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a3.75 3.75 0 01-3.75 3.75H7.95A3.75 3.75 0 014.2 15m15.6 0H4.2m15.6 0H4.2" />
            </svg>
          </div>
        )}

        {/* Back button — return to /coffees list */}
        <button
          onClick={() => router.push("/coffees")}
          aria-label="Back to library"
          className="absolute left-4 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Burger menu — opens NavigationOverlay (Markus: every Light
            surface should have it, BottomNav is gone for /coffees). */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="absolute right-4 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground active:scale-95 transition-transform"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Title overlay */}
        <div className={`${coffee.bagPhotoUrl ? "absolute bottom-0 left-0 right-0" : ""} p-5`}>
          {coffee.process && (
            <p className="text-light-foreground/50 text-xs tracking-widest uppercase mb-1">{coffee.process}</p>
          )}
          <h1 className="font-fraunces text-3xl text-light-foreground">{coffee.name}</h1>
          <p className="text-light-foreground/60 text-sm mt-1">{coffee.roaster}{origin ? ` · ${origin}` : ""}</p>
          {roastDate && (
            <p className="text-light-foreground/40 text-xs mt-0.5">
              Roasted {new Date(roastDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 flex items-center gap-6 border-b border-light-foreground/15">
        <div className="text-center">
          <p className="font-mono-num text-2xl text-light-foreground font-medium">{coffee.sessionCount}</p>
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mt-0.5">Brew{coffee.sessionCount !== 1 ? "s" : ""}</p>
        </div>
        {coffee.avgRating != null && coffee.avgRating > 0 && (
          <div className="flex flex-col items-center">
            <StarRating value={coffee.avgRating} readonly size="sm" />
            <p className="text-light-muted-foreground text-xs uppercase tracking-widest mt-1">Avg Rating</p>
          </div>
        )}
        {coffee.bestMethod && (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <BrewMethodIcon method={coffee.bestMethod} className="w-5 h-5" />
              <p className="text-light-foreground text-sm font-medium">{coffee.bestMethod}</p>
            </div>
            <p className="text-light-muted-foreground text-xs uppercase tracking-widest mt-0.5">Best Method</p>
          </div>
        )}
      </div>

      {/* Action hierarchy — rotation first, then brew.
          A coffee must be in rotation before it can be brewed: if it's
          not in rotation the bag is gone or set aside, so the "Brew
          this" shortcut is hidden until the user opts the bag in. */}
      <div className="px-5 pt-4 space-y-2">
        {/* Rotation toggle — marks this bag as "currently in rotation".
            The /api/greeting library snapshot uses this signal so the
            daily Haiku starter prioritises rotation bags over the rest
            of the library. Primary CTA when not in rotation; quieter
            state pill once active. Optimistic update + best-effort PATCH. */}
        <button
          type="button"
          onClick={async () => {
            if (!coffee) return;
            const next = !coffee.inRotation;
            setCoffee((prev) => (prev ? { ...prev, inRotation: next } : prev));
            try {
              const res = await fetch(`/api/coffees/${coffee.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inRotation: next }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
            } catch {
              setCoffee((prev) => (prev ? { ...prev, inRotation: !next } : prev));
            }
          }}
          className={`w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
            coffee.inRotation
              ? "bg-light-foreground/10 border border-light-foreground/40 text-light-foreground"
              : "bg-light-foreground text-[hsl(36_55%_96%)]"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={coffee.inRotation ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {coffee.inRotation ? "In rotation" : "Add to rotation"}
        </button>
        {coffee.inRotation && (
          <button
            type="button"
            onClick={brewThis}
            className="w-full py-3.5 rounded-2xl text-sm font-medium bg-light-foreground text-[hsl(36_55%_96%)] active:scale-[0.98] transition-transform"
          >
            Brew this
          </button>
        )}
      </div>

      {/* Coffee scan details */}
      {(roastDate || variety || roastLevel || region || farm || altitude || process || fermentationStyle || cuppingScore || tastingNotes.length > 0 || commonNotes.length > 0) && (
        <div className="px-5 py-4 border-b border-light-foreground/15 space-y-2">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-3">Coffee Details</p>
          {variety && <DetailRow label="Variety" value={variety} />}
          {process && <DetailRow label="Process" value={process} />}
          {fermentationStyle && <DetailRow label="Fermentation" value={fermentationStyle} />}
          {roastLevel && <DetailRow label="Roast" value={roastLevel} />}
          {region && <DetailRow label="Region" value={region} />}
          {farm && <DetailRow label="Farm" value={farm} />}
          {altitude != null && <DetailRow label="Altitude" value={`${altitude} m`} />}
          {cuppingScore != null && <DetailRow label="Cupping score" value={String(cuppingScore)} />}
          {roastDate && (
            <DetailRow
              label="Roast date"
              value={new Date(roastDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            />
          )}
          {tastingNotes.length > 0 && (
            <div className="flex items-baseline gap-3 pt-0.5">
              <span className="text-light-muted-foreground text-sm shrink-0 w-24">Bag notes</span>
              <div className="flex flex-wrap gap-1.5">
                {tastingNotes.map(note => (
                  <span key={note} className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}
          {commonNotes.length > 0 && (
            <div className="flex items-baseline gap-3 pt-0.5">
              <span className="text-light-muted-foreground text-sm shrink-0 w-24">You taste</span>
              <div className="flex flex-wrap gap-1.5">
                {commonNotes.map(note => (
                  <span key={note} className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roaster info */}
      {(roasterInfo || roasterGenerating) && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-2">Roaster</p>
          {roasterGenerating ? (
            <p className="text-light-muted-foreground text-sm italic">Researching roaster…</p>
          ) : roasterInfo ? (
            <>
              {roasterInfo.region && (
                <p className="text-light-muted-foreground text-xs mb-1.5">{roasterInfo.region}</p>
              )}
              <p className="text-light-foreground/80 text-sm leading-relaxed">{roasterInfo.styleSummary}</p>
              {roasterInfo.notes && (
                <p className="text-light-foreground/40 text-xs mt-2 leading-relaxed">{roasterInfo.notes}</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Personal notes */}
      <div className="px-5 py-4 border-b border-light-foreground/15">
        <div className="flex items-center justify-between mb-2">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest">Your Notes</p>
          {!editingNotes && (
            <button
              onClick={() => {
                setNotesDraft(coffee.personalNotes ?? "");
                setEditingNotes(true);
                setTimeout(() => notesRef.current?.focus(), 50);
              }}
              className="text-light-muted-foreground text-xs hover:text-light-foreground transition-colors"
            >
              {coffee.personalNotes ? "Edit" : "+ Add"}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              ref={notesRef}
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              placeholder="Would you buy this again? Anything worth remembering…"
              rows={4}
              className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-3 text-light-foreground text-sm resize-none placeholder:text-light-muted-foreground focus:outline-none focus:border-white/30"
            />
            <div className="flex gap-2">
              <button
                disabled={notesSaving}
                onClick={async () => {
                  setNotesSaving(true);
                  try {
                    await fetch(`/api/coffees/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ personalNotes: notesDraft.trim() }),
                    });
                    setCoffee(prev => prev ? { ...prev, personalNotes: notesDraft.trim() || undefined } : prev);
                    setEditingNotes(false);
                  } finally {
                    setNotesSaving(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-2xl text-sm font-medium bg-light-foreground/20 text-light-foreground border border-light-foreground/30 disabled:opacity-50"
              >
                {notesSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm border border-light-foreground/15 text-light-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : coffee.personalNotes ? (
          <p className="text-light-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">{coffee.personalNotes}</p>
        ) : (
          <p className="text-light-muted-foreground text-sm italic">No notes yet.</p>
        )}
      </div>

      {/* Brew memory */}
      {coffee.writtenSummary && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-2">Brew memory</p>
          <p className="text-light-foreground/80 text-sm leading-relaxed">{coffee.writtenSummary}</p>
          {coffee.lastSummarizedAt && (
            <p className="text-light-foreground/20 text-xs mt-2">
              Updated {new Date(coffee.lastSummarizedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      {/* What to explore */}
      {coffee.whatToExplore && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-2">What to explore</p>
          <p className="text-light-foreground/80 text-sm leading-relaxed">{coffee.whatToExplore}</p>
        </div>
      )}

      {/* Sessions */}
      <div className="px-5 py-5 flex flex-col gap-4 pb-safe pb-8">
        <p className="text-light-muted-foreground text-xs uppercase tracking-widest">All Brews</p>
        {sessions.length === 0 ? (
          <p className="text-light-muted-foreground text-sm">No sessions found.</p>
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

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-light-muted-foreground text-sm shrink-0">{label}</span>
      <span className="text-light-foreground/80 text-sm text-right">{value}</span>
    </div>
  );
}

/**
 * Offline coffee detail — the re-brew recipe picker. Shows up to the two
 * best-rated cached recipes; tapping one seeds the flow store and jumps
 * straight to the brew timer (skipping the AI recommend step).
 */
function OfflineCoffeeDetail({
  coffee,
  router,
}: {
  coffee: BrewableCoffee;
  router: { push: (href: string) => void };
}) {
  const { identity, fieldZones, recipes } = coffee;
  const origin = identity.origin;

  const start = (recipe: BrewableRecipe) => {
    startBrewAgainOffline(identity, fieldZones, recipe);
    router.push("/brew/new");
  };

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      <div className="relative">
        {identity.bagPhotoUrl ? (
          <div className="relative h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={identity.bagPhotoUrl} alt={identity.name} className="w-full h-full object-cover" />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, hsl(30 60% 92% / 0.95) 0%, hsl(30 60% 92% / 0.45) 45%, transparent 80%)",
              }}
            />
          </div>
        ) : (
          <div className="h-40 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150" />
        )}

        <button
          onClick={() => router.push("/coffees")}
          aria-label="Back to library"
          className="absolute left-4 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className={`${identity.bagPhotoUrl ? "absolute bottom-0 left-0 right-0" : ""} p-5`}>
          {identity.process && (
            <p className="text-light-foreground/50 text-xs tracking-widest uppercase mb-1">{identity.process}</p>
          )}
          <h1 className="font-fraunces text-3xl text-light-foreground">{identity.name}</h1>
          <p className="text-light-foreground/60 text-sm mt-1">
            {identity.roaster}{origin ? ` · ${origin}` : ""}
          </p>
        </div>
      </div>

      <div className="px-5 pt-5 pb-8 space-y-3">
        <p className="text-light-muted-foreground text-xs uppercase tracking-widest">
          {recipes.length > 1 ? "Brew again — pick a recipe" : "Brew again"}
        </p>
        {recipes.length === 0 ? (
          <p className="text-light-muted-foreground text-sm">No saved recipe to brew offline.</p>
        ) : (
          recipes.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => start(r)}
              className="w-full text-left rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <BrewMethodIcon method={r.method} className="w-4 h-4 shrink-0 text-light-foreground" />
                  <span className="text-light-foreground text-sm font-medium truncate">{r.method}</span>
                </div>
                {typeof r.rating === "number" && r.rating > 0 && (
                  <StarRating value={r.rating} readonly size="sm" />
                )}
              </div>
              <p className="text-light-muted-foreground text-xs mt-1.5">
                {r.recipe.doseGrams}g / {r.recipe.waterGrams}g · {r.recipe.waterTempC}°C
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
