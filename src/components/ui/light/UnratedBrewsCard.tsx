"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ChevronRight } from "lucide-react";
import { fetchPendingBrews, resumePendingBrew } from "@/lib/flow/resumeRating";
import { brewedWhen } from "@/lib/flow/brewedWhen";
import type { PendingBrewSummary } from "@/lib/types/pendingBrew";

/**
 * Home reminder for brews that finished the timer but were never rated
 * (pending_brews, migration 0025). Hidden when there are none. One brew → the
 * tap opens its Log screen directly; several → the /brew/unrated list.
 * Dismissed brews are not counted here (they stay on the list page).
 */
export default function UnratedBrewsCard() {
  const router = useRouter();
  const [rows, setRows] = useState<PendingBrewSummary[]>([]);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPendingBrews()
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (rows.length === 0) return null;

  const single = rows.length === 1 ? rows[0] : null;
  const title = single
    ? `Rate your ${single.coffeeName || "last brew"}`
    : `${rows.length} brews waiting for a rating`;
  const sub = single ? `Brewed ${brewedWhen(single.createdAt)}` : `Latest: ${brewedWhen(rows[0].createdAt)}`;

  const open = async () => {
    if (opening) return;
    if (!single) {
      router.push("/brew/unrated");
      return;
    }
    setOpening(true);
    const ok = await resumePendingBrew(single.id);
    setOpening(false);
    router.push(ok ? "/brew/new" : "/brew/unrated");
  };

  return (
    <div className="shrink-0 px-5 pb-3">
      <button
        type="button"
        onClick={() => void open()}
        aria-busy={opening}
        className="flex w-full items-center gap-3 rounded-2xl bg-light-foreground px-4 py-3 text-left text-light-text-on-dark shadow-light-float active:scale-[0.98] transition-transform"
      >
        <Star className="h-5 w-5 shrink-0" strokeWidth={1.5} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-chivo text-[15px] font-medium">{title}</span>
          <span className="truncate font-chivo text-[12px] font-normal text-light-text-on-dark/75">{sub}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-light-text-on-dark/75" strokeWidth={1.5} />
      </button>
    </div>
  );
}
