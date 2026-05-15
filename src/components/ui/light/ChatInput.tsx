"use client";

import { useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp, Square, Loader2 } from "lucide-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import WaveformBars from "@/components/ui/WaveformBars";
import AttachmentSheet from "@/components/ui/light/AttachmentSheet";

/**
 * BTTS Chat Input — Idle / Typing / Voice / Photo-attached / Loading.
 *
 * Editor is <div contenteditable> (PR #53) so iOS WebKit doesn't paint
 * its form input accessory bar.
 *
 * Photo attachment (specs/home.md §5):
 *   - Tap + → AttachmentSheet appears above (left-anchored). Two
 *     options in PR2g: Camera (capture="environment") and Photo
 *     library. The Reference Coffee option arrives in PR2h.
 *   - After file selection the photo uploads to /api/upload and shows
 *     as a 80×80 rounded thumbnail at the top-left of the pill, with a
 *     small × to remove. The editor row sits below it; the pill grows
 *     vertically to accommodate.
 *   - Send (↑) becomes active when text OR a photo is attached
 *     (§3.2). The photo is sent as attachedImageUrl to
 *     /api/explore-agent so Claude sees the image natively.
 *
 * Voice flow (§2.4) and Loading state (§2.2) unchanged from PR2f.
 */

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string, imageUrl?: string) => void;
  onComposeStart?: () => void;
}

async function uploadPhoto(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", `uploads/chat-${Date.now()}-${safeName}`);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  if (!data?.url) throw new Error("No URL returned");
  return data.url as string;
}

export default function ChatInput({ loading, onSend, onComposeStart }: ChatInputProps) {
  const [text, setText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const composeStartedRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissErrors = (delay: number) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setVoiceError(null);
      setUploadError(null);
    }, delay);
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
        try {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {
          /* selection APIs vary on iOS WebKit */
        }
      }
    },
    onError: (msg) => {
      setVoiceError(msg);
      dismissErrors(5000);
    },
  });

  const hasText = text.trim().length > 0;
  const hasPhoto = attachedImageUrl !== null;
  const sendActive = hasText || hasPhoto;
  const isRecording = voice.recording;
  const isTranscribing = voice.busy && !voice.recording;
  const isVoiceActive = isRecording || isTranscribing;
  const isCompositionActive = hasText || hasPhoto || uploadingImage;

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

  const handleFileSelected = async (file: File) => {
    markComposed();
    setUploadError(null);
    setUploadingImage(true);
    try {
      const url = await uploadPhoto(file);
      setAttachedImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      dismissErrors(5000);
    } finally {
      setUploadingImage(false);
    }
  };

  const clearComposition = () => {
    if (loading) return;
    if (editorRef.current) editorRef.current.textContent = "";
    setText("");
    setAttachedImageUrl(null);
    setUploadError(null);
    editorRef.current?.focus();
  };

  const send = () => {
    if (!sendActive || loading || uploadingImage) return;
    onSend(text.trim(), attachedImageUrl ?? undefined);
    if (editorRef.current) editorRef.current.textContent = "";
    setText("");
    setAttachedImageUrl(null);
    composeStartedRef.current = false;
    editorRef.current?.blur();
  };

  const startVoice = async () => {
    if (loading || sendActive) return;
    setVoiceError(null);
    markComposed();
    await voice.start();
  };

  const handleOpenSheet = () => {
    if (loading || isVoiceActive) return;
    setSheetOpen(true);
  };

  const handlePickCamera = () => {
    setSheetOpen(false);
    cameraInputRef.current?.click();
  };

  const handlePickLibrary = () => {
    setSheetOpen(false);
    libraryInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelected(file);
    e.target.value = "";
  };

  const removePhoto = () => {
    setAttachedImageUrl(null);
  };

  return (
    <footer className="flex flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {(voiceError || uploadError) && (
        <div
          role="alert"
          className="mb-2 rounded-2xl border border-light-foreground/10 bg-light-card-default px-3 py-2 font-inter text-[13px] text-light-foreground backdrop-blur-[14px] backdrop-saturate-150"
        >
          {voiceError ?? uploadError}
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

      {sheetOpen && (
        <AttachmentSheet
          onClose={() => setSheetOpen(false)}
          onPickCamera={handlePickCamera}
          onPickLibrary={handlePickLibrary}
        />
      )}

      {/* Hidden file inputs trigger the native iOS Camera / Photo
          Library experience via capture and accept attributes. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="flex items-end gap-3">
        {/* Left button: × during voice / composition / loading; + otherwise */}
        {isVoiceActive ? (
          <button
            type="button"
            onClick={() => voice.cancel()}
            disabled={isTranscribing}
            aria-label="Cancel recording"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150 disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : isCompositionActive || loading ? (
          <button
            type="button"
            onClick={clearComposition}
            disabled={loading || uploadingImage}
            aria-label={loading ? "Sending" : "Clear"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150 disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenSheet}
            aria-label="Attach"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          </button>
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
                onClick={() => void voice.stop()}
                aria-label="Stop recording"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)]"
              >
                <Square className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-h-11 flex-1 flex-col gap-2 rounded-3xl border border-light-foreground/10 bg-light-card-default py-1.5 pl-5 pr-1.5 backdrop-blur-[14px] backdrop-saturate-150">
            {(attachedImageUrl || uploadingImage) && (
              <div className="relative h-20 w-20">
                {attachedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachedImageUrl}
                    alt="Attached"
                    className="block h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-light-foreground/10">
                    <Loader2
                      className="h-5 w-5 animate-spin text-light-foreground/60"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
                {attachedImageUrl && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label="Remove photo"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)]"
                  >
                    <X className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-end gap-1">
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
              {sendActive ? (
                <button
                  type="button"
                  onClick={send}
                  disabled={uploadingImage}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-[hsl(30_40%_97%)] disabled:opacity-30"
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
          </div>
        )}
      </div>
    </footer>
  );
}
