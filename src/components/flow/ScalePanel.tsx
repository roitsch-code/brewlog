"use client";

/**
 * ScalePanel — live Acaia weight on the brew screen.
 *
 * Renders nothing off the native shell (the hook's `available` is false on the
 * Safari PWA / desktop), so this is invisible everywhere the scale can't exist.
 * In the shell it offers a Connect action, then shows live grams + Tare while
 * connected. v1: read-only weight + tare; pour auto-advance comes later.
 */
import { useAcaiaScale } from "@/hooks/useAcaiaScale";

export function ScalePanel() {
  const { available, status, weight, connect, disconnect, tare } = useAcaiaScale();

  if (!available) return null;

  const connected = status === "connected";
  const busy = status === "scanning" || status === "connecting";

  return (
    <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
      {connected ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-eyebrow">Scale</p>
            <p className="font-fraunces text-[32px] leading-none text-light-foreground tabular-nums mt-1">
              {(weight ?? 0).toFixed(1)}
              <span className="text-light-muted-foreground text-[18px] ml-1">g</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={tare}
              className="h-10 rounded-full bg-light-foreground px-5 text-sm font-semibold text-light-text-on-dark active:scale-[0.98] transition-transform"
            >
              Tare
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="h-10 rounded-full border border-light-foreground/15 px-4 text-sm font-medium text-light-muted-foreground active:scale-[0.98] transition-transform"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-eyebrow">Scale</p>
            <p className="text-sm text-light-muted-foreground mt-1">
              {status === "scanning"
                ? "Looking for your scale…"
                : status === "connecting"
                  ? "Connecting…"
                  : status === "not-found"
                    ? "No scale found nearby. Wake it and try again."
                    : status === "error"
                      ? "Couldn't reach the scale. Try again."
                      : "Connect your Acaia for live weight."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="h-10 rounded-full bg-light-foreground px-5 text-sm font-semibold text-light-text-on-dark active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {status === "not-found" || status === "error" ? "Retry" : "Connect"}
          </button>
        </div>
      )}
    </div>
  );
}
