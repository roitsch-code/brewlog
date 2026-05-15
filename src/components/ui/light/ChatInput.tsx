"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp, Loader2 } from "lucide-react";

/**
 * BTTS Chat Input — specs/home.md §2 (input bar) + §3 (Pre-Composition Bubble).
 *
 * PR2d scope: Idle, Typing, and Loading. Composition is text-only.
 * Voice / attachments / coffee references / action pills land in later PRs.
 *
 * State machine:
 *   - Idle (!composing && !loading)         → Plus + "Ask anything…" pill + Waveform
 *   - Typing (composing && !loading)        → Cancel + decorative pill + Pre-Comp Bubble above
 *   - Loading (loading; composing forced false during loading) → Cancel + empty pill + Spinner
 *
 * Spec §3 requires the input pill to stay visible *below* the Bubble during
 * composition so the user has a continuous visual anchor; that's preserved
 * here by rendering both rows in the same footer.
 *
 * Cancel during loading is a UI affordance only in PR2d — the in-flight
 * fetch is not aborted yet (PR2f adds proper cancellation alongside the
 * cancel-during-recording / cancel-during-streaming distinctions).
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  /**
   * Fires when the user enters the Typing state for the first time. Home
   * uses this to dismiss the daily Conversation Starter (§8.3 — first
   * composition action dismisses the Starter, even before a send).
   */
  onComposeStart?: () => void;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea to fit content, no manual rows config.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text, composing]);

  // Focus the textarea when the Bubble opens so the keyboard rises immediately.
  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

  // Loading wins over composing — the Bubble closes when a send is in flight.
  useEffect(() => {
    if (loading && composing) setComposing(false);
  }, [loading, composing]);

  const enterCompose = () => {
    if (loading) return;
    if (!composing) onComposeStart?.();
    setComposing(true);
  };

  const cancel = () => {
    setComposing(false);
    setText("");
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText("");
    setComposing(false);
  };

  const sendDisabled = !text.trim();

  return (
    <footer className="flex flex-col gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {/* Pre-Composition Bubble — §3.
          Right-aligned; bubble grows with content; Send (↑) sits in the
          bubble's bottom-right per §3.1. Reserves 64px on the left for the
          × in the bar row below to remain visually clear. */}
      {composing && !loading && (
        <div className="flex justify-end">
          <div className="max-w-[calc(100%-64px)] rounded-2xl border border-light-foreground/10 bg-light-card-default p-3 backdrop-blur-[14px] backdrop-saturate-150">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask anything…"
              rows={1}
              className="block w-full resize-none bg-transparent font-inter text-[15px] font-normal leading-[1.4] text-light-foreground placeholder:text-light-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={send}
                disabled={sendDisabled}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)] transition-opacity disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input bar row.
          Left: + (idle) or × (composing/loading).
          Middle: tappable pill (idle), decorative pill (composing), empty
          pill (loading).
          Right: Waveform inside the pill (idle/composing) — replaced by an
          external spinner in loading state. */}
      <div className="flex items-center gap-3">
        {composing || loading ? (
          <button
            type="button"
            onClick={cancel}
            disabled={loading}
            aria-label={loading ? "Sending" : "Cancel"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150 disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : (
          <div
            aria-label="Attach"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          </div>
        )}

        {loading ? (
          <div className="h-11 flex-1 rounded-full border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150" />
        ) : (
          <button
            type="button"
            onClick={enterCompose}
            disabled={composing}
            className="flex h-11 flex-1 cursor-text items-center justify-between rounded-full border border-light-foreground/10 bg-light-card-default pl-5 pr-3 text-left backdrop-blur-[14px] backdrop-saturate-150 disabled:cursor-default"
          >
            <span className="font-inter text-[15px] font-normal text-light-muted-foreground">
              Ask anything…
            </span>
            <AudioLines
              className="mr-2 h-5 w-5 text-light-foreground/60"
              strokeWidth={1.5}
            />
          </button>
        )}

        {loading && (
          <div
            aria-label="Thinking"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-light-foreground/60"
          >
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </footer>
  );
}
