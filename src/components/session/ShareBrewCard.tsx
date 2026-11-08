"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import { renderBrewCard } from "@/lib/share/renderBrewCard";
import type { BrewCardData } from "@/lib/share/brewCard";
import type { FieldZones } from "@/lib/field/types";

type State =
  | { kind: "idle" }
  | { kind: "rendering" }
  | { kind: "ready"; url: string; file: File; canShare: boolean }
  | { kind: "error"; message: string };

/**
 * The round "share" button on a brew's detail page: renders the brew as a
 * one-screen card (PNG) and hands it to the system share sheet, or offers it
 * to save where the browser cannot share files.
 */
export default function ShareBrewCardButton({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);
  useEffect(() => revoke, [revoke]);

  const close = useCallback(() => {
    revoke();
    setState({ kind: "idle" });
  }, [revoke]);

  const render = useCallback(async () => {
    setState({ kind: "rendering" });
    try {
      const res = await fetch(`/api/sessions/${sessionId}/card`, { cache: "no-store" });
      if (!res.ok) throw new Error(`card ${res.status}`);
      const { card, fieldZones } = (await res.json()) as { card: BrewCardData; fieldZones: FieldZones | null };
      const blob = await renderBrewCard(card, fieldZones);
      const file = new File([blob], `btts-${sessionId}.png`, { type: "image/png" });
      revoke();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const canShare = typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      setState({ kind: "ready", url, file, canShare });
    } catch (err) {
      console.error("[share-card] render failed:", err);
      setState({ kind: "error", message: "The card could not be rendered." });
    }
  }, [sessionId, revoke]);

  const share = useCallback(async () => {
    if (state.kind !== "ready") return;
    try {
      await navigator.share({ files: [state.file], title: "A brew from BTTS" });
    } catch (err) {
      // The user closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[share-card] share failed:", err);
    }
  }, [state]);

  const open = state.kind !== "idle";

  return (
    <>
      <button
        type="button"
        onClick={render}
        aria-label="Share this brew"
        className="absolute right-16 w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-blur-sm flex items-center justify-center text-light-foreground active:scale-95 transition-transform"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Share className="w-5 h-5" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-light-scrim/45 backdrop-blur-light-card backdrop-saturate-150"
          role="dialog"
          aria-modal="true"
          aria-label="Share this brew"
        >
          <div className="flex justify-end px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="w-10 h-10 rounded-full bg-light-card-default/85 backdrop-blur-light-card backdrop-saturate-150 flex items-center justify-center text-light-foreground active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-4">
            {state.kind === "rendering" && (
              <div className="flex flex-col items-center gap-4">
                <CoffeeBeanGlow size={64} />
                <p className="text-light-text-on-dark text-sm">Rendering the card…</p>
              </div>
            )}
            {state.kind === "error" && <p className="text-light-text-on-dark text-sm text-center">{state.message}</p>}
            {state.kind === "ready" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.url}
                alt="The brew as a card"
                className="max-h-full max-w-full rounded-2xl shadow-light-float"
                style={{ aspectRatio: "9 / 16" }}
              />
            )}
          </div>

          <div className="px-5 pb-8 flex flex-col gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
            {state.kind === "ready" && state.canShare && (
              <button
                type="button"
                onClick={share}
                className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform"
              >
                Share
              </button>
            )}
            {state.kind === "ready" && !state.canShare && (
              <>
                <a
                  href={state.url}
                  download={state.file.name}
                  className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform flex items-center justify-center"
                >
                  Save image
                </a>
                <p className="text-light-text-on-dark/75 text-xs text-center">Or press and hold the card to save it.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
