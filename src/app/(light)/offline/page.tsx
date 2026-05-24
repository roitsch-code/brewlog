import Link from "next/link";

export const dynamic = "force-static";

/**
 * Service-worker document fallback (next.config.mjs `fallbacks.document`).
 * Shown when an uncached route is navigated to while offline. The core
 * offline path — re-brewing a known coffee — lives under the precached
 * /coffees + /brew/new shell, so this is a safety net, not the main door.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-svh bg-transparent flex flex-col items-center justify-center gap-5 px-8 text-center">
      <h1 className="font-fraunces text-3xl text-light-foreground">You&apos;re offline</h1>
      <p className="text-light-muted-foreground text-sm leading-relaxed max-w-xs">
        This page isn&apos;t available offline. You can still re-brew a coffee you&apos;ve logged
        before from your library.
      </p>
      <Link
        href="/coffees"
        className="h-12 px-6 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] text-sm font-semibold flex items-center active:scale-[0.98] transition-transform"
      >
        Open your library
      </Link>
    </div>
  );
}
