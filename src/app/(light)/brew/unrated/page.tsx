"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import { fetchPendingBrews, resumePendingBrew } from "@/lib/flow/resumeRating";
import { brewedWhen } from "@/lib/flow/brewedWhen";
import type { PendingBrewSummary } from "@/lib/types/pendingBrew";

/**
 * Brews that finished the timer but were never rated (pending_brews,
 * migration 0025). Rate → the Log screen with the brew as it was brewed.
 * Dismiss → stops the Home reminder; the brew moves to "Dismissed" and can
 * still be rated from there. Nothing here is in the session corpus until it
 * is rated and saved.
 */
export default function UnratedBrewsPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rows, setRows] = useState<PendingBrewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingBrews(true)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rate = async (id: string) => {
    setBusyId(id);
    setError(null);
    const ok = await resumePendingBrew(id);
    setBusyId(null);
    if (ok) router.push("/brew/new");
    else setError("Couldn't open this brew. Check the connection and try again.");
  };

  const setDismissed = async (id: string, dismissed: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/pending-brews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, dismissedAt: dismissed ? new Date().toISOString() : null } : r)),
      );
    } catch {
      setError("Couldn't update this brew. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const open = rows.filter((r) => !r.dismissedAt);
  const dismissed = rows.filter((r) => r.dismissedAt);

  const renderRow = (r: PendingBrewSummary) => (
    <li
      key={r.id}
      className="flex items-center gap-3 rounded-2xl border border-light-foreground/25 bg-light-card-default px-4 py-3 backdrop-blur-light-card backdrop-saturate-150"
    >
      {r.bagPhotoUrl && (
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.bagPhotoUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-chivo text-[12px] font-normal text-light-muted-foreground">
          {brewedWhen(r.createdAt)}
          {r.method ? ` · ${r.method}` : ""}
        </span>
        <span className="truncate font-chivo text-[15px] font-medium text-light-foreground">
          {r.coffeeName || "Unnamed coffee"}
        </span>
        {r.roaster && (
          <span className="truncate font-chivo text-[12px] text-light-muted-foreground">{r.roaster}</span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          disabled={busyId === r.id}
          onClick={() => void rate(r.id)}
          className="flex h-9 items-center rounded-full bg-light-foreground px-4 font-chivo text-[13px] font-medium text-light-text-on-dark shadow-light-float active:scale-[0.98] disabled:opacity-60"
        >
          Rate
        </button>
        <button
          type="button"
          disabled={busyId === r.id}
          onClick={() => void setDismissed(r.id, !r.dismissedAt)}
          className="font-chivo text-[12px] text-light-muted-foreground underline-offset-2 active:underline disabled:opacity-60"
        >
          {r.dismissedAt ? "Remind me" : "Dismiss"}
        </button>
      </div>
    </li>
  );

  return (
    <>
      <main className="flex h-dvh flex-col">
        <header
          className="flex shrink-0 items-center justify-between px-5 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
        >
          <h1 className="font-fraunces text-3xl leading-none text-light-foreground">To rate</h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark shadow-light-float"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        <section className="scroll-y-only flex-1 min-h-0 overflow-y-auto px-5 py-5">
          {error && <p className="mb-3 font-chivo text-[13px] text-light-foreground">{error}</p>}
          {loading ? (
            <p className="font-chivo text-[15px] text-light-muted-foreground">Loading brews…</p>
          ) : rows.length === 0 ? (
            <p className="font-chivo text-[15px] text-light-muted-foreground">
              Every brew is rated. A brew lands here when you leave the taste log without saving.
            </p>
          ) : (
            <>
              {open.length > 0 && <ul className="flex flex-col gap-3">{open.map(renderRow)}</ul>}
              {dismissed.length > 0 && (
                <>
                  <p className="mb-3 mt-8 font-chivo text-xs uppercase tracking-widest text-light-muted-foreground">
                    Dismissed
                  </p>
                  <ul className="flex flex-col gap-3">{dismissed.map(renderRow)}</ul>
                </>
              )}
            </>
          )}
        </section>
      </main>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
