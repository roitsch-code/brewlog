"use client";

/**
 * ScalePanel — the Acaia connect / tare control bar on the brew screen.
 *
 * Renders nothing off the native shell (the hook's `available` is false on the
 * Safari PWA / desktop), so it's invisible everywhere the scale can't exist.
 *
 * It is a SLIM, fixed-height bar that's always present during the brew — Connect
 * when disconnected, Tare + Disconnect when connected. The live weight does NOT
 * live here anymore; it ticks inline in the active pour step's grams figure
 * (LiveStepBrew → CumulativeTarget). Keeping this bar a constant height in every
 * state is deliberate: the old card swapped between a big readout and a connect
 * prompt, which shoved the whole brew screen up and down mid-pour.
 */
import type { UseAcaiaScale } from "@/hooks/useAcaiaScale";

export function ScalePanel({
  available,
  status,
  connect,
  disconnect,
  tare,
}: UseAcaiaScale) {
  if (!available) return null;

  const connected = status === "connected";
  const busy = status === "scanning" || status === "connecting";

  const statusLabel = connected
    ? "Scale connected"
    : status === "scanning"
      ? "Looking for your scale…"
      : status === "connecting"
        ? "Connecting…"
        : status === "not-found"
          ? "No scale found — wake it"
          : status === "error"
            ? "Couldn't reach the scale"
            : "Connect your Acaia for live weight";

  return (
    <div className="flex h-12 items-center justify-between gap-3 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 pl-4 pr-1.5">
      <span className="truncate text-[13px] text-light-muted-foreground">{statusLabel}</span>
      {connected ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={tare}
            className="h-9 rounded-full bg-light-foreground px-4 text-[13px] font-semibold text-light-text-on-dark active:scale-95 transition-transform"
          >
            Tare
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="h-9 rounded-full px-3 text-[13px] font-medium text-light-muted-foreground active:scale-95 transition-transform"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="h-9 shrink-0 rounded-full bg-light-foreground px-5 text-[13px] font-semibold text-light-text-on-dark active:scale-95 transition-transform disabled:opacity-50"
        >
          {status === "not-found" || status === "error" ? "Retry" : "Connect"}
        </button>
      )}
    </div>
  );
}
