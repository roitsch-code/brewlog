"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";
import Chip from "@/components/ui/Chip";
import { formatDate, formatSeconds } from "@/lib/utils/formatTime";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch(`/api/sessions/${id}`, { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((s: Session | null) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => { clearTimeout(timer); setLoading(false); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col">
        <div className="px-5 pt-safe pt-6 pb-4">
          <button onClick={() => router.push("/")} className="text-brew-muted text-sm">← Back</button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center gap-4">
        <p className="text-brew-muted">Session not found</p>
        <button onClick={() => router.push("/")} className="text-white underline">Go home</button>
      </div>
    );
  }

  const { coffee, result, brew, recommendation, context, mode, place } = session;

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Hero photo */}
      <div className="relative">
        {coffee?.bagPhotoUrl ? (
          <div className="relative h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coffee.bagPhotoUrl} alt={coffee.name || "Coffee"} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 card-scrim" />
          </div>
        ) : (
          <div className="h-32 bg-brew-surface" />
        )}

        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="absolute left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Overlay info */}
        {coffee?.bagPhotoUrl && (
          <div className="absolute bottom-0 left-0 right-0 p-5">
            {mode === "external" && place?.name && (
              <p className="text-brew-accent text-xs tracking-widest uppercase font-medium mb-1">{place.name}</p>
            )}
            <h1 className="font-display text-3xl text-white">{coffee?.name || "Coffee Session"}</h1>
            <p className="text-white/60 text-sm mt-1">{coffee?.roaster} · {formatDate(session.createdAt)}</p>
          </div>
        )}
      </div>

      <div className="px-5 py-5 pb-8 flex flex-col gap-6">
        {!coffee?.bagPhotoUrl && (
          <div>
            {mode === "external" && <Chip label={place?.name || "Coffee Shop"} accent />}
            <h1 className="font-display text-3xl text-white mt-2">{coffee?.name || "Coffee Session"}</h1>
            <p className="text-brew-muted text-sm mt-1">{coffee?.roaster} · {formatDate(session.createdAt)}</p>
          </div>
        )}

        {/* Rating */}
        {result?.rating && (
          <StarRating value={result.rating} readonly size="md" />
        )}

        {/* Coffee details */}
        {coffee && (
          <Section title="Coffee">
            <div className="space-y-2">
              {coffee.origin && <InfoRow label="Origin" value={[coffee.origin, coffee.region].filter(Boolean).join(" · ")} />}
              {coffee.process && <InfoRow label="Process" value={coffee.process} />}
              {coffee.roastLevel && <InfoRow label="Roast" value={coffee.roastLevel} />}
              {coffee.variety && <InfoRow label="Variety" value={coffee.variety} />}
            </div>
          </Section>
        )}

        {/* Recipe */}
        {recommendation && (
          <Section title="Recipe">
            <div className="bg-brew-surface rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BrewMethodIcon method={brew?.methodUsed || recommendation.primaryMethod} className="w-5 h-5" />
                <p className="text-brew-accent text-xs uppercase tracking-widest">{brew?.methodUsed || recommendation.primaryMethod}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <RecipeStat label="Dose" value={`${recommendation.primaryRecipe.doseGrams}g`} />
                <RecipeStat label="Water" value={`${recommendation.primaryRecipe.waterGrams}g`} />
                <RecipeStat label="Temp" value={`${recommendation.primaryRecipe.waterTempC}°C`} />
              </div>
              {recommendation.primaryRecipe.pourSequence && (
                <p className="text-brew-muted text-xs mt-3 leading-relaxed">{recommendation.primaryRecipe.pourSequence}</p>
              )}
            </div>
            {brew && (
              <p className="text-brew-muted text-sm">
                {brew.actualTimeSec ? `Actual time: ${formatSeconds(brew.actualTimeSec)}` : "No timer used"}
              </p>
            )}
          </Section>
        )}

        {/* Flow & timing */}
        {(brew?.flow || brew?.timing) && (
          <Section title="Brew Notes">
            <div className="flex gap-2 flex-wrap">
              {brew.flow && <Chip label={`Flow: ${brew.flow}`} size="sm" />}
              {brew.timing && <Chip label={`Timing: ${brew.timing}`} size="sm" />}
            </div>
          </Section>
        )}

        {/* Taste */}
        {result && (
          <Section title="Taste">
            <div className="space-y-3">
              {result.flavorNotes?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.flavorNotes.map(f => <Chip key={f} label={f} selected size="sm" />)}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {result.body && <Chip label={`Body: ${result.body}`} size="sm" />}
                {result.acidity && <Chip label={`Acidity: ${result.acidity}`} size="sm" />}
              </div>
              {result.freeNotes && (
                <p className="text-white/60 text-sm italic">&ldquo;{result.freeNotes}&rdquo;</p>
              )}
            </div>
          </Section>
        )}

        {/* Reasoning */}
        {recommendation?.reasoning && (
          <Section title="Why this recipe">
            <p className="text-brew-muted text-sm leading-relaxed italic">{recommendation.reasoning}</p>
          </Section>
        )}

        {/* Delete session */}
        <DeleteButton sessionId={session.id} onDeleted={() => router.push("/")} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-white/60 text-xs font-medium uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-brew-muted text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
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
        className="w-full py-3 rounded-2xl border border-red-800/40 text-red-500 text-sm font-medium hover:bg-red-900/20 transition-colors active:scale-95"
      >
        Delete Session
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-800/40 p-4 space-y-3">
      <p className="text-white text-sm text-center">Delete this session? This cannot be undone.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="flex-1 py-3 rounded-xl border border-brew-border text-brew-muted text-sm active:scale-95 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium active:scale-95 transition-all disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}

function RecipeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="font-mono-num text-white text-lg font-medium">{value}</p>
    </div>
  );
}
