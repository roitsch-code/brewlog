"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { FRESH_DISMISSED_KEY, FRESH_LAST_OPEN_KEY, freshQueue, readDismissed, type FreshItem } from "@/lib/fresh/freshItems";

/**
 * The "Fresh" strip on the Context step (2026-10-19): up to two things that
 * are new since the last time this step was opened on this device — a
 * recipe the scout added, a coach insight, a new card for this bag. A tap on
 * a recipe prefills "Anything else" with its name (the existing
 * userRequest path leads the menu with it); a coach line goes to /taste; a
 * card to the coffee page. Dismiss hides a key for good on this device.
 * Renders nothing when nothing is new — the step looks exactly as before.
 */
export default function FreshStrip({
  coffeeId,
  waterMl,
  onPickRecipe,
}: {
  coffeeId?: string;
  waterMl?: number;
  onPickRecipe: (recipeName: string) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<FreshItem[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let since: number | undefined;
    try {
      const raw = localStorage.getItem(FRESH_LAST_OPEN_KEY);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) since = n;
      dismissedRef.current = readDismissed(localStorage.getItem(FRESH_DISMISSED_KEY));
    } catch {
      /* no storage — show the window's items once */
    }
    const q = new URLSearchParams();
    if (since) q.set("since", String(since));
    if (coffeeId) q.set("coffeeId", coffeeId);
    if (waterMl) q.set("waterMl", String(waterMl));
    let cancelled = false;
    fetch(`/api/fresh?${q.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: FreshItem[] } | null) => {
        if (cancelled || !data?.items) return;
        setItems(freshQueue(data.items, dismissedRef.current));
        // Whatever arrived after this moment is "fresh" next time.
        try {
          localStorage.setItem(FRESH_LAST_OPEN_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coffeeId, waterMl]);

  if (items.length === 0) return null;

  const dismiss = (key: string) => {
    const next = new Set(dismissedRef.current);
    next.add(key);
    dismissedRef.current = next;
    try {
      localStorage.setItem(FRESH_DISMISSED_KEY, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
    setItems((cur) => cur.filter((i) => i.key !== key));
  };

  const open = (item: FreshItem) => {
    if (item.kind === "recipe" && item.recipeName) {
      onPickRecipe(item.recipeName);
      dismiss(item.key);
      return;
    }
    if (item.href) router.push(item.href);
  };

  return (
    <div className="mb-10">
      <p className="label-eyebrow mb-3">Fresh</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-start gap-2 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
            <button type="button" onClick={() => open(item)} className="min-w-0 flex-1 text-left active:opacity-80">
              <p className="text-[14px] font-medium leading-snug text-light-foreground">{item.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-light-foreground/70">
                {item.kind === "recipe" ? `${item.body} — tap to brew it today` : item.body}
              </p>
            </button>
            <button type="button" onClick={() => dismiss(item.key)} aria-label="Dismiss" className="shrink-0 rounded-full p-1 text-light-muted-foreground active:opacity-70">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
