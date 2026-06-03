"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import StarRating from "@/components/ui/light/StarRating";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import { useFieldConfig } from "@/lib/field/FieldContext";
import type { FieldZones } from "@/lib/field/types";
import type { DripBag } from "@/lib/types/dripBag";
import { gradientCreamScrim } from "@/lib/theme/gradients";

/**
 * Drip-bag detail — read-only documentation view. No rotation toggle, no
 * Brew CTA, no coach card (a drip bag brews one fixed way and isn't in the
 * AI corpus). The static /coffees/drip/* segment takes routing precedence
 * over /coffees/[id], so there's no collision.
 */
export default function DripBagDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bag, setBag] = useState<DripBag | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/drip-bags/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<DripBag>) : null))
      .then((d) => {
        if (!cancelled) {
          setBag(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFieldConfig(bag?.fieldZones ? { fieldZones: bag.fieldZones as FieldZones, rotation: 0 } : null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/drip-bags/${id}`, { method: "DELETE" });
      router.push("/coffees");
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col">
        <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
          <button onClick={() => router.push("/coffees")} className="text-light-muted-foreground text-sm">
            ← Library
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
      </div>
    );
  }

  if (!bag) {
    return (
      <div className="min-h-svh bg-transparent flex flex-col items-center justify-center gap-4">
        <p className="text-light-muted-foreground">Drip bag not found</p>
        <button onClick={() => router.push("/coffees")} className="text-light-foreground underline">
          Back to library
        </button>
      </div>
    );
  }

  const meta = [bag.origin, bag.region, bag.process, bag.variety, bag.roastLevel].filter(
    (v): v is string => !!v
  );

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      {/* Hero */}
      <div className="relative">
        {bag.bagPhotoUrl ? (
          <div className="relative h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bag.bagPhotoUrl} alt={bag.name} className="w-full h-full object-cover" />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: gradientCreamScrim }}
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
        <div className={`${bag.bagPhotoUrl ? "absolute bottom-0 left-0 right-0" : ""} p-5`}>
          <p className="text-light-foreground/50 text-xs tracking-widest uppercase mb-1">Drip bag</p>
          <h1 className="font-fraunces text-3xl text-light-foreground">{bag.name}</h1>
          <p className="text-light-foreground/60 text-sm mt-1">
            {bag.roaster}
            {bag.origin ? ` · ${bag.origin}` : ""}
          </p>
        </div>
      </div>

      {/* Rating */}
      {bag.rating > 0 && (
        <div className="px-5 py-4 border-b border-light-foreground/15 flex items-center gap-3">
          <StarRating value={bag.rating} readonly size="sm" />
          <span className="text-light-muted-foreground text-xs uppercase tracking-widest">Your rating</span>
        </div>
      )}

      {/* Identity chips */}
      {meta.length > 0 && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-3">Coffee details</p>
          <div className="flex flex-wrap gap-1.5">
            {meta.map((v) => (
              <span
                key={v}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Printed notes */}
      {bag.bagNotes.length > 0 && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-3">Printed notes</p>
          <div className="flex flex-wrap gap-1.5">
            {bag.bagNotes.map((nVal) => (
              <span
                key={nVal}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {nVal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Your flavours */}
      {bag.flavorNotes.length > 0 && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-3">You tasted</p>
          <div className="flex flex-wrap gap-1.5">
            {bag.flavorNotes.map((nVal) => (
              <span
                key={nVal}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {nVal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Free notes */}
      {bag.freeNotes && (
        <div className="px-5 py-4 border-b border-light-foreground/15">
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-2">Your notes</p>
          <p className="text-light-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">{bag.freeNotes}</p>
        </div>
      )}

      {/* Delete */}
      <div className="px-5 py-6 pb-safe pb-8">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-2xl text-sm text-light-muted-foreground border border-light-foreground/15"
          >
            Delete drip bag
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 rounded-2xl text-sm font-medium bg-light-destructive text-light-text-on-dark disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-3 rounded-2xl text-sm border border-light-foreground/15 text-light-muted-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
