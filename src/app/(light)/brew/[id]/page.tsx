"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import StarRating from "@/components/ui/light/StarRating";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import type { Session } from "@/lib/types/session";
import type { Coffee } from "@/lib/types/coffee";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";
import { formatDate, formatSeconds } from "@/lib/utils/formatTime";
import { useFieldConfig } from "@/lib/field/FieldContext";
import { recallSessionField, rememberSessionField } from "@/lib/field/cache";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  // Read the Field cache synchronously on mount — written by
  // /coffees/[id] when it loads. If the user navigated here from
  // there, this returns the cup's fieldZones immediately, so the
  // page paints in the right colours from frame 1 instead of
  // flashing default for the coffee fetch's ~300ms.
  const cachedFieldZones = useMemo(() => recallSessionField(id), [id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const sessionRes = await fetch(`/api/sessions/${id}`, { cache: "no-store", signal: controller.signal });
        if (!sessionRes.ok) { setSession(null); return; }
        const s: Session = await sessionRes.json();
        setSession(s);
        const coffeeId = s.coffee?.coffeeId;
        if (coffeeId) {
          const cRes = await fetch(`/api/coffees/${coffeeId}`, { cache: "no-store", signal: controller.signal });
          if (cRes.ok) {
            const c: Coffee = await cRes.json();
            setCoffee(c);
            // Refresh the cache so subsequent visits hit the latest.
            rememberSessionField(id, c.fieldZones);
          }
        }
      } catch {
        setSession(null);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    })();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [id]);

  // Adopt this coffee's Field composition. Prefer the freshly-fetched
  // coffee, fall back to the session-storage cache primed by
  // /coffees/[id], and finally to null (default Field) if neither
  // source has fieldZones yet.
  const activeFieldZones = coffee?.fieldZones ?? cachedFieldZones;
  useFieldConfig(activeFieldZones ? { fieldZones: activeFieldZones, rotation: 0 } : null);

  if (loading) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col">
        <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
          <button onClick={() => router.back()} className="text-light-muted-foreground text-sm">← Back</button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col items-center justify-center gap-4">
        <p className="text-light-muted-foreground">Session not found</p>
        <button onClick={() => router.push("/coffees")} className="text-light-foreground underline">Back to library</button>
      </div>
    );
  }

  const { coffee: sessionCoffee, result, brew, recommendation, mode, place, createdAt } = session;
  // Resolve the candidate the user actually brewed (by index, not primary) —
  // shared helper so the recipe, method and name all stay consistent.
  const { recipe, candidate, method } = resolveBrewedRecipe(session);
  const recipeName = brewedRecipeName(candidate);

  // Back resolution — prefer the deterministic /coffees/[id] target so
  // the user lands on the exact detail page they came from, regardless
  // of browser history (deep links, multi-tab use). The fetched
  // coffee.id is the canonical source; sessionCoffee.coffeeId is the
  // older fallback (some legacy sessions persisted CoffeeIdentity
  // without coffeeId). If neither resolves, fall back to router.back()
  // — typical for external/cafe sessions that have no library coffee.
  const targetCoffeeId = coffee?.id ?? sessionCoffee?.coffeeId;
  const handleBack = () => {
    if (targetCoffeeId) {
      router.push(`/coffees/${targetCoffeeId}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      {/* Hero */}
      <div className="relative">
        {sessionCoffee?.bagPhotoUrl ? (
          <div className="relative h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sessionCoffee.bagPhotoUrl} alt={sessionCoffee.name || "Coffee"} className="w-full h-full object-cover" />
            {/* Cream-to-transparent scrim — anthracite headline stays
                readable on a bag photo of any tone. Mirrors the pattern
                used on /coffees/[id] and LightStepSummary. */}
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
          <div className="h-32 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150" />
        )}

        {/* Back */}
        <button
          onClick={handleBack}
          aria-label="Back"
          className="absolute left-4 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Menu */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="absolute right-4 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground active:scale-95 transition-transform"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Headline overlay — brew method is the primary fact for a
            session detail; coffee name + date sit as context underneath. */}
        <div className={`${sessionCoffee?.bagPhotoUrl ? "absolute bottom-0 left-0 right-0" : ""} p-5`}>
          {mode === "external" && place?.name && (
            <p className="text-light-foreground/50 text-xs tracking-widest uppercase mb-1">{place.name}</p>
          )}
          <div className="flex items-center gap-2">
            <BrewMethodIcon method={method} className="w-6 h-6 opacity-90" />
            <h1 className="font-fraunces text-3xl text-light-foreground">{method}</h1>
          </div>
          {recipeName && (
            <p className="text-light-foreground/80 text-sm mt-1.5 font-medium">{recipeName}</p>
          )}
          {sessionCoffee?.name && (
            <p className="text-light-foreground/70 text-sm mt-1.5">
              {sessionCoffee.name}
              {sessionCoffee.roaster ? ` · ${sessionCoffee.roaster}` : ""}
            </p>
          )}
          <p className="text-light-foreground/40 text-xs mt-0.5">{formatDate(createdAt)}</p>
        </div>
      </div>

      {/* Rating row */}
      {result?.rating != null && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <StarRating value={result.rating} readonly size="md" />
        </div>
      )}

      {/* Recipe */}
      {recipe && (
        <Section title="Recipe">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Dose" value={`${recipe.doseGrams}g`} />
            <Stat label={recipe.iceGrams ? "Hot Water" : "Water"} value={`${recipe.waterGrams}g`} />
            <Stat label="Temp" value={`${recipe.waterTempC}°C`} />
          </div>
          {recipe.iceGrams != null && recipe.iceGrams > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Stat label="Ice" value={`${recipe.iceGrams}g`} />
              <Stat label="Final cup" value={`${recipe.waterGrams + recipe.iceGrams}g`} />
            </div>
          )}
          {recipe.pourSequence && (
            <p className="text-light-muted-foreground text-sm mt-3 leading-relaxed">{recipe.pourSequence}</p>
          )}
          {brew && (
            <p className="text-light-muted-foreground text-xs mt-3">
              {brew.actualTimeSec ? `Actual time: ${formatSeconds(brew.actualTimeSec)}` : "No timer used"}
              {recipe.targetTimeSec ? ` · Target ${formatSeconds(recipe.targetTimeSec)}` : ""}
            </p>
          )}
        </Section>
      )}

      {/* Brew notes */}
      {(brew?.flow || brew?.timing || brew?.modifications || brew?.followedAgitation) && (
        <Section title="Brew Notes">
          <div className="flex flex-wrap gap-1.5">
            {brew.flow && <Pill>Flow: {brew.flow}</Pill>}
            {brew.timing && <Pill>Timing: {brew.timing}</Pill>}
            {brew.followedAgitation && <Pill>Agitation: {brew.followedAgitation}</Pill>}
          </div>
          {brew.modifications && (
            <p className="text-light-muted-foreground text-sm mt-3 leading-relaxed">{brew.modifications}</p>
          )}
          {brew.agitationNote && (
            <p className="text-light-muted-foreground text-sm mt-2 leading-relaxed">{brew.agitationNote}</p>
          )}
        </Section>
      )}

      {/* Taste */}
      {result && (
        <Section title="Taste">
          {result.flavorNotes?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.flavorNotes.map(f => (
                <span key={f} className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground">
                  {f}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {result.body && <Pill>Body: {result.body}</Pill>}
            {result.acidity && <Pill>Acidity: {result.acidity}</Pill>}
            {result.sweetness && <Pill>Sweetness: {result.sweetness}</Pill>}
            {result.clarity && <Pill>Clarity: {result.clarity}</Pill>}
            {result.finish && <Pill>Finish: {result.finish}</Pill>}
            {result.balance && <Pill>Balance: {result.balance}</Pill>}
          </div>
          {result.freeNotes && (
            <p className="text-light-foreground/70 text-sm italic mt-3 leading-relaxed">&ldquo;{result.freeNotes}&rdquo;</p>
          )}
        </Section>
      )}

      {/* Reasoning */}
      {recommendation?.reasoning && (
        <Section title="Why this recipe">
          <p className="text-light-foreground/75 text-sm leading-relaxed italic">{recommendation.reasoning}</p>
        </Section>
      )}

      {/* Delete */}
      <div className="px-5 py-6 pb-safe pb-8">
        <DeleteButton sessionId={session.id} onDeleted={handleBack} />
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-light-foreground/15">
      <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 px-3 py-3 text-center">
      <p className="text-light-muted-foreground text-[10px] uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-mono-num text-light-foreground text-lg font-medium">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground">
      {children}
    </span>
  );
}

function DeleteButton({ sessionId, onDeleted }: { sessionId: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    onDeleted();
  };

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="w-full py-3 rounded-2xl border border-light-foreground/15 text-light-muted-foreground text-sm active:scale-[0.98] transition-transform"
      >
        Delete session
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-light-foreground/20 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 space-y-3">
      <p className="text-light-foreground text-sm text-center">Delete this session? This cannot be undone.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="flex-1 py-3 rounded-xl border border-light-foreground/15 text-light-muted-foreground text-sm active:scale-[0.98] transition-transform"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-[hsl(12_70%_45%)] text-[hsl(36_55%_96%)] text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
