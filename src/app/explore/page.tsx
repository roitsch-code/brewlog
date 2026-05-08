"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import ThinkingDots from "@/components/ui/ThinkingDots";
import WaveformBars from "@/components/ui/WaveformBars";
import type { Session } from "@/lib/types/session";
import type { CafeSummary } from "@/lib/types/cafes";
import { ArrowUp, FlaskConical, Thermometer, RotateCcw, Globe, BookOpen, MapPin, Crosshair, User, Mic, Square, Volume2, VolumeX, X, Plus, Camera, Coffee } from "lucide-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";
import { gradientChatBg, gradientPillUser } from "@/lib/theme/gradients";
import type { NavAction } from "@/app/api/explore-agent/route";

const CafeMap = dynamic(() => import("@/components/cafes/CafeMap"), { ssr: false });

const SUGGESTION_ICONS = [FlaskConical, Thermometer, RotateCcw, Globe, BookOpen, FlaskConical];

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  coffeeRef?: { id: string; roaster: string; name: string };
  sources?: { title: string; url: string }[];
  actions?: NavAction[];
}

interface InsightItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  tags: string[];
  savedAt: string;
}

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  type: "article" | "video" | "instagram" | "podcast" | "research" | "social";
  source: string;
  savedAt: string;
}

interface CompactCoffee {
  id: string;
  roaster: string;
  name: string;
}

interface CoffeeAlert {
  id: string;
  roaster: string;
  coffeeName: string;
  origin: string;
  process?: string;
  score: number;
  summary: string;
  url?: string;
  alertedAt: string;
  read: boolean;
}

// ── Fallback starter questions (shown before API responds) ─────────────────

const DEFAULT_STARTER_QUESTIONS = [
  "What's the ideal V60 pour-over ratio for light roast Ethiopian beans?",
  "How does water temperature affect extraction for different roast levels?",
  "Why does bloom time matter and how long should I bloom for fresh beans?",
  "What are the key differences between Ethiopian and Kenyan single origins?",
];

// ── Voice helpers ─────────────────────────────────────────────────────────────
// Strip citation markers like [I3] before sending text to TTS or buffering it.
function stripCitations(text: string): string {
  return text.replace(/\s*\[I\d+\]/g, "");
}

// Pull complete sentences out of a streaming buffer; mutate the buffer to leave
// any unfinished tail in place. When `force` is true, flush whatever remains.
const SENTENCE_RE = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+)/g;
function flushSentences(buffer: { current: string }, force: boolean): string[] {
  if (force) {
    const tail = buffer.current.trim();
    buffer.current = "";
    return tail ? [tail] : [];
  }
  const out: string[] = [];
  const re = new RegExp(SENTENCE_RE.source, "g");
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer.current)) !== null) {
    const sentence = m[0].trim();
    if (sentence) out.push(sentence);
    lastIndex = re.lastIndex;
  }
  if (lastIndex > 0) buffer.current = buffer.current.slice(lastIndex);
  return out;
}

// ── Main page ──────────────────────────────────────────────────────────────

type ExploreTab = "ask" | "insights" | "nearby";

const TAB_LABELS: Record<ExploreTab, string> = {
  ask: "Chat",
  insights: "Insights",
  nearby: "Nearby",
};

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ExploreTab = tabParam === "insights" || tabParam === "nearby" ? tabParam : "ask";
  const setActiveTab = (tab: ExploreTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "ask") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
  };

  return (
    <div className={`min-h-full flex flex-col ${activeTab === "ask" ? gradientChatBg : "bg-brew-bg"}`}>
      {/* Header — DOT-spec: tab switcher pills only, no app icon, no title */}
      <div className="px-5 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div
          className="flex gap-1 rounded-full p-1 border border-dot-edge backdrop-blur-xl w-fit"
          style={{ background: "var(--surface-pill-input)" }}
        >
          {(["ask", "insights", "nearby"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeTab === tab ? "var(--surface-pill-user)" : "transparent",
                color: activeTab === tab ? "var(--text-on-pill-user)" : "var(--text-secondary)",
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "ask" && <AskTab />}
        {activeTab === "insights" && <InsightsTab />}
        {activeTab === "nearby" && <NearbyTab focus={searchParams.get("focus") ?? undefined} />}
      </div>
    </div>
  );
}

// ── Ask Tab ────────────────────────────────────────────────────────────────

function AskTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [starterQuestions, setStarterQuestions] = useState<string[]>(DEFAULT_STARTER_QUESTIONS);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [coffeePickerOpen, setCoffeePickerOpen] = useState(false);
  const [coffeeQuery, setCoffeeQuery] = useState("");
  const [coffeeList, setCoffeeList] = useState<CompactCoffee[]>([]);
  const [referencedCoffee, setReferencedCoffee] = useState<CompactCoffee | null>(null);
  // Once the user types, taps mic, or otherwise acts, hide the starter
  // suggestions for the rest of the session — they shouldn't reappear if
  // the input is cleared back to empty.
  const [hasInteracted, setHasInteracted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentenceBufferRef = useRef<{ current: string }>({ current: "" });
  const voiceModeRef = useRef(false);

  const playback = useVoicePlayback();
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const handleTranscript = useCallback((text: string) => {
    setVoiceError(null);
    sendMessageRef.current(text);
  }, []);
  const handleVoiceError = useCallback((msg: string) => setVoiceError(msg), []);

  const capture = useVoiceCapture({
    onTranscript: handleTranscript,
    onError: handleVoiceError,
  });

  // Hydrate voice-mode preference once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("brewlog.voiceMode") === "1") setVoiceMode(true);
    } catch { /* ignore */ }
  }, []);

  // Mirror voiceMode to a ref (so the SSE consumer reads the live value), and
  // persist + cancel any in-flight playback when it flips off.
  useEffect(() => {
    voiceModeRef.current = voiceMode;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("brewlog.voiceMode", voiceMode ? "1" : "0"); } catch { /* ignore */ }
    }
    if (!voiceMode) {
      playback.cancel();
      sentenceBufferRef.current.current = "";
    }
  }, [voiceMode, playback]);

  useEffect(() => {
    fetch("/api/questions")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.items) && data.items.length > 0) {
          setStarterQuestions(data.items);
        }
      })
      .catch(() => {/* keep defaults */});

    // Load recent sessions so explore can reference the user's actual brew history
    fetch("/api/sessions?limit=5", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Session[]) => { if (Array.isArray(data)) setRecentSessions(data); })
      .catch(() => {});

    // Load the compact coffee list for the reference-coffee picker.
    fetch("/api/coffees", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; roaster: string; name: string }[]) => {
        if (Array.isArray(data)) {
          setCoffeeList(
            data
              .filter(c => c?.id && c?.name && c?.roaster)
              .map(c => ({ id: c.id, roaster: c.roaster, name: c.name }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-grow the textarea so the input pill expands with content (DOT
  // Chat_Type_Long pattern). We reset to "auto" first so shrinking on
  // delete works, then snap to scrollHeight up to the cap.
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const cap = 140;
    ta.style.height = Math.min(ta.scrollHeight, cap) + "px";
  }, [input]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    // Allow image-only sends (no text) when an image is attached.
    if (!trimmed && !attachedImageUrl && !referencedCoffee) return;
    if (loading) return;

    // The user-facing message keeps just the typed text + a coffee ref
    // chip / image thumbnail. The agent gets a richer payload built below.
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      ...(attachedImageUrl ? { imageUrl: attachedImageUrl } : {}),
      ...(referencedCoffee ? { coffeeRef: referencedCoffee } : {}),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const sentImageUrl = attachedImageUrl;
    const sentCoffeeRef = referencedCoffee;
    setAttachedImageUrl(null);
    setReferencedCoffee(null);
    setLoading(true);
    setAgentStatus(null);

    const endpoint = "/api/explore-agent";

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "You're offline. Reconnect and try again." },
      ]);
      setLoading(false);
      setAgentStatus(null);
      return;
    }

    let receivedAnyDelta = false;
    let errorMessage = "Sorry, I couldn't get a response right now. Please try again.";

    try {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m, idx) => {
              // Inject the coffee ref into the most recent user turn so the
              // agent sees the bag explicitly — keeps display clean.
              if (idx === newMessages.length - 1 && sentCoffeeRef) {
                const tag = `[Coffee: ${sentCoffeeRef.roaster} ${sentCoffeeRef.name}]`;
                return {
                  role: m.role,
                  content: m.content ? `${tag}\n${m.content}` : tag,
                };
              }
              return { role: m.role, content: m.content };
            }),
            recentSessions,
            ...(sentImageUrl ? { attachedImageUrl: sentImageUrl } : {}),
          }),
        });
      } catch {
        errorMessage = "Couldn't reach BrewLog. Check your connection.";
        throw new Error("network");
      }

      if (!res.ok) {
        errorMessage = `BrewLog is having trouble (server ${res.status}). Try again in a moment.`;
        throw new Error("server");
      }
      if (!res.body) {
        errorMessage = "No response from BrewLog. Try again.";
        throw new Error("nobody");
      }

      // Seed an empty assistant bubble we progressively fill
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let streamError: string | null = null;

      const applyEvent = (event: string, data: string) => {
        let payload: {
          text?: string;
          message?: string;
          sources?: { title: string; url: string }[];
          actions?: NavAction[];
          error?: string;
        };
        try {
          payload = JSON.parse(data);
        } catch {
          return; // Malformed event — skip
        }
        try {
          if (event === "retract") {
            // Claude started responding then decided to call a tool — clear the bubble
            setMessages(prev => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: "" };
              return copy;
            });
            playbackRef.current.cancel();
            sentenceBufferRef.current.current = "";
          } else if (event === "status" && payload.message) {
            setAgentStatus(payload.message);
          } else if (event === "delta" && payload.text) {
            receivedAnyDelta = true;
            setAgentStatus(null);
            setMessages(prev => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + payload.text };
              }
              return copy;
            });
            if (voiceModeRef.current) {
              const cleaned = stripCitations(payload.text);
              if (cleaned) {
                sentenceBufferRef.current.current += cleaned;
                for (const s of flushSentences(sentenceBufferRef.current, false)) {
                  playbackRef.current.enqueue(s);
                }
              }
            }
          } else if (event === "done") {
            setAgentStatus(null);
            if (voiceModeRef.current) {
              for (const s of flushSentences(sentenceBufferRef.current, true)) {
                playbackRef.current.enqueue(s);
              }
            }
            if (payload.sources || payload.actions) {
              setMessages(prev => {
                const copy = prev.slice();
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    ...(payload.sources ? { sources: payload.sources } : {}),
                    ...(payload.actions ? { actions: payload.actions } : {}),
                  };
                }
                return copy;
              });
            }
          } else if (event === "error") {
            streamError = payload.error ?? "Stream error";
            playbackRef.current.cancel();
            sentenceBufferRef.current.current = "";
          }
        } catch {
          // Defensive — never let render side-effects break the read loop
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });

        let boundary = carry.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = carry.slice(0, boundary);
          carry = carry.slice(boundary + 2);
          let eventName = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (dataLine) applyEvent(eventName, dataLine);
          boundary = carry.indexOf("\n\n");
        }

        if (streamError) {
          errorMessage = "The AI hit an error mid-response. Try again.";
          throw new Error(streamError);
        }
      }
    } catch {
      playbackRef.current.cancel();
      sentenceBufferRef.current.current = "";
      const dropped = receivedAnyDelta;
      setMessages(prev => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (dropped && last?.role === "assistant" && last.content) {
          copy[copy.length - 1] = {
            ...last,
            content: `${last.content}\n\n_(Connection dropped — try resending if the answer looks incomplete.)_`,
          };
          return copy;
        }
        if (last?.role === "assistant" && last.content === "") {
          copy[copy.length - 1] = { role: "assistant", content: errorMessage };
          return copy;
        }
        return [...prev, { role: "assistant", content: errorMessage }];
      });
    } finally {
      setLoading(false);
      setAgentStatus(null);
    }
  };

  // Keep the ref pointing at the latest sendMessage so the voice-capture hook's
  // stable onTranscript callback always invokes the current closure.
  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Tap mic — also primes audio playback inside the user gesture so iOS will
  // permit subsequent <audio> playback in this session.
  const handleMicTap = () => {
    setVoiceError(null);
    setHasInteracted(true);
    if (voiceMode) playback.unlock();
    void capture.toggle();
  };

  const handleVoiceToggle = () => {
    const next = !voiceMode;
    if (next) playback.unlock();
    setVoiceMode(next);
  };

  const handleAttachClick = () => {
    setAttachError(null);
    setAttachSheetOpen(true);
  };

  const handlePhotoPick = () => {
    setAttachSheetOpen(false);
    fileInputRef.current?.click();
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAttachError("Photo too large (max 10 MB).");
      return;
    }
    setUploadingImage(true);
    setAttachError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", `uploads/chat-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const { url } = await res.json();
      if (!url) throw new Error("No URL returned");
      setAttachedImageUrl(url);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearAttachment = () => {
    setAttachedImageUrl(null);
    setAttachError(null);
  };

  const showStarter =
    !hasInteracted &&
    messages.length === 0 &&
    !loading &&
    input.trim() === "" &&
    !capture.recording;

  return (
    <>
      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
        style={{ paddingBottom: "1rem" }}
      >
        {showStarter ? (
          <div className="mt-1">
            <p className="label-mono mb-2" style={{ color: "var(--muted-foreground)" }}>Suggested</p>
            <div className="flex flex-col gap-1.5">
              {starterQuestions.slice(0, 3).map((q, i) => {
                const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="flex items-center gap-3 text-left rounded-xl px-3.5 py-2.5 active:scale-[0.98] transition-all w-full"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <Icon size={14} style={{ color: "var(--primary)" }} className="shrink-0" />
                    <span className="text-sm leading-snug" style={{ color: "var(--foreground)" }}>{q}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  // Cream pill — asymmetric radius, dark text on warm cream.
                  <div
                    className={`max-w-[78%] flex flex-col gap-2 ${gradientPillUser}`}
                    style={{
                      borderTopLeftRadius: "var(--radius-xl)",
                      borderTopRightRadius: "var(--radius-xl)",
                      borderBottomLeftRadius: "var(--radius-xl)",
                      borderBottomRightRadius: "var(--radius-lg)",
                      padding: "12px 16px",
                      color: "var(--text-on-pill-user)",
                    }}
                  >
                    {msg.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={msg.imageUrl}
                        alt="Attached"
                        className="rounded-xl max-h-64 w-full object-cover"
                      />
                    )}
                    {msg.coffeeRef && (
                      <div
                        className="flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs"
                        style={{ background: "rgba(26,19,14,0.06)", color: "var(--text-on-pill-user)" }}
                      >
                        <Coffee size={12} />
                        <span style={{ opacity: 0.7 }}>{msg.coffeeRef.roaster}</span>
                        <span>{msg.coffeeRef.name}</span>
                      </div>
                    )}
                    {msg.content && (
                      <div className="text-sm leading-relaxed">
                        <MessageContent content={msg.content} darkText />
                      </div>
                    )}
                  </div>
                ) : (
                  // Assistant — no bubble, text directly on the gradient.
                  <div className="flex flex-col gap-2" style={{ maxWidth: "88%" }}>
                    <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                      <MessageContent content={msg.content} />
                    </div>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.actions.map((action, j) => (
                          <NavActionChip key={j} action={action} />
                        ))}
                      </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((s, j) => (
                          <a
                            key={j}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline underline-offset-2"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (() => {
              // Only show the indicator while we're still waiting for the
              // first delta — once tokens stream in, the assistant message
              // itself is the visual feedback.
              const last = messages[messages.length - 1];
              const stillEmpty = !last || last.role !== "assistant" || !last.content;
              if (!stillEmpty) return null;
              return (
                <div className="flex justify-start">
                  <div className="flex flex-col gap-1">
                    <ThinkingDots />
                    {agentStatus && (
                      <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
                        {agentStatus}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Input area — DOT-spec glass dock (spec §6.1). ScrollContainer
          doesn't reserve padding on /explore, so we own safe-area here. */}
      <div className="shrink-0 px-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))", paddingTop: "0.25rem" }}>
        {/* Hidden file input for photo attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoFile}
        />

        {voiceError && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(220, 80, 80, 0.12)", border: "1px solid rgba(220, 80, 80, 0.35)" }}
          >
            <p className="flex-1 text-xs leading-snug" style={{ color: "rgba(255,200,200,0.85)" }}>
              {voiceError}
            </p>
            <button type="button" onClick={() => setVoiceError(null)} className="shrink-0 active:scale-90" aria-label="Dismiss">
              <X size={14} style={{ color: "rgba(255,200,200,0.7)" }} />
            </button>
          </div>
        )}
        {attachError && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(220, 80, 80, 0.12)", border: "1px solid rgba(220, 80, 80, 0.35)" }}
          >
            <p className="flex-1 text-xs leading-snug" style={{ color: "rgba(255,200,200,0.85)" }}>{attachError}</p>
            <button type="button" onClick={() => setAttachError(null)} className="shrink-0 active:scale-90" aria-label="Dismiss">
              <X size={14} style={{ color: "rgba(255,200,200,0.7)" }} />
            </button>
          </div>
        )}

        {/* Pending coffee reference chip above the input pill */}
        {referencedCoffee && (
          <div className="mb-2 flex">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full border border-dot-edge backdrop-blur-md"
              style={{ background: "var(--surface-pill-attach)" }}
            >
              <Coffee size={14} style={{ color: "var(--text-accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{referencedCoffee.roaster}</span>{" "}
                <span>{referencedCoffee.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReferencedCoffee(null)}
                aria-label="Remove coffee reference"
                className="active:scale-90"
              >
                <X size={12} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          </div>
        )}

        {/* Pending image thumbnail above the input pill */}
        {(attachedImageUrl || uploadingImage) && (
          <div className="mb-2 flex">
            <div
              className="relative rounded-2xl overflow-hidden border border-dot-edge"
              style={{ width: 88, height: 88, background: "var(--surface-pill-attach)", backdropFilter: "blur(12px)" }}
            >
              {uploadingImage ? (
                <div className="w-full h-full flex items-center justify-center">
                  <ThinkingDots />
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachedImageUrl ?? ""} alt="Attached" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={handleClearAttachment}
                    aria-label="Remove attachment"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <X size={12} className="text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Recording dock — replaces the input pill while capture is active.
            Spec §6.3: full-width waveform across most of the dock, stop
            button on the right (filled square in a circle). No timer. */}
        {capture.recording ? (
          <div
            className="flex items-center gap-2 rounded-full border border-dot-edge backdrop-blur-xl shadow-glow-strong px-3"
            style={{ background: "var(--surface-pill-input)", minHeight: 52 }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ background: "var(--text-accent)" }}
              aria-label="Recording"
            />
            <WaveformBars
              getLevel={capture.getLevel}
              bars={32}
              height={32}
              className="flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={() => void capture.stop()}
              disabled={capture.busy}
              aria-label="Stop recording"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "var(--text-accent)", color: "var(--bg-base)" }}
            >
              <Square size={14} fill="currentColor" />
            </button>
          </div>
        ) : (
        <div
          className="flex items-center gap-1 rounded-full border border-dot-edge backdrop-blur-xl shadow-glow-subtle"
          style={{
            background: "var(--surface-pill-input)",
            paddingLeft: 6,
            paddingRight: 6,
            minHeight: 52,
          }}
        >
          {/* + attach */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={loading || capture.recording}
            aria-label="Add attachment"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus size={22} strokeWidth={1.75} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); if (e.target.value.length > 0) setHasInteracted(true); }}
            onKeyDown={handleKeyDown}
            placeholder={capture.recording ? "Listening…" : "Ask something"}
            rows={1}
            disabled={capture.recording || capture.busy}
            className="flex-1 bg-transparent resize-none focus:outline-none disabled:opacity-60 placeholder:text-dot-ink-soft"
            style={{
              color: "var(--text-primary)",
              minHeight: 40,
              maxHeight: 120,
              padding: "10px 4px",
              fontSize: 16,
            }}
          />

          {/* Mic OR Send swap (spec §6.1) */}
          {input.trim().length > 0 || attachedImageUrl ? (
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || uploadingImage}
              aria-label="Send"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "var(--text-accent)", color: "var(--bg-base)" }}
            >
              <ArrowUp size={18} strokeWidth={2.25} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMicTap}
              disabled={loading || capture.busy}
              aria-label={capture.recording ? "Stop recording" : "Start recording"}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 ${capture.recording ? "animate-pulse" : ""}`}
              style={{
                background: capture.recording ? "rgba(220, 80, 80, 0.18)" : "transparent",
              }}
            >
              {capture.recording ? (
                <Square size={14} style={{ color: "rgba(255,180,180,0.95)" }} fill="currentColor" />
              ) : (
                <Mic size={18} style={{ color: "var(--text-secondary)" }} strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>
        )}
      </div>

      {/* Coffee picker — search sheet, spec §6.4 */}
      {coffeePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: "var(--scrim-dialog)", backdropFilter: "blur(4px)" }}
          onClick={() => setCoffeePickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-x border-dot-edge p-4 pb-6 flex flex-col gap-2"
            style={{ background: "var(--surface-2)", maxHeight: "70vh" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "var(--text-muted)" }} />
            <div className="flex items-center gap-2 px-1 mt-1">
              <Coffee size={16} style={{ color: "var(--text-accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>Reference a coffee</p>
            </div>
            <input
              autoFocus
              type="text"
              value={coffeeQuery}
              onChange={e => setCoffeeQuery(e.target.value)}
              placeholder="Search roaster or coffee"
              className="w-full bg-transparent border border-dot-edge rounded-full px-4 py-2.5 text-sm focus:outline-none placeholder:text-dot-ink-soft"
              style={{ color: "var(--text-primary)" }}
            />
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {(() => {
                const q = coffeeQuery.trim().toLowerCase();
                const filtered = q
                  ? coffeeList.filter(
                      c =>
                        c.name.toLowerCase().includes(q) ||
                        c.roaster.toLowerCase().includes(q)
                    )
                  : coffeeList;
                if (filtered.length === 0) {
                  return (
                    <p className="text-xs py-6 text-center" style={{ color: "var(--text-secondary)" }}>
                      No matching coffees
                    </p>
                  );
                }
                return (
                  <ul className="flex flex-col gap-0.5">
                    {filtered.slice(0, 50).map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setReferencedCoffee(c);
                            setCoffeePickerOpen(false);
                          }}
                          className="w-full flex flex-col text-left px-3 py-2.5 rounded-xl active:bg-dot-edge transition-colors"
                        >
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.roaster}</span>
                          <span className="text-sm" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Attach sheet — bottom modal, spec §6.4 */}
      {attachSheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: "var(--scrim-dialog)", backdropFilter: "blur(4px)" }}
          onClick={() => setAttachSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-x border-dot-edge p-4 pb-6 flex flex-col gap-1"
            style={{ background: "var(--surface-2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: "var(--text-muted)" }} />

            <button
              type="button"
              onClick={handlePhotoPick}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-dot-edge transition-colors text-left"
            >
              <Camera size={20} style={{ color: "var(--text-accent)" }} />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Photo</span>
            </button>

            <button
              type="button"
              onClick={() => { setAttachSheetOpen(false); setCoffeeQuery(""); setCoffeePickerOpen(true); }}
              disabled={coffeeList.length === 0}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-dot-edge transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Coffee size={20} style={{ color: "var(--text-accent)" }} />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Reference coffee</span>
              {coffeeList.length === 0 && (
                <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>library empty</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { handleVoiceToggle(); setAttachSheetOpen(false); }}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl active:bg-dot-edge transition-colors text-left"
            >
              {voiceMode ? (
                <Volume2 size={20} style={{ color: "var(--text-accent)" }} />
              ) : (
                <VolumeX size={20} style={{ color: "var(--text-secondary)" }} />
              )}
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                Voice replies {voiceMode ? "on" : "off"}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Renders markdown: **bold**, *italic*, bullet lists, line breaks
function renderInline(text: string, darkText?: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;
  let key = 0;
  const boldClass = darkText ? "font-semibold" : "text-white font-semibold";
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith("**")) {
      parts.push(<strong key={key++} className={boldClass}>{match[2]}</strong>);
    } else {
      parts.push(<em key={key++} className="italic">{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageContent({ content, darkText }: { content: string; darkText?: boolean }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines (add spacing via gap instead)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Bullet list item
    if (/^[-•]\s/.test(line.trim())) {
      const bullets: React.ReactNode[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) {
        bullets.push(
          <li key={i} className="leading-snug">
            {renderInline(lines[i].trim().replace(/^[-•]\s/, ""), darkText)}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-outside pl-4 flex flex-col gap-1 my-1">
          {bullets}
        </ul>
      );
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <p key={i} className="leading-relaxed">
        {renderInline(line, darkText)}
      </p>
    );
    i++;
  }

  return <div className="flex flex-col gap-2 text-sm">{nodes}</div>;
}

// ── Nav action chips ───────────────────────────────────────────────────────

function navActionToPath(action: NavAction): string {
  switch (action.destination) {
    case "coffee_library": return "/coffees";
    case "coffee_detail":  return action.id ? `/coffees/${action.id}` : "/coffees";
    case "cafe_map":       return "/explore?tab=nearby";
    case "cafe_detail":    return action.id
      ? `/explore?tab=nearby&focus=${encodeURIComponent(action.id)}`
      : "/explore?tab=nearby";
    case "taste_profile":  return "/taste";
    case "match":          return "/match";
    default:               return "/";
  }
}

function NavActionIcon({ destination }: { destination: NavAction["destination"] }) {
  const props = { size: 12, style: { color: "var(--primary)" } };
  switch (destination) {
    case "coffee_library":
    case "coffee_detail":  return <BookOpen {...props} />;
    case "cafe_map":
    case "cafe_detail":    return <MapPin {...props} />;
    case "taste_profile":  return <User {...props} />;
    case "match":          return <Crosshair {...props} />;
    default:               return <Globe {...props} />;
  }
}

function NavActionChip({ action }: { action: NavAction }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(navActionToPath(action))}
      title={action.reason}
      className="flex items-center gap-1.5 active:scale-95 transition-all"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "999px",
        padding: "5px 12px",
        color: "var(--muted-foreground)",
        fontSize: "11px",
        lineHeight: 1.4,
      }}
    >
      <NavActionIcon destination={action.destination} />
      {action.label}
    </button>
  );
}

// ── Insights Tab ───────────────────────────────────────────────────────────

function InsightsTab() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [alerts, setAlerts] = useState<CoffeeAlert[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/insights", { signal: controller.signal }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch("/api/alerts",   { signal: controller.signal }).then(r => r.ok ? r.json() : { alerts: [] }).catch(() => ({ alerts: [] })),
      fetch("/api/news",     { signal: controller.signal }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ]).then(([insightData, alertData, newsData]) => {
      setInsights(Array.isArray(insightData?.items) ? insightData.items.slice(0, 10) : []);
      setAlerts(Array.isArray(alertData?.alerts) ? alertData.alerts : []);
      setNews(Array.isArray(newsData?.items) ? newsData.items : []);
    }).finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const unreadAlerts = alerts.filter(a => !a.read);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><CoffeeBeanGlow size={48} /></div>;
  }

  const hasContent = news.length > 0 || unreadAlerts.length > 0 || insights.length > 0;

  return (
    <div
      className="flex-1 overflow-y-auto flex flex-col gap-0"
      // ScrollContainer reserves no bottom padding on /explore, so the
      // Insights tab clears the floating BottomNav itself.
      style={{ paddingBottom: "calc(78px + env(safe-area-inset-bottom) + 1rem)" }}
    >
      {/* ── News Ticker ─────────────────────────────────────── */}
      {news.length > 0 && (
        <div className="pt-4 pb-2">
          <p className="label-mono text-brew-muted mb-3 px-5">
            Coffee feed
          </p>
          {/* Horizontal scroll — no scrollbar */}
          <div
            className="flex gap-3 overflow-x-auto"
            style={{ paddingLeft: "1.25rem", paddingRight: "1.25rem", scrollbarWidth: "none" }}
          >
            {news.map(item => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── Coffee Alerts ────────────────────────────────────── */}
      {unreadAlerts.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <p className="label-mono text-brew-muted mb-3">
            New coffees spotted
          </p>
          <div className="flex flex-col gap-3">
            {unreadAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ── Research Insights ────────────────────────────────── */}
      <div className="px-5 pt-4">
        {(news.length > 0 || unreadAlerts.length > 0) && (
          <p className="label-mono text-brew-muted mb-3">
            Research insights
          </p>
        )}
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <CoffeeBeanGlow size={48} />
            <div>
              <p className="text-white/60 text-sm">No content yet</p>
              <p className="text-white/30 text-xs mt-1">Research updates every 2 days</p>
            </div>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">No research insights yet — check back soon</p>
        ) : (
          <div className="flex flex-col gap-3">
            {insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nearby Tab ─────────────────────────────────────────────────────────────

function NearbyTab({ focus }: { focus?: string }) {
  const router = useRouter();
  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then(r => r.json())
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><CoffeeBeanGlow size={48} /></div>;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top) + 140px)",
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <CafeMap
        cafes={cafes}
        onSelect={cafe => router.push(`/cafes/place/${encodeURIComponent(cafe.name)}`)}
        initialSearch={focus}
      />
    </div>
  );
}

// ── News type helpers ────────────────────────────────────────────────────────

function newsTypeIcon(type: NewsItem["type"]): string {
  switch (type) {
    case "video":     return "▶";
    case "instagram": return "◈";
    case "podcast":   return "◉";
    case "research":  return "◆";
    case "social":    return "◇";
    default:          return "◎"; // article
  }
}

function newsTypeLabel(type: NewsItem["type"]): string {
  switch (type) {
    case "video":     return "Video";
    case "instagram": return "Instagram";
    case "podcast":   return "Podcast";
    case "research":  return "Research";
    case "social":    return "Social";
    default:          return "Article";
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  const date = new Date(item.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 w-52 bg-brew-surface border border-brew-border rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform"
    >
      {/* Type badge + date */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">{newsTypeIcon(item.type)}</span>
          <span className="text-brew-muted text-xs uppercase tracking-widest">{newsTypeLabel(item.type)}</span>
        </span>
        <span className="text-white/20 text-xs">{date}</span>
      </div>

      {/* Title — 2 lines max */}
      <p className="text-white text-sm font-medium leading-snug line-clamp-2">{item.title}</p>

      {/* Source + link arrow */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-white/40 text-xs truncate max-w-[80%]">{item.source}</span>
        <span className="text-white/30 text-xs">→</span>
      </div>
    </a>
  );
}

function InsightCard({ insight }: { insight: InsightItem }) {
  const date = new Date(insight.savedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white font-medium text-sm leading-snug flex-1">
          {insight.title}
        </p>
        <span className="text-white/30 text-xs shrink-0">{date}</span>
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{insight.summary}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white/40 text-xs bg-brew-elevated rounded-full px-2.5 py-0.5">
          {insight.source}
        </span>
        {insight.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-white/30 text-xs">
            #{tag}
          </span>
        ))}
        {insight.url && (
          <a
            href={insight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 text-xs underline underline-offset-2 ml-auto"
          >
            Read more
          </a>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: CoffeeAlert }) {
  return (
    <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-white font-medium text-sm leading-snug">
            {alert.roaster} — {alert.coffeeName}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {alert.origin}
            {alert.process ? ` · ${alert.process}` : ""}
          </p>
        </div>
        <ScoreBadge score={alert.score} />
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{alert.summary}</p>
      {alert.url && (
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/50 underline underline-offset-2 self-start"
        >
          View
        </a>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const label =
    score >= 85 ? "Great" : score >= 65 ? "Good" : score >= 45 ? "Maybe" : "Pass";
  return (
    <div className="shrink-0 flex flex-col items-center gap-0.5">
      <span className="font-mono-num text-white text-sm font-medium">{score}</span>
      <span className="text-white/30 text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
