"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-group error boundary for the whole (light) tree.
 *
 * Before this, any render throw in a step (e.g. a fresh-scan field crashing
 * buildCraftingPhases on the recipe-loading screen) bubbled to Next's root
 * handler and showed the bare black "Application error: a client-side
 * exception" page — a dead end, no way back to brewing. This catches the throw
 * and offers recovery (retry the segment, or head Home) without leaving the
 * app. The stale-chunk self-heal in the root layout still handles ChunkLoadError
 * separately (it reloads with a fresh shell); this is for genuine render throws.
 */
export default function LightError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the console for diagnosis; never shown to the user.
    console.error("[light] render error:", error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="space-y-2">
        <h1 className="font-fraunces text-[28px] leading-tight tracking-[-0.01em] text-light-foreground">
          This screen hit a snag.
        </h1>
        <p className="text-[14px] leading-relaxed text-light-foreground/70 max-w-[28ch] mx-auto">
          Try again — your coffee and context are still here. If it sticks, head
          Home and start fresh.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-3 w-full max-w-[16rem]">
        <button
          type="button"
          onClick={() => reset()}
          className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="w-full h-12 rounded-full flex items-center justify-center bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-[14px] text-light-foreground active:scale-[0.98] transition-transform"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
