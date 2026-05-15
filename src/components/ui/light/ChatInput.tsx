"use client";

import { useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp } from "lucide-react";

/**
 * BTTS Chat Input — contenteditable inline pill.
 *
 * iOS Safari paints a form input accessory bar (prev/next arrows + Done
 * checkmark) above the keyboard whenever a <textarea> or <input> is
 * focused. There is no web-standard API to suppress it. The canonical
 * workaround — used by every modern chat app on the mobile web — is to
 * back the editor with a <div contenteditable="true"> instead.
 *
 * Side benefit: the contenteditable div auto-grows with its content
 * natively, so the scrollHeight tracking we needed for the textarea is
 * gone.
 *
 * State machine unchanged from PR2d:
 *   - Empty + idle: + (left) | pill ("Ask anything…" placeholder) +
 *                   Waveform inside pill
 *   - HasText:      × (left, clear) | pill with text | Send inside pill
 *   - Loading:      × (decorative) | empty bar | three Dots above
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  /** First focus signal — Home dismisses the Conversation Starter on it. */
  onComposeStart?: () => void;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [text, setText] = useState("");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const composeStartedRef = useRef(false);

  const hasText = text.trim().length > 0;

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setText(e.currentTarget.textContent ?? "");
  };

  const handleFocus = () => {
    if (!composeStartedRef.current) {
      composeStartedRef.current = true;
      onComposeStart?.();
    }
  };

  // Keep input plain-text — strip HTML formatting on paste.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, pasted);
  };

  const clear = () => {
    if (loading) return;
    if (editorRef.current) editorRef.current.textContent = "";
    setText("");
    editorRef.current?.focus();
  };

  const send = () => {
    if (!hasText || loading) return;
    onSend(text.trim());
    if (editorRef.current) editorRef.current.textContent = "";
    setText("");
    composeStartedRef.current = false;
    editorRef.current?.blur();
  };

  return (
    <footer className="flex flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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

        {loading ? (
          <div className="h-11 flex-1 rounded-full border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150" />
        ) : (
          <div className="flex min-h-11 flex-1 items-end gap-1 rounded-3xl border border-light-foreground/10 bg-light-card-default py-1.5 pl-5 pr-1.5 backdrop-blur-[14px] backdrop-saturate-150">
            <div className="relative min-h-8 flex-1">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Message"
                onInput={handleInput}
                onFocus={handleFocus}
                onPaste={handlePaste}
                className="block min-h-8 w-full whitespace-pre-wrap break-words font-inter text-[16px] font-normal leading-[2rem] text-light-foreground focus:outline-none"
              />
              {!hasText && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 font-inter text-[16px] font-normal leading-[2rem] text-light-muted-foreground"
                >
                  Ask anything…
                </span>
              )}
            </div>
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
