"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/StarRating";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";

interface SessionCardProps {
  session: Session;
  onDeleted?: (id: string) => void;
}

const DELETE_THRESHOLD = 80;

export default function SessionCard({ session, onDeleted }: SessionCardProps) {
  const { coffee, result, recommendation } = session;

  const roaster = coffee?.roaster || "";
  const name = coffee?.name || "Coffee Session";
  const method = session.brew?.methodUsed || recommendation?.primaryMethod || "";
  const hasPhoto = !!coffee?.bagPhotoUrl;

  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startXRef = useRef<number | null>(null);
  const router = useRouter();

  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

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
    if (offset >= DELETE_THRESHOLD) setOffset(DELETE_THRESHOLD);
    else setOffset(0);
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
  const tags = result?.flavorNotes?.slice(0, 3) ?? [];

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "var(--card)" }}>
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-stretch rounded-r-2xl overflow-hidden">
        <button
          type="button"
          onClick={handleDelete}
          className="w-20 flex flex-col items-center justify-center gap-1 text-white active:opacity-80"
          style={{ background: "var(--destructive)" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Card */}
      <div
        style={{
          transform: `translateX(-${isOpen ? DELETE_THRESHOLD : offset}px)`,
          transition: startXRef.current === null ? "transform 0.2s ease" : "none",
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (isOpen) { setOffset(0); return; } router.push(`/brew/${session.id}`); }}
        className="relative border rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      >
        {/* Photo header — only when bag photo is available */}
        {hasPhoto && (
          <div className="relative h-36 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coffee!.bagPhotoUrl!}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            {/* Method + date overlay at bottom of photo */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-center justify-between gap-2">
              {method && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <BrewMethodIcon method={method} className="w-4 h-4 shrink-0 opacity-90" />
                  <span className="text-white/80 text-xs truncate">{method}</span>
                </div>
              )}
              {date && <span className="text-white/55 text-xs shrink-0">{date}</span>}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4">
          {/* Roaster */}
          {roaster && (
            <p className="text-xs mb-1.5 truncate" style={{ color: "var(--muted-foreground)" }}>{roaster}</p>
          )}

          {/* Coffee name + rating */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[15px] leading-snug flex-1" style={{ color: "var(--foreground)" }}>{name}</h3>
            {result?.rating != null && (
              <div className="shrink-0 mt-0.5">
                <StarRating value={result.rating} readonly size="sm" />
              </div>
            )}
          </div>

          {/* Method + date row — only when no photo */}
          {!hasPhoto && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {method && <BrewMethodIcon method={method} className="w-4 h-4" />}
              {method && (
                <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{method}</span>
              )}
              {date && (
                <>
                  {method && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>·</span>}
                  <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>{date}</span>
                </>
              )}
            </div>
          )}

          {/* Flavor tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs capitalize px-2.5 py-0.5 rounded-full border"
                  style={{
                    color: "var(--primary)",
                    borderColor: "var(--border)",
                    background: "#2A241C",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
