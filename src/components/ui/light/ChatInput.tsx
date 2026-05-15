"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp, Loader2 } from "lucide-react";

/**
 * BTTS Chat Input — specs/home.md §2 (input bar) + §3 (Pre-Composition Bubble).
 *
 * PR2d scope: Idle, Typing, and Loading. Composition is text-only.
 *
 * State machine:
 *   - Idle (!composing && !loading)         → Plus + "Ask anything…" pill + Waveform
 *   - Typing (composing && !loading)        → × + decorative pill + Pre-Comp Bubble above
 *   - Loading (loading; composing forced false during loading)
 *                                           → × + empty bar + Spinner, with three
 *                                             Dots above the bar (§2.2 mb-3)
 *
 * Textarea overrides: the project uses `@tailwindcss/forms`, which paints
 * a blue focus ring + adds 8/12px padding to every textarea. Both are
 * explicitly suppressed here (`border-0 p-0 focus:ring-0 focus:ring-offset-0
 * focus:border-transparent`) so the bubble hugs its content and the
 * focus state inherits the warm system instead of a stray Tailwind-blue.
 *
 * Send button placement: spec §3.1 specifies "in bottom-right of bubble,
 * m-2" — implemented via absolute positioning so the bubble height tracks
 * the textarea exactly rather than reserving a separate flex row.
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  /**
   * Fires when the user enters the Typing state for the first time. Home
   * uses this to dismiss the daily Conversation Starter (§8.3).
   */
  onComposeStart?: () => void;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text, composing]);

  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

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
    <footer className="flex flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {/* Pre-Composition Bubble — §3.
          Reserves 48px (pb-12) at the bottom for the absolute-positioned
          Send button so the bubble height tracks the textarea cleanly. */}
      {composing && !loading && (
        <div className="mb-2 flex justify-end">
          <div className="relative max-w-[calc(100%-64px)] rounded-2xl border border-light-foreground/10 bg-light-card-default p-3 pb-12 backdrop-blur-[14px] backdrop-saturate-150">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask anything…"
              rows={1}
              className="block w-full resize-none border-0 bg-transparent p-0 font-inter text-[15px] font-normal leading-[1.4] text-light-foreground placeholder:text-light-muted-foreground focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0"
            />
            <button
              type="button"
              onClick={send}
              disabled={sendDisabled}
              aria-label="Send"
              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)] transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}

      {/* Thinking dots — §2.2 "Empty bar with three Dots above (mb-3)".
          Indented past the × column so the dots sit visually above the
          pill area, not the cancel button. */}
      {loading && (
        <div className="mb-3 flex items-center gap-2 pl-14" aria-label="Thinking">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-light-foreground/60"
            style={{ animationDuration: "1200ms" }}
          />
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-light-foreground/60"
            style={{ animationDuration: "1200ms", animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-light-foreground/60"
            style={{ animationDuration: "1200ms", animationDelay: "300ms" }}
          />
        </div>
      )}

      {/* Input bar row */}
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
            aria-label="Sending"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-light-foreground/60"
          >
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </footer>
  );
}
