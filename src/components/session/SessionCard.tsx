"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/light/StarRating";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import { formatSeconds } from "@/lib/utils/formatTime";

interface SessionCardProps {
  session: Session;
  onDeleted?: (id: string) => void;
}

const DELETE_THRESHOLD = 80;

export default function SessionCard({ session, onDeleted }: SessionCardProps) {
  const router = useRouter();
  const { brew, result, recommendation, createdAt } = session;

  const method = brew?.methodUsed || recommendation?.primaryMethod || "Brew";
  const dose = brew?.doseGrams ?? recommendation?.primaryRecipe.doseGrams;
  const water = brew?.waterGrams ?? recommendation?.primaryRecipe.waterGrams;
  const timeSec = brew?.actualTimeSec ?? recommendation?.primaryRecipe.targetTimeSec;
  const grind = brew?.grindSettingUsed ?? recommendation?.primaryRecipe.grindSize;
  const rating = result?.rating;
  const tags = result?.flavorNotes?.slice(0, 4) ?? [];

  const date = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "";

  const recipeBits: string[] = [];
  if (dose != null) recipeBits.push(`${dose}g`);
  if (water != null) recipeBits.push(`${water}g`);
  if (timeSec != null) recipeBits.push(formatSeconds(timeSec));
  if (grind) recipeBits.push(typeof grind === "number" ? `${grind}°` : grind);

  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = startXRef.current - e.touches[0].clientX;
    if (dx > 0) setOffset(Math.min(dx, DELETE_THRESHOLD + 20));
  };
  const handleTouchEnd = () => {
    startXRef.current = null;
    setOffset(offset >= DELETE_THRESHOLD ? DELETE_THRESHOLD : 0);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      onDeleted?.(session.id);
    } catch {
      setDeleting(false);
      setOffset(0);
    }
  };

  if (deleting) return null;
  const isOpen = offset >= DELETE_THRESHOLD;
  // Fade the delete button in as the swipe progresses. At rest (offset
  // 0) it's fully transparent so it doesn't bleed through the
  // translucent cream card and confuse the user about whether it's a
  // design element. By the time the user has dragged past the
  // threshold the button is fully opaque and tappable.
  const swipeProgress = Math.min(offset / DELETE_THRESHOLD, 1);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[hsl(36_55%_96%/0.30)] backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15">
      {/* Delete button behind — hidden at rest, fades in during swipe */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch rounded-r-2xl overflow-hidden"
        style={{ opacity: swipeProgress, transition: startXRef.current === null ? "opacity 0.2s ease" : "none" }}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete session"
          tabIndex={isOpen ? 0 : -1}
          className="w-20 flex flex-col items-center justify-center gap-1 text-light-text-on-dark active:opacity-80 bg-light-destructive"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Card body — translates left to reveal delete */}
      <div
        style={{
          transform: `translateX(-${isOpen ? DELETE_THRESHOLD : offset}px)`,
          transition: startXRef.current === null ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isOpen) { setOffset(0); return; }
          router.push(`/brew/${session.id}`);
        }}
        className="relative bg-[hsl(36_55%_96%/0.30)] backdrop-blur-light-card backdrop-saturate-150 rounded-2xl px-4 py-3.5 cursor-pointer active:scale-[0.99] transition-transform"
      >
        {/* Headline row — brew method + rating */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BrewMethodIcon method={method} className="w-5 h-5 shrink-0 opacity-80" />
            <h3 className="font-fraunces text-light-foreground text-lg leading-tight truncate">{method}</h3>
          </div>
          {rating != null && (
            <div className="shrink-0 mt-1">
              <StarRating value={rating} readonly size="sm" />
            </div>
          )}
        </div>

        {/* Meta row — date + recipe summary */}
        {(date || recipeBits.length > 0) && (
          <p className="text-light-muted-foreground text-xs mt-1.5 truncate">
            {[date, ...recipeBits].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Flavor notes — matches the Chip primitive default look
            used in LightStepLog (taste log) so static tags and
            interactive chips share one visual language. */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
