"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Coffee } from "@/lib/types/coffee";
import type { Session, CoffeeIdentity } from "@/lib/types/session";
import SessionCard from "@/components/session/SessionCard";
import StarRating from "@/components/ui/StarRating";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import { useFlowStore } from "@/store/flowStore";

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
  const router = useRouter();
  const { reset, setCoffee: setFlowCoffee, setStep, setMode, setSkipScan } = useFlowStore();

  // Personal notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
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

  // Derive scan details from most recent session — works for all existing data
  const latestCoffee = sessions[0]?.coffee;
  const roastDate = coffee.latestRoastDate ?? latestCoffee?.roastDate;
  const variety = latestCoffee?.variety;
  const roastLevel = latestCoffee?.roastLevel;
  const region = latestCoffee?.region;
  const tastingNotes = latestCoffee?.tastingNotesFromBag ?? [];
  const commonNotes = coffee.commonNotes ?? [];
  const origin = latestCoffee?.origin || coffee.origin;

  const brewThis = () => {
    // Prefer the most-recent scanned CoffeeIdentity (has variety, tasting notes,
    // roast level). Fall back to the aggregate if the coffee somehow has no
    // sessions yet — defaults match the user's profile (light roast).
    const identity: CoffeeIdentity = latestCoffee ?? {
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
    setFlowCoffee({ ...identity, coffeeId: coffee.id });
    setMode("home");
    setSkipScan(true);
    setStep("context");
    router.push("/brew/new");
  };

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
            <p className="text-white/50 text-xs tracking-widest uppercase mb-1">{coffee.process}</p>
          )}
          <h1 className="font-display text-3xl text-white">{coffee.name}</h1>
          <p className="text-white/60 text-sm mt-1">{coffee.roaster}{origin ? ` · ${origin}` : ""}</p>
          {roastDate && (
            <p className="text-white/40 text-xs mt-0.5">
              Roasted {new Date(roastDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
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
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <BrewMethodIcon method={coffee.bestMethod} className="w-5 h-5" />
              <p className="text-white text-sm font-medium">{coffee.bestMethod}</p>
            </div>
            <p className="text-brew-muted text-xs uppercase tracking-widest mt-0.5">Best Method</p>
          </div>
        )}
      </div>

      {/* Brew this — jumps straight to the brew context step with this coffee preloaded */}
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={brewThis}
          className="w-full py-3.5 rounded-2xl text-sm font-medium bg-brew-accent text-brew-accent-fg active:scale-[0.98] transition-transform"
        >
          Brew this
        </button>
      </div>

      {/* Coffee scan details */}
      {(roastDate || variety || roastLevel || region || tastingNotes.length > 0 || commonNotes.length > 0) && (
        <div className="px-5 py-4 border-b border-brew-border space-y-2">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-3">Coffee Details</p>
          {variety && <DetailRow label="Variety" value={variety} />}
          {roastLevel && <DetailRow label="Roast" value={roastLevel} />}
          {region && <DetailRow label="Region" value={region} />}
          {roastDate && (
            <DetailRow
              label="Roast date"
              value={new Date(roastDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            />
          )}
          {tastingNotes.length > 0 && (
            <div className="flex items-baseline gap-3 pt-0.5">
              <span className="text-brew-muted text-sm shrink-0 w-24">Bag notes</span>
              <div className="flex flex-wrap gap-1.5">
                {tastingNotes.map(note => (
                  <span key={note} className="text-xs capitalize px-2 py-0.5 rounded-full border border-brew-border text-white/60">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}
          {commonNotes.length > 0 && (
            <div className="flex items-baseline gap-3 pt-0.5">
              <span className="text-brew-muted text-sm shrink-0 w-24">You taste</span>
              <div className="flex flex-wrap gap-1.5">
                {commonNotes.map(note => (
                  <span key={note} className="text-xs capitalize px-2 py-0.5 rounded-full bg-white/10 text-white/80">
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
        <div className="px-5 py-4 border-b border-brew-border">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">Roaster</p>
          {roasterGenerating ? (
            <p className="text-brew-muted text-sm italic">Researching roaster…</p>
          ) : roasterInfo ? (
            <>
              {roasterInfo.region && (
                <p className="text-brew-muted text-xs mb-1.5">{roasterInfo.region}</p>
              )}
              <p className="text-white/80 text-sm leading-relaxed">{roasterInfo.styleSummary}</p>
              {roasterInfo.notes && (
                <p className="text-white/40 text-xs mt-2 leading-relaxed">{roasterInfo.notes}</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Personal notes */}
      <div className="px-5 py-4 border-b border-brew-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-brew-muted text-xs uppercase tracking-widest">Your Notes</p>
          {!editingNotes && (
            <button
              onClick={() => {
                setNotesDraft(coffee.personalNotes ?? "");
                setEditingNotes(true);
                setTimeout(() => notesRef.current?.focus(), 50);
              }}
              className="text-brew-muted text-xs hover:text-white transition-colors"
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
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-sm resize-none placeholder:text-brew-muted focus:outline-none focus:border-white/30"
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
                className="flex-1 py-2.5 rounded-2xl text-sm font-medium bg-brew-accent/20 text-brew-accent border border-brew-accent/30 disabled:opacity-50"
              >
                {notesSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm border border-brew-border text-brew-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : coffee.personalNotes ? (
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{coffee.personalNotes}</p>
        ) : (
          <p className="text-brew-muted text-sm italic">No notes yet.</p>
        )}
      </div>

      {/* Brew memory */}
      {coffee.writtenSummary && (
        <div className="px-5 py-4 border-b border-brew-border">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">Brew memory</p>
          <p className="text-white/80 text-sm leading-relaxed">{coffee.writtenSummary}</p>
          {coffee.lastSummarizedAt && (
            <p className="text-white/20 text-xs mt-2">
              Updated {new Date(coffee.lastSummarizedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      {/* What to explore */}
      {coffee.whatToExplore && (
        <div className="px-5 py-4 border-b border-brew-border">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">What to explore</p>
          <p className="text-white/80 text-sm leading-relaxed">{coffee.whatToExplore}</p>
        </div>
      )}

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-brew-muted text-sm shrink-0">{label}</span>
      <span className="text-white/80 text-sm text-right">{value}</span>
    </div>
  );
}
