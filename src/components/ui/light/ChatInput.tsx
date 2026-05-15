"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp } from "lucide-react";

/**
 * BTTS Chat Input — inline pill variant.
 *
 * Departs from specs/home.md §3 (Pre-Composition Bubble). User feedback on
 * the first PR2d test: a separate Glass bubble floating above the pill —
 * while the pill still shows "Ask anything…" placeholder — felt
 * counter-intuitive. The pill is now the textarea: tap → focus → type →
 * the pill grows vertically as the text wraps. Send (↑) sits inside the
 * pill on the right where the Waveform sat in idle, replacing it as soon
 * as there is text.
 *
 * State machine:
 *   - Empty + not loading: + (left, decorative until PR2g) | pill with
 *     "Ask anything…" placeholder | Waveform (right, decorative until PR2f)
 *   - HasText + not loading: × (left, clears text) | pill with text |
 *     Send (right, ships the message)
 *   - Loading: × (left, decorative until PR2f cancel) | empty bar |
 *     three Dots animated above the bar (specs/home.md §2.2 mb-3)
 *
 * Departed from spec also: no right-side Spinner during Thinking. The
 * three Dots above the bar already carry the loading signal; the spinner
 * was redundant.
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  /** Fires the first time the textarea is focused — Home dismisses the
   *  Conversation Starter on this signal (§8.3). */
  onComposeStart?: () => void;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composeStartedRef = useRef(false);

  // Auto-grow textarea to fit content.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text, loading]);

  const hasText = text.trim().length > 0;

  const handleFocus = () => {
    if (!composeStartedRef.current) {
      composeStartedRef.current = true;
      onComposeStart?.();
    }
  };

  const clear = () => {
    if (loading) return;
    setText("");
    textareaRef.current?.focus();
  };

  const send = () => {
    if (!hasText || loading) return;
    onSend(text.trim());
    setText("");
    composeStartedRef.current = false;
    textareaRef.current?.blur();
  };

  return (
    <footer className="flex flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {/* Thinking dots — §2.2 "three Dots above (mb-3)". Indented past the
          × column so the dots sit visually above the pill area. */}
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

      <div className="flex items-end gap-3">
        {/* Left button: × when text present or loading, otherwise + */}
        {hasText || loading ? (
          <button
            type="button"
            onClick={clear}
            disabled={loading}
            aria-label={loading ? "Sending" : "Clear"}
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

        {/* Pill — empty during loading; otherwise hosts the textarea and
            the right-edge inline icon (Waveform when empty, Send when
            text present). items-end keeps the inline icon aligned with
            the last line of text as the textarea grows. */}
        {loading ? (
          <div className="h-11 flex-1 rounded-full border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150" />
        ) : (
          <div className="flex min-h-11 flex-1 items-end gap-1 rounded-3xl border border-light-foreground/10 bg-light-card-default py-1.5 pl-5 pr-1.5 backdrop-blur-[14px] backdrop-saturate-150">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={handleFocus}
              placeholder="Ask anything…"
              rows={1}
              className="block min-h-[2rem] w-full resize-none border-0 bg-transparent p-0 font-inter text-[15px] font-normal leading-[2rem] text-light-foreground placeholder:text-light-muted-foreground focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0"
            />
            {hasText ? (
              <button
                type="button"
                onClick={send}
                aria-label="Send"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)]"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : (
              <div
                aria-label="Voice"
                className="flex h-8 w-8 shrink-0 items-center justify-center text-light-foreground/60"
              >
                <AudioLines className="h-5 w-5" strokeWidth={1.5} />
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
