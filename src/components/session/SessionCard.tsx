"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";

interface SessionCardProps {
  session: Session;
  onDeleted?: (id: string) => void;
}

const DELETE_THRESHOLD = 80;

export default function SessionCard({ session, onDeleted }: SessionCardProps) {
  const { coffee, result } = session;

  const roaster = coffee?.roaster || "";
  const name = coffee?.name || "Coffee Session";
  const originProcess = [coffee?.origin, coffee?.process].filter(Boolean).join(" – ");

  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startXRef = useRef<number | null>(null);
  const router = useRouter();

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
    if (offset >= DELETE_THRESHOLD) {
      setOffset(DELETE_THRESHOLD);
    } else {
      setOffset(0);
    }
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

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          onClick={handleDelete}
          className="w-20 bg-red-600 flex flex-col items-center justify-center gap-1 text-white active:bg-red-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Card (slides left on swipe) */}
      <div
        style={{ transform: `translateX(-${isOpen ? DELETE_THRESHOLD : offset}px)`, transition: startXRef.current === null ? "transform 0.2s ease" : "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (isOpen) { setOffset(0); return; } router.push(`/brew/${session.id}`); }}
        className="relative bg-brew-surface border border-brew-border/50 rounded-2xl overflow-hidden active:scale-[0.98] transition-[box-shadow] cursor-pointer"
      >
        {coffee?.bagPhotoUrl ? (
          /* Photo card */
          <div className="relative h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coffee.bagPhotoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 card-scrim" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {roaster && <p className="text-white/60 text-xs mb-1">{roaster}</p>}
              <h3 className="font-display text-xl text-white leading-tight">{name}</h3>
              {originProcess && <p className="text-white/60 text-sm mt-0.5">{originProcess}</p>}
            </div>
            {result?.rating != null && (
              <div className="absolute top-3 right-3">
                <StarRating value={result.rating} readonly size="sm" />
              </div>
            )}
          </div>
        ) : (
          /* Text card */
          <div className="p-4 bg-gradient-to-br from-brew-surface to-brew-elevated min-h-[110px] flex flex-col justify-between">
            <div>
              {roaster && <p className="text-brew-muted text-xs mb-1">{roaster}</p>}
              <h3 className="font-display text-xl text-white leading-tight">{name}</h3>
              {originProcess && <p className="text-brew-muted text-sm mt-0.5">{originProcess}</p>}
            </div>
            {result?.rating != null && (
              <div className="mt-3">
                <StarRating value={result.rating} readonly size="sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
