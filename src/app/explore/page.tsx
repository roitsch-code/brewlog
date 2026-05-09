"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import ThinkingDots from "@/components/ui/ThinkingDots";
import WaveformBars from "@/components/ui/WaveformBars";
import type { Session } from "@/lib/types/session";
import type { CafeSummary } from "@/lib/types/cafes";
import { ArrowUp, FlaskConical, Thermometer, RotateCcw, Globe, BookOpen, MapPin, Crosshair, User, AudioLines, Square, Volume2, VolumeX, X, Plus, Camera, Coffee, ChevronRight } from "lucide-react";
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

  const isAsk = activeTab === "ask";
  const tabPillBg = isAsk ? "var(--surface-chat-pill)" : "var(--surface-pill-input)";
  const tabPillBorder = isAsk ? "var(--border-chat-subtle)" : "var(--border-subtle)";
  const tabActiveBg = isAsk ? "var(--surface-chat-card)" : "var(--surface-pill-user)";
  const tabActiveText = isAsk ? "var(--text-chat-primary)" : "var(--text-on-pill-user)";
  const tabInactiveText = isAsk ? "var(--text-chat-secondary)" : "var(--text-secondary)";

  return (
    <div className={`min-h-full flex flex-col ${isAsk ? gradientChatBg : "bg-brew-bg"}`}>
      {/* Header — DOT-spec: tab switcher pills only, no app icon, no title */}
      <div className="px-5 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div
          className="flex gap-1 rounded-full p-1 backdrop-blur-xl w-fit"
          style={{
            background: tabPillBg,
            border: `1px solid ${tabPillBorder}`,
          }}
        >
          {(["ask", "insights", "nearby"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeTab === tab ? tabActiveBg : "transparent",
                color: activeTab === tab ? tabActiveText : tabInactiveText,
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
  // Index of the assistant message whose Sources sheet is open (null = closed).
  const [sourcesOpenForMsg, setSourcesOpenForMsg] = useState<number | null>(null);
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
          // Chronicles-style suggestion cards: soft white rounded rectangles
          // with a small uppercase label on top and dark body text below.
          // Reference: docs/redesign/dot-refs/Chronicles_*.png + Chronicles2_*.png.
          <div className="mt-1 flex flex-col gap-3">
            {starterQuestions.slice(0, 3).map((q, i) => {
              const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-left active:scale-[0.99] transition-all w-full"
                  style={{
                    background: "var(--surface-chat-card-soft)",
                    borderRadius: 22,
                    boxShadow: "var(--shadow-chat-card)",
                    padding: "16px 18px",
                  }}
                >
                  <div
                    className="flex items-center gap-2 mb-1.5"
                    style={{ color: "var(--text-chat-muted)" }}
                  >
                    <Icon size={12} strokeWidth={1.75} />
                    <span
                      className="text-[11px] uppercase tracking-[0.08em]"
                      style={{ fontWeight: 500 }}
                    >
                      Suggested
                    </span>
                  </div>
                  <p
                    className="text-[15px] leading-snug"
                    style={{ color: "var(--text-chat-primary)" }}
                  >
                    {q}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  // White speech-bubble pill — DOT pattern (Chat_Text_*.png).
                  // Asymmetric corner on the bottom-right to read as a "tail"
                  // pointing toward the user; soft warm shadow lifts it off
                  // the gradient. Dark warm-brown text inside.
                  <div
                    className={`max-w-[78%] flex flex-col gap-2 ${gradientPillUser}`}
                    style={{
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                      borderBottomLeftRadius: 22,
                      borderBottomRightRadius: 8,
                      padding: "12px 16px",
                      color: "var(--text-on-pill-user)",
                      boxShadow: "var(--shadow-chat-card)",
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
                  // Assistant — no bubble, dark text directly on the warm-light
                  // gradient. Matches DOT (Chat_LongAnswer_*.png).
                  <div className="flex flex-col gap-2" style={{ maxWidth: "88%" }}>
                    <div className="text-[15px]" style={{ color: "var(--text-chat-primary)" }}>
                      <MessageContent content={msg.content} darkText />
                    </div>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.actions.map((action, j) => (
                          <NavActionChip key={j} action={action} />
                        ))}
                      </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSourcesOpenForMsg(i)}
                        className="self-start inline-flex items-center gap-1 px-3 py-1 rounded-full active:scale-95 transition-all"
                        style={{
                          background: "var(--surface-chat-pill)",
                          border: "1px solid var(--border-chat-subtle)",
                          color: "var(--text-chat-secondary)",
                          fontSize: 12,
                          fontWeight: 500,
                          lineHeight: 1,
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                        }}
                      >
                        {msg.sources.length === 1 ? "Source" : "Sources"}
                        <ChevronRight size={12} strokeWidth={2} />
                      </button>
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
                  <div className="flex flex-col gap-1" style={{ color: "var(--text-chat-secondary)" }}>
                    <ThinkingDots />
                    {agentStatus && (
                      <p className="text-xs leading-snug">
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

      {/* Input area — DOT-spec dock (spec §6.1). The + button is its own
          circular soft button, separate from the text input pill (DOT
          Chat_Type_*.png). Both elements use the same translucent warm-
          white surface so they read as one family without merging. The
          input pill grows vertically as the textarea content grows or
          a photo / coffee ref is attached. */}
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
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(180,60,60,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p className="flex-1 text-xs leading-snug" style={{ color: "#7A2A2A" }}>
              {voiceError}
            </p>
            <button type="button" onClick={() => setVoiceError(null)} className="shrink-0 active:scale-90" aria-label="Dismiss">
              <X size={14} style={{ color: "#7A2A2A" }} />
            </button>
          </div>
        )}
        {attachError && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(180,60,60,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p className="flex-1 text-xs leading-snug" style={{ color: "#7A2A2A" }}>{attachError}</p>
            <button type="button" onClick={() => setAttachError(null)} className="shrink-0 active:scale-90" aria-label="Dismiss">
              <X size={14} style={{ color: "#7A2A2A" }} />
            </button>
          </div>
        )}

        {/* Recording dock — single-pill swap, spec §6.3. Uses the SAME
            translucent warm-white surface as the resting input pill (no
            heavy box-shadow, no dark backdrop) so it reads as the input
            pill simply changing role. */}
        {capture.recording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => capture.cancel()}
              aria-label="Cancel recording"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all"
              style={{
                background: "var(--surface-chat-pill-strong)",
                color: "var(--text-chat-secondary)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-chat-pill)",
              }}
            >
              <X size={18} strokeWidth={1.75} />
            </button>
            <div
              className="flex-1 flex items-center gap-2 rounded-full px-3"
              style={{
                background: "var(--surface-chat-pill-strong)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-chat-pill)",
                minHeight: 44,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse shrink-0"
                style={{ background: "#C84A3A" }}
                aria-label="Recording"
              />
              <div style={{ color: "var(--text-chat-primary)" }} className="flex-1 min-w-0">
                <WaveformBars
                  getLevel={capture.getLevel}
                  bars={32}
                  height={28}
                  className="w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => void capture.stop()}
                disabled={capture.busy}
                aria-label="Stop recording"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
                style={{ background: "var(--text-chat-primary)", color: "var(--surface-chat-card)" }}
              >
                <Square size={12} fill="currentColor" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* + button — separate circular soft button, DOT pattern. */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={loading || capture.busy}
              aria-label="Add attachment"
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
              style={{
                background: "var(--surface-chat-pill-strong)",
                color: "var(--text-chat-secondary)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-chat-pill)",
              }}
            >
              <Plus size={20} strokeWidth={1.75} />
            </button>

            {/* Input pill — its own container; grows with content / image
                / coffee ref. Image preview and coffee chip live INSIDE
                the pill so the whole capsule expands vertically. */}
            <div
              className="flex-1 flex flex-col gap-2 px-2"
              style={{
                background: "var(--surface-chat-pill-strong)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "var(--shadow-chat-pill)",
                borderRadius: (attachedImageUrl || uploadingImage || referencedCoffee) ? 22 : 999,
                paddingTop: (attachedImageUrl || uploadingImage || referencedCoffee) ? 8 : 0,
                paddingBottom: 0,
                minHeight: 44,
                transition: "border-radius 180ms ease",
              }}
            >
              {(attachedImageUrl || uploadingImage) && (
                <div className="flex pl-1 pt-1">
                  <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                      width: 76,
                      height: 76,
                      background: "rgba(255,255,255,0.4)",
                      border: "1px solid var(--border-chat-subtle)",
                    }}
                  >
                    {uploadingImage ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ color: "var(--text-chat-secondary)" }}
                      >
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
                          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(31,20,14,0.7)" }}
                        >
                          <X size={11} className="text-white" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {referencedCoffee && (
                <div className="flex pl-1">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                    style={{
                      background: "rgba(31,20,14,0.06)",
                      color: "var(--text-chat-primary)",
                      border: "1px solid var(--border-chat-subtle)",
                    }}
                  >
                    <Coffee size={11} style={{ color: "var(--text-chat-secondary)" }} />
                    <span style={{ color: "var(--text-chat-secondary)" }}>{referencedCoffee.roaster}</span>
                    <span>{referencedCoffee.name}</span>
                    <button
                      type="button"
                      onClick={() => setReferencedCoffee(null)}
                      aria-label="Remove coffee reference"
                      className="active:scale-90 ml-0.5"
                    >
                      <X size={11} style={{ color: "var(--text-chat-secondary)" }} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); if (e.target.value.length > 0) setHasInteracted(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something"
                  rows={1}
                  disabled={capture.busy}
                  className="flex-1 bg-transparent resize-none focus:outline-none disabled:opacity-60 chat-input-light"
                  style={{
                    color: "var(--text-chat-primary)",
                    caretColor: "var(--text-chat-primary)",
                    minHeight: 40,
                    maxHeight: 140,
                    padding: "10px 6px",
                    fontSize: 16,
                  }}
                />

                {/* Send (when input non-empty / image attached) OR transcribe.
                    Spec §6.1 — DOT uses an audio-lines waveform glyph for
                    the voice trigger (NOT a microphone). */}
                {input.trim().length > 0 || attachedImageUrl ? (
                  <button
                    type="button"
                    onClick={() => sendMessage(input)}
                    disabled={loading || uploadingImage}
                    aria-label="Send"
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 mb-0.5"
                    style={{ background: "var(--text-chat-primary)", color: "var(--surface-chat-card)" }}
                  >
                    <ArrowUp size={16} strokeWidth={2.25} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleMicTap}
                    disabled={loading || capture.busy}
                    aria-label="Start voice input"
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 mb-0.5"
                  >
                    <AudioLines size={18} style={{ color: "var(--text-chat-secondary)" }} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sources sheet — spec §6.5 */}
      {sourcesOpenForMsg !== null && messages[sourcesOpenForMsg]?.sources && (
        <SourcesSheet
          sources={messages[sourcesOpenForMsg].sources!}
          onClose={() => setSourcesOpenForMsg(null)}
        />
      )}

      {/* Coffee picker — search sheet, spec §6.4. Light cream variant
          to read on the new chat surface. */}
      {coffeePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: "var(--scrim-chat-dialog)", backdropFilter: "blur(4px)" }}
          onClick={() => setCoffeePickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-4 pb-6 flex flex-col gap-2"
            style={{
              background: "var(--surface-chat-card)",
              maxHeight: "70vh",
              boxShadow: "0 -12px 40px rgba(40,25,15,0.18)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "var(--text-chat-muted)", opacity: 0.4 }} />
            <div className="flex items-center gap-2 px-1 mt-1">
              <Coffee size={16} style={{ color: "var(--text-chat-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--text-chat-primary)" }}>Reference a coffee</p>
            </div>
            <input
              autoFocus
              type="text"
              value={coffeeQuery}
              onChange={e => setCoffeeQuery(e.target.value)}
              placeholder="Search roaster or coffee"
              className="w-full bg-transparent rounded-full px-4 py-2.5 text-sm focus:outline-none chat-input-light"
              style={{
                color: "var(--text-chat-primary)",
                border: "1px solid var(--border-chat-subtle)",
                background: "var(--surface-chat-card-soft)",
              }}
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
                    <p className="text-xs py-6 text-center" style={{ color: "var(--text-chat-secondary)" }}>
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
                          className="w-full flex flex-col text-left px-3 py-2.5 rounded-xl transition-colors"
                          style={{ background: "transparent" }}
                          onMouseDown={e => (e.currentTarget.style.background = "var(--surface-chat-card-soft)")}
                          onMouseUp={e => (e.currentTarget.style.background = "transparent")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span className="text-xs" style={{ color: "var(--text-chat-secondary)" }}>{c.roaster}</span>
                          <span className="text-sm" style={{ color: "var(--text-chat-primary)" }}>{c.name}</span>
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

      {/* Attach sheet — bottom modal, spec §6.4. Light cream variant. */}
      {attachSheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: "var(--scrim-chat-dialog)", backdropFilter: "blur(4px)" }}
          onClick={() => setAttachSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-4 pb-6 flex flex-col gap-1"
            style={{
              background: "var(--surface-chat-card)",
              boxShadow: "0 -12px 40px rgba(40,25,15,0.18)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: "var(--text-chat-muted)", opacity: 0.4 }} />

            <button
              type="button"
              onClick={handlePhotoPick}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors text-left"
              onMouseDown={e => (e.currentTarget.style.background = "var(--surface-chat-card-soft)")}
              onMouseUp={e => (e.currentTarget.style.background = "transparent")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Camera size={20} style={{ color: "var(--text-chat-secondary)" }} />
              <span className="text-sm" style={{ color: "var(--text-chat-primary)" }}>Photo</span>
            </button>

            <button
              type="button"
              onClick={() => { setAttachSheetOpen(false); setCoffeeQuery(""); setCoffeePickerOpen(true); }}
              disabled={coffeeList.length === 0}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              onMouseDown={e => (e.currentTarget.style.background = "var(--surface-chat-card-soft)")}
              onMouseUp={e => (e.currentTarget.style.background = "transparent")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Coffee size={20} style={{ color: "var(--text-chat-secondary)" }} />
              <span className="text-sm" style={{ color: "var(--text-chat-primary)" }}>Reference coffee</span>
              {coffeeList.length === 0 && (
                <span className="ml-auto text-xs" style={{ color: "var(--text-chat-muted)" }}>library empty</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { handleVoiceToggle(); setAttachSheetOpen(false); }}
              className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors text-left"
              onMouseDown={e => (e.currentTarget.style.background = "var(--surface-chat-card-soft)")}
              onMouseUp={e => (e.currentTarget.style.background = "transparent")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {voiceMode ? (
                <Volume2 size={20} style={{ color: "var(--text-chat-secondary)" }} />
              ) : (
                <VolumeX size={20} style={{ color: "var(--text-chat-muted)" }} />
              )}
              <span className="text-sm" style={{ color: "var(--text-chat-primary)" }}>
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

// ── Sources sheet (spec §6.5) ──────────────────────────────────────────────

function SourcesSheet({
  sources,
  onClose,
}: {
  sources: { title: string; url: string }[];
  onClose: () => void;
}) {
  // Dedupe by URL — keep first occurrence's title.
  const dedup: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    dedup.push(s);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "var(--scrim-chat-dialog)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-4 pb-6 flex flex-col gap-3"
        style={{
          background: "var(--surface-chat-card)",
          maxHeight: "70vh",
          boxShadow: "0 -12px 40px rgba(40,25,15,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "var(--text-chat-muted)", opacity: 0.4 }} />
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-medium" style={{ color: "var(--text-chat-primary)" }}>
            {dedup.length === 1 ? "Source" : "Sources"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
          >
            <X size={18} style={{ color: "var(--text-chat-secondary)" }} />
          </button>
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto -mx-1 px-1">
          {dedup.map((src, i) => (
            <li key={i}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl active:scale-[0.99] transition-all"
                style={{
                  background: "var(--surface-chat-card-soft)",
                  border: "1px solid var(--border-chat-subtle)",
                }}
              >
                <SourceFavicon url={src.url} />
                <div className="flex-1 min-w-0 flex flex-col">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-chat-primary)" }}
                  >
                    {src.title || prettyUrl(src.url)}
                  </span>
                  <span
                    className="text-xs truncate"
                    style={{ color: "var(--text-chat-secondary)" }}
                  >
                    {prettyUrl(src.url)}
                  </span>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-chat-muted)" }} className="shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* invalid URL — fall through to globe */
  }

  const wrapperClass =
    "w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0";
  const wrapperStyle: React.CSSProperties = {
    background: "var(--surface-chat-card)",
    border: "1px solid var(--border-chat-subtle)",
  };

  if (failed || !host) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <Globe size={16} style={{ color: "var(--text-chat-secondary)" }} />
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
        alt=""
        width={20}
        height={20}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url;
  }
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
  const props = { size: 12, style: { color: "var(--text-chat-secondary)" } };
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
        background: "var(--surface-chat-pill)",
        border: "1px solid var(--border-chat-subtle)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "999px",
        padding: "5px 12px",
        color: "var(--text-chat-secondary)",
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
