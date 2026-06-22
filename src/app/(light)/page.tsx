"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import ChatInput, { type SendPayload } from "@/components/ui/light/ChatInput";
import ChatThread, { type Message } from "@/components/ui/light/ChatThread";
import HaikuStarter from "@/components/ui/light/HaikuStarter";
import HydrationCheckin from "@/components/hydration/HydrationCheckin";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";
import { useFlowStore } from "@/store/flowStore";
import type { Session } from "@/lib/types/session";
import type { NavAction } from "@/app/api/explore-agent/route";

// Extract the first complete sentence from the front of `buf`. "Complete" =
// terminating punctuation (`.!?` or newline) followed by whitespace. We deny
// end-of-string because mid-stream the next chunk might continue the sentence
// (e.g. a decimal like "3.14" or "Mr. Hoffmann"). The final flush at
// stream-end accepts whatever's left without this guard.
function takeSentence(buf: string): { sentence: string; rest: string } | null {
  const re = /[.!?\n]+\s/;
  const m = re.exec(buf);
  if (!m) return null;
  const endIdx = m.index + m[0].length;
  const sentence = buf.slice(0, endIdx).trim();
  const rest = buf.slice(endIdx);
  if (!sentence) return null;
  return { sentence, rest };
}

/**
 * BTTS Home (specs/home.md §0, §8, §10, §11).
 *
 * Persistence (§10):
 *   - On mount we ask /api/conversations/active for the latest non-
 *     archived conversation. If `lastMessageAt` is older than the
 *     30-min idle window we POST /api/conversations/archive and start
 *     fresh with the daily Starter; otherwise we resume the thread.
 *   - On every send (user message) and at the end of every assistant
 *     response (with its final content + actions) we fire-and-forget
 *     POST /api/conversations so the thread is durable even if the
 *     tab is closed mid-stream.
 *   - Empty conversations are auto-deleted by the archive endpoint
 *     when no user message ever landed (§10 "Only threads with at
 *     least one User-Message survive").
 *
 * Starter (§8):
 *   - One Haiku call per calendar day, cached in localStorage under
 *     `brewlog.starter.<YYYY-MM-DD>`.
 *   - Only rendered when there is no live thread and the user hasn't
 *     started composing.
 *
 * Inline tag (§3.3 + /explore parity):
 *   - When a coffeeRef rides with a send, we prepend `[Coffee: roaster
 *     name]` to the last user message we ship to /api/explore-agent.
 *     The DB still stores the structured coffeeRef on the message row.
 *
 * Action Pills (§6):
 *   - SSE `done` event carries `actions`; we attach them to the
 *     in-memory assistant message AND persist them with the assistant
 *     POST so they survive across sessions.
 */

const IDLE_WINDOW_MS = 30 * 60 * 1000;

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Bucket the current hour into the same time-of-day labels the
 * /api/greeting prompt uses (morning / midday / afternoon / evening /
 * late-night). The Starter cache key includes this bucket so a
 * starter generated at 11:30 doesn't keep saying "Quiet afternoon"
 * when the user re-opens at 20:45 — Markus' bug. Five regenerations
 * per active day max; ~$0.0005 in Haiku cost, structurally trivial.
 */
function timeBucket(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "late-night";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "late-night";
}

interface ActiveConversationResponse {
  conversation: {
    id: string;
    startedAt: string;
    lastMessageAt: string;
    archivedAt: string | null;
    messageCount: number;
    firstUserMessage: string | null;
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    imageUrl?: string;
    coffeeRef?: { id: string; roaster: string; name: string };
    actions?: NavAction[];
    createdAt: string;
  }>;
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  // Empty initial — the daily Starter is the AI-generated greeting from
  // /api/greeting (cached per (date, time-bucket) in localStorage). No
  // hardcoded placeholder: the slot stays empty until the real line
  // lands, which is better UX than flashing a generic "Welcome…" string.
  const [starter, setStarter] = useState<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voice = useVoicePlayback();

  // Recent sessions for the agent's personal-context block.
  useEffect(() => {
    fetch("/api/sessions?limit=5", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Session[]) => {
        if (Array.isArray(data)) setRecentSessions(data);
      })
      .catch(() => {});
  }, []);

  // Idle-window check + resume or fresh start.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations/active", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ActiveConversationResponse | null) => {
        if (cancelled || !data) return;
        const ageMs = Date.now() - new Date(data.conversation.lastMessageAt).getTime();
        if (ageMs > IDLE_WINDOW_MS) {
          fetch("/api/conversations/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: data.conversation.id }),
          }).catch(() => {});
          return;
        }
        conversationIdRef.current = data.conversation.id;
        setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
            ...(m.coffeeRef ? { coffeeRef: m.coffeeRef } : {}),
            ...(m.actions ? { actions: m.actions } : {}),
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Daily Starter — cached per calendar day in localStorage.
  useEffect(() => {
    // Cache version bumped on every greeting-prompt change so stale
    // cached lines from the previous rule don't show up next morning.
    // v6 = science-grounded recommendation + optional live weather
    // (Open-Meteo) so a hot day can steer toward iced. Time-of-day
    // bucket appended so the starter regenerates when the user crosses
    // a tod boundary (morning → midday → afternoon → evening →
    // late-night). Old `brewlog.starter.v{2..6}.<date>` entries are
    // orphaned in localStorage — harmless.
    // v9 bumps for the Europe/Berlin timezone fix on the server — prior
    // cached "Late night" greetings generated at 06:00 CEST (because
    // the server read UTC 04:00) need to be discarded so the morning
    // bucket regenerates from scratch.
    const key = `brewlog.starter.v9.${todayKey()}.${timeBucket()}`;
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        setStarter(cached);
        return;
      }
    } catch {
      /* private mode etc. — fall through */
    }
    fetch("/api/greeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { text?: string } | null) => {
        const text = data?.text?.trim();
        if (!text) return;
        setStarter(text);
        try {
          window.localStorage.setItem(key, text);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  // The welcome haiku shows whenever the screen is idle: no conversation yet
  // AND nothing being composed. `composing` is reported live by ChatInput, so
  // opening the + sheet or tapping the mic keeps the haiku (those aren't
  // composing) and clearing a draft brings it back with its entrance animation.
  const showStarter = messages.length === 0 && !composing;

  const persistMessage = (
    role: "user" | "assistant",
    content: string,
    extras: {
      imageUrl?: string;
      coffeeRef?: { id: string; roaster: string; name: string };
      actions?: NavAction[];
    } = {}
  ): Promise<string | null> => {
    return fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationIdRef.current,
        role,
        content,
        imageUrl: extras.imageUrl ?? null,
        coffeeRef: extras.coffeeRef ?? null,
        actions: extras.actions ?? null,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { conversationId?: string } | null) => {
        if (data?.conversationId && !conversationIdRef.current) {
          conversationIdRef.current = data.conversationId;
        }
        return data?.conversationId ?? conversationIdRef.current;
      })
      .catch(() => null);
  };

  const handleSend = async ({ text, imageUrl, coffeeRef, voiceInitiated }: SendPayload) => {
    const userMsg: Message = {
      role: "user",
      content: text,
      ...(imageUrl ? { imageUrl } : {}),
      ...(coffeeRef ? { coffeeRef } : {}),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    // Persist the user message in parallel with the agent request.
    void persistMessage("user", text, {
      ...(imageUrl ? { imageUrl } : {}),
      ...(coffeeRef ? { coffeeRef } : {}),
    });

    let assistantContent = "";
    let assistantActions: NavAction[] | undefined;
    let ttsBuffer = "";
    // TTS only for voice-initiated turns — typed messages get a silent
    // assistant reply. Stop any audio still playing from the previous turn
    // either way so a new voice turn doesn't overlap the old one.
    const speakReply = voiceInitiated === true;
    voice.cancel();

    try {
      const apiMessages = next.map((m, idx) => {
        if (idx === next.length - 1 && coffeeRef) {
          const tag = `[Coffee: ${coffeeRef.roaster} ${coffeeRef.name}]`;
          return {
            role: m.role,
            content: m.content ? `${tag}\n${m.content}` : tag,
          };
        }
        return { role: m.role, content: m.content };
      });

      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/explore-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          recentSessions,
          ...(imageUrl ? { attachedImageUrl: imageUrl } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't get a response. Try again." },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = carry.indexOf("\n\n")) !== -1) {
          const block = carry.slice(0, idx);
          carry = carry.slice(idx + 2);

          let event = "message";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7);
            else if (line.startsWith("data: ")) data += line.slice(6);
          }

          if (event === "delta") {
            try {
              const payload = JSON.parse(data) as { text?: string };
              if (payload.text) {
                assistantContent += payload.text;
                if (speakReply) {
                  ttsBuffer += payload.text;
                  // Drain every complete sentence into the TTS queue. The
                  // hook pre-fetches up to MAX_AHEAD ahead and plays them in
                  // order, so the user hears the first sentence while the
                  // rest still stream.
                  while (true) {
                    const taken = takeSentence(ttsBuffer);
                    if (!taken) break;
                    ttsBuffer = taken.rest;
                    voice.enqueue(taken.sentence);
                  }
                }
                setMessages((prev) => {
                  const copy = prev.slice();
                  const lastIdx = copy.length - 1;
                  const last = copy[lastIdx];
                  if (last?.role === "assistant") {
                    copy[lastIdx] = { ...last, content: last.content + payload.text };
                  }
                  return copy;
                });
              }
            } catch {
              /* skip malformed */
            }
          } else if (event === "retract") {
            assistantContent = "";
            ttsBuffer = "";
            // Drop whatever was about to be spoken — the agent walked it back.
            if (speakReply) voice.cancel();
            setMessages((prev) => {
              const copy = prev.slice();
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last?.role === "assistant") {
                copy[lastIdx] = { ...last, content: "" };
              }
              return copy;
            });
          } else if (event === "done") {
            try {
              const payload = JSON.parse(data) as { actions?: NavAction[] };
              if (payload.actions && payload.actions.length > 0) {
                assistantActions = payload.actions;
                setMessages((prev) => {
                  const copy = prev.slice();
                  const lastIdx = copy.length - 1;
                  const last = copy[lastIdx];
                  if (last?.role === "assistant") {
                    copy[lastIdx] = { ...last, actions: payload.actions };
                  }
                  return copy;
                });
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      // Speak any tail that didn't end in punctuation (the model sometimes
      // closes a reply with a clause that has no terminating period).
      if (speakReply) {
        const tail = ttsBuffer.trim();
        if (tail.length >= 2) voice.enqueue(tail);
      }
      ttsBuffer = "";

      if (assistantContent || assistantActions) {
        void persistMessage("assistant", assistantContent, {
          ...(assistantActions ? { actions: assistantActions } : {}),
        });
      }
    } catch (err) {
      // Stop button aborted the request — keep whatever streamed, no error bubble.
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Couldn't reach BTTS. Check your connection." },
        ]);
      } else {
        // Stopped before any text arrived — drop the empty assistant bubble.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && !last.content && !last.actions) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  // Stop button while a reply streams — abort the request and silence any TTS.
  const handleStop = () => {
    abortRef.current?.abort();
    voice.cancel();
  };

  // A coffee URL shared in via "Add to BTTS" (Share Sheet → its notification):
  // auto-ask the chat about it, once. The native bridge set pendingChatUrl and
  // routed here; clear it immediately and guard against a re-fire.
  const pendingChatUrl = useFlowStore((s) => s.pendingChatUrl);
  const setPendingChatUrl = useFlowStore((s) => s.setPendingChatUrl);
  const sharedHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingChatUrl || sharedHandledRef.current === pendingChatUrl) return;
    sharedHandledRef.current = pendingChatUrl;
    const url = pendingChatUrl;
    setPendingChatUrl(null);
    void handleSend({ text: `What do you think of this coffee: ${url}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatUrl]);

  // A PHOTO shared in via "Add to BTTS" (Share Sheet → album image): the native
  // bridge read it from the App Group as a data URL. Upload it (so it gets a
  // real S3 url like any chat photo), attach it, and auto-ask about it — once.
  const pendingChatImageData = useFlowStore((s) => s.pendingChatImageData);
  const setPendingChatImageData = useFlowStore((s) => s.setPendingChatImageData);
  const sharedImageHandledRef = useRef(false);
  useEffect(() => {
    if (!pendingChatImageData || sharedImageHandledRef.current) return;
    sharedImageHandledRef.current = true;
    const dataUrl = pendingChatImageData;
    setPendingChatImageData(null);
    void (async () => {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `shared-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
        const form = new FormData();
        form.append("file", file);
        form.append("path", `uploads/chat-${Date.now()}-shared.jpg`);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error(`upload ${res.status}`);
        const { url } = await res.json();
        if (!url) throw new Error("no url");
        await handleSend({ text: "What do you think of this coffee?", imageUrl: url });
      } catch {
        // Upload failed — let the user retry by attaching manually; reset guard.
        sharedImageHandledRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatImageData]);

  // Siri "BTTS Voice" / Action Button (btts://voice): the native bridge set
  // pendingVoiceChat and routed here. Bump a nonce that ChatInput watches to
  // arm the mic (→ listening earcon), then clear the flag so a normal open
  // never auto-listens.
  const pendingVoiceChat = useFlowStore((s) => s.pendingVoiceChat);
  const setPendingVoiceChat = useFlowStore((s) => s.setPendingVoiceChat);
  const [autoListenNonce, setAutoListenNonce] = useState(0);
  useEffect(() => {
    if (!pendingVoiceChat) return;
    setPendingVoiceChat(false);
    setAutoListenNonce((n) => n + 1);
  }, [pendingVoiceChat, setPendingVoiceChat]);

  return (
    <>
      <main className="flex h-dvh flex-col">
        <header
          className="flex shrink-0 items-start justify-between px-5 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
        >
          <h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground">
            Better taste<br />than sorry.
          </h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-light-foreground text-light-text-on-dark shadow-light-float"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        {/* The haiku is an absolute, pointer-events-none overlay so it can
            dissolve over the ChatThread that mounts underneath the moment the
            user starts composing — instead of the old hard ternary swap. */}
        <section className="relative flex-1 min-h-0">
          {!showStarter && <ChatThread messages={messages} loading={loading} />}
          <HaikuStarter text={starter} show={showStarter} />
          {/* Adaptive hydration check-in: a quiet bottom card that only
              surfaces when there's a raised-target banner to ack or the
              evening check-in is due (self-contained, fetches its own data). */}
          <HydrationCheckin />
        </section>

        <ChatInput
          loading={loading}
          onSend={handleSend}
          onStop={handleStop}
          onComposingChange={setComposing}
          assistantSpeaking={voice.speaking}
          onCancelSpeak={voice.cancel}
          onUnlockAudio={voice.unlock}
          autoListenSignal={autoListenNonce}
        />
      </main>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
