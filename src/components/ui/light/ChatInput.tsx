"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, AudioLines, ArrowUp, Square, Loader2, Coffee as CoffeeIcon } from "lucide-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import WaveformBars from "@/components/ui/WaveformBars";
import AttachmentSheet from "@/components/ui/light/AttachmentSheet";
import ReferenceCoffeePicker, { type CompactCoffee } from "@/components/ui/light/ReferenceCoffeePicker";

/**
 * BTTS Chat Input — Idle / Typing / Voice / Photo / Coffee / Loading.
 *
 * Editor is <div contenteditable> so the iOS Safari/WebKit form input
 * accessory bar doesn't attach. On Firefox iOS the bar is a known
 * platform limitation; suppressed when installed as a Safari PWA.
 *
 * Attachments (specs/home.md §5):
 *   - + → AttachmentSheet (Photo + Reference coffee). Camera/Library
 *     split was collapsed into a single "Photo" entry because iOS
 *     WebKit always shows its own action sheet for non-capture file
 *     inputs (post-PR2g revision).
 *   - Photo → iOS picker → /api/upload → 80x80 thumbnail at top-left
 *     of pill, × to remove.
 *   - Reference coffee → ReferenceCoffeePicker bottom sheet → tap row
 *     → 28px coffee chip at top-left of pill, × to remove.
 *   - Max one attachment per message (§3.3). Selecting a new one
 *     replaces the previous silently.
 *
 * Voice flow (§2.4) unchanged from PR2f.
 */

export interface SendPayload {
  text: string;
  imageUrl?: string;
  coffeeRef?: CompactCoffee;
}

interface ChatInputProps {
  loading: boolean;
  onSend: (payload: SendPayload) => void;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [attachedCoffee, setAttachedCoffee] = useState<CompactCoffee | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [coffeeList, setCoffeeList] = useState<CompactCoffee[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const composeStartedRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compact coffee list for the picker — fetched once on mount.
  // Sorted by firstSeenAt DESC so the most-recently-scanned bag is at
  // the top (matches the /coffees library page's default sort, and
  // matches user expectation: "what did I just add" is what you
  // usually want to reference).
  useEffect(() => {
    fetch("/api/coffees", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; roaster: string; name: string; firstSeenAt?: string }[]) => {
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) =>
            (b.firstSeenAt || "").localeCompare(a.firstSeenAt || "")
          );
          setCoffeeList(
            sorted
              .filter((c) => c?.id && c?.name && c?.roaster)
              .map((c) => ({ id: c.id, roaster: c.roaster, name: c.name }))
          );
        }
      })
      .catch(() => {});
  }, []);

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
          /* selection APIs vary across iOS WebKit */
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
  const hasCoffee = attachedCoffee !== null;
  const sendActive = hasText || hasPhoto || hasCoffee;
  const isRecording = voice.recording;
  const isTranscribing = voice.busy && !voice.recording;
  const isVoiceActive = isRecording || isTranscribing;
  const isCompositionActive = hasText || hasPhoto || hasCoffee || uploadingImage;

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
    setAttachedCoffee(null); // §3.3 — one attachment at a time
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
    setAttachedCoffee(null);
    setUploadError(null);
    editorRef.current?.focus();
  };

  const send = () => {
    if (!sendActive || loading || uploadingImage) return;
    onSend({
      text: text.trim(),
      ...(attachedImageUrl ? { imageUrl: attachedImageUrl } : {}),
      ...(attachedCoffee ? { coffeeRef: attachedCoffee } : {}),
    });
    if (editorRef.current) editorRef.current.textContent = "";
    setText("");
    setAttachedImageUrl(null);
    setAttachedCoffee(null);
    composeStartedRef.current = false;
    editorRef.current?.blur();
  };

  const startVoice = async () => {
    if (loading || sendActive) return;
    setVoiceError(null);
    markComposed();
    await voice.start();
  };

  const openSheet = () => {
    if (loading || isVoiceActive) return;
    setSheetOpen(true);
  };

  const handlePickPhoto = () => {
    setSheetOpen(false);
    photoInputRef.current?.click();
  };

  const handlePickCoffeeRef = () => {
    setSheetOpen(false);
    setPickerOpen(true);
  };

  const handleCoffeeSelected = (coffee: CompactCoffee) => {
    markComposed();
    setAttachedImageUrl(null); // §3.3 — one attachment at a time
    setAttachedCoffee(coffee);
    setPickerOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelected(file);
    e.target.value = "";
  };

  return (
    <>
      <footer className="flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        {(voiceError || uploadError) && (
          <div
            role="alert"
            className="mb-2 rounded-2xl border border-light-foreground/25 bg-light-card-default px-3 py-2 font-chivo text-[13px] text-light-foreground backdrop-blur-light-card backdrop-saturate-150"
          >
            {voiceError ?? uploadError}
          </div>
        )}

        {sheetOpen && (
          <AttachmentSheet
            onClose={() => setSheetOpen(false)}
            onPickPhoto={handlePickPhoto}
            onPickCoffee={handlePickCoffeeRef}
            coffeeLibraryEmpty={coffeeList.length === 0}
          />
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex items-center gap-3">
          {isVoiceActive ? (
            <button
              type="button"
              onClick={() => voice.cancel()}
              disabled={isTranscribing}
              aria-label="Cancel recording"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/70 backdrop-blur-light-card backdrop-saturate-150 disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : isCompositionActive || loading ? (
            <button
              type="button"
              onClick={clearComposition}
              disabled={loading || uploadingImage}
              aria-label={loading ? "Sending" : "Clear"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/70 backdrop-blur-light-card backdrop-saturate-150 disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={openSheet}
              aria-label="Attach"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/70 backdrop-blur-light-card backdrop-saturate-150"
            >
              <Plus className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}

          {loading ? (
            <div className="h-11 flex-1 rounded-full border border-light-foreground/25 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150" />
          ) : isVoiceActive ? (
            <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-light-foreground/25 bg-light-card-default pl-5 pr-1.5 backdrop-blur-light-card backdrop-saturate-150">
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark"
                >
                  <Square className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-11 flex-1 flex-col gap-2 rounded-3xl border border-light-foreground/25 bg-light-card-default py-1.5 pl-5 pr-1.5 backdrop-blur-light-card backdrop-saturate-150">
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
                      onClick={() => setAttachedImageUrl(null)}
                      aria-label="Remove photo"
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark"
                    >
                      <X className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              )}
              {attachedCoffee && (
                <div className="flex max-w-full items-start gap-2 rounded-xl border border-light-foreground/25 bg-light-card-default px-2.5 py-1.5">
                  <CoffeeIcon
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-light-foreground/80"
                    strokeWidth={1.5}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-1 break-words font-chivo text-[11px] font-normal text-light-muted-foreground">
                      {attachedCoffee.roaster}
                    </span>
                    <span className="line-clamp-2 break-words font-chivo text-[13px] font-medium text-light-foreground">
                      {attachedCoffee.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedCoffee(null)}
                    aria-label="Remove coffee reference"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark"
                  >
                    <X className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1">
                <div className="relative min-h-8 min-w-0 flex-1">
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
                    // overflow-wrap: anywhere → unbreakable strings (long
                    // URLs, no-space tokens) wrap inside the pill instead
                    // of pushing the editor wider than its container.
                    style={{ overflowWrap: "anywhere" }}
                    className="block min-h-8 w-full whitespace-pre-wrap break-words font-chivo text-[16px] font-normal leading-[2rem] text-light-foreground focus:outline-none"
                  />
                  {!hasText && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-0 font-chivo text-[16px] font-normal leading-[2rem] text-light-muted-foreground"
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark disabled:opacity-30"
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

      {pickerOpen && (
        <ReferenceCoffeePicker
          coffees={coffeeList}
          onSelect={handleCoffeeSelected}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
