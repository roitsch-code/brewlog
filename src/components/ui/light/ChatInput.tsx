"use client";

import { useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp, Square, Loader2 } from "lucide-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import WaveformBars from "@/components/ui/WaveformBars";

/**
 * BTTS Chat Input — Idle / Typing / Voice / Loading.
 *
 * Editor is a <div contenteditable> (PR #53) so iOS WebKit doesn't paint
 * its form input accessory bar above the keyboard.
 *
 * Voice flow (specs/home.md §2.4):
 *   - Phase 1 — Recording. Tap the Waveform inside the idle pill. The
 *     pill morphs into a full-width Recording-pill with live audio-level
 *     bars; × on the left cancels (audio discarded), Stop on the right
 *     ends the recording and ships the audio to ElevenLabs Scribe.
 *   - Phase 2 — Transcribing. Same pill, level bars freeze, Stop is
 *     swapped for a small spinner. Lasts ~1–2 s.
 *   - Phase 3 — Transcript Review. The transcribed text is dropped
 *     straight into the contenteditable editor and focused, so the user
 *     is now in the regular Typing state with the transcript pre-filled.
 *     They can edit (fix mis-heard coffee names per the §2.4 anti-
 *     pattern) and Send (↑), or × to discard and return to Idle.
 *
 * TTS output (§4.6) is deliberately deferred — it needs a default-off
 * opt-in toggle the spec lists as out of v1 (§12). When that lands, the
 * hook to wire is /api/voice/synthesize via useVoicePlayback.
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  /** First focus / voice-start signal — Home dismisses the Starter on it. */
  onComposeStart?: () => void;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [text, setText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const composeStartedRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissError = (delay: number) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setVoiceError(null), delay);
  };

  const markComposed = () => {
    if (!composeStartedRef.current) {
      composeStartedRef.current = true;
      onComposeStart?.();
    }
  };

  const voice = useVoiceCapture({
    onTranscript: (transcript) => {
      markComposed();
      setText(transcript);
      if (editorRef.current) {
        editorRef.current.textContent = transcript;
        editorRef.current.focus();
        // Cursor at end of inserted text so the user can append, not overwrite.
        try {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {
          /* ignore — selection APIs vary across iOS WebKit builds */
        }
      }
    },
    onError: (msg) => {
      setVoiceError(msg);
      dismissError(5000);
    },
  });

  const hasText = text.trim().length > 0;
  const isRecording = voice.recording;
  const isTranscribing = voice.busy && !voice.recording;
  const isVoiceActive = isRecording || isTranscribing;

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setText(e.currentTarget.textContent ?? "");
  };

  const handleFocus = () => {
    markComposed();
  };

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

  const startVoice = async () => {
    if (loading || hasText) return;
    setVoiceError(null);
    markComposed();
    await voice.start();
  };

  const stopVoice = async () => {
    await voice.stop();
  };

  const cancelVoice = () => {
    voice.cancel();
  };

  return (
    <footer className="flex flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {voiceError && (
        <div
          role="alert"
          className="mb-2 rounded-2xl border border-light-foreground/10 bg-light-card-default px-3 py-2 font-inter text-[13px] text-light-foreground backdrop-blur-[14px] backdrop-saturate-150"
        >
          {voiceError}
        </div>
      )}

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
        {/* Left button — × when voice is active, when text is present,
            or while a request is in flight; otherwise + (attach). */}
        {isVoiceActive ? (
          <button
            type="button"
            onClick={cancelVoice}
            disabled={isTranscribing}
            aria-label="Cancel recording"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150 disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : hasText || loading ? (
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

        {/* Middle */}
        {loading ? (
          <div className="h-11 flex-1 rounded-full border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150" />
        ) : isVoiceActive ? (
          <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-light-foreground/10 bg-light-card-default pl-5 pr-1.5 backdrop-blur-[14px] backdrop-saturate-150">
            <WaveformBars
              getLevel={voice.getLevel}
              color="hsl(20 14% 12%)"
              height={20}
              bars={28}
              className="flex-1"
            />
            {isTranscribing ? (
              <div
                aria-label="Transcribing"
                className="flex h-8 w-8 shrink-0 items-center justify-center text-light-foreground/60"
              >
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
              </div>
            ) : (
              <button
                type="button"
                onClick={stopVoice}
                aria-label="Stop recording"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)]"
              >
                <Square className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              </button>
            )}
          </div>
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
              <button
                type="button"
                onClick={startVoice}
                aria-label="Voice"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-light-foreground/60"
              >
                <AudioLines className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
