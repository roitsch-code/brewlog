"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import ChatInput, { type SendPayload } from "@/components/ui/light/ChatInput";
import ChatThread, { type Message } from "@/components/ui/light/ChatThread";
import type { Session } from "@/lib/types/session";
import type { NavAction } from "@/app/api/explore-agent/route";

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

const FALLBACK_STARTER = "Welcome to Better Taste Than Sorry.";
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
  const [interacted, setInteracted] = useState(false);
  const [starter, setStarter] = useState<string>(FALLBACK_STARTER);
  const conversationIdRef = useRef<string | null>(null);

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
        if (data.messages.length > 0) setInteracted(true);
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
    // v4 = strict rotation rule (no non-rotation references when
    // rotation is non-empty). Time-of-day bucket appended so the
    // starter regenerates when the user crosses a tod boundary
    // (morning → midday → afternoon → evening → late-night). Earlier
    // bug: opening the app at 11:00 cached a "morning" line that
    // showed all day even when re-opened at 20:45. Old
    // `brewlog.starter.v{2,3}.<date>` entries are orphaned in
    // localStorage — harmless.
    const key = `brewlog.starter.v4.${todayKey()}.${timeBucket()}`;
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

  const showStarter = messages.length === 0 && !interacted;

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

  const handleSend = async ({ text, imageUrl, coffeeRef }: SendPayload) => {
    const userMsg: Message = {
      role: "user",
      content: text,
      ...(imageUrl ? { imageUrl } : {}),
      ...(coffeeRef ? { coffeeRef } : {}),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setInteracted(true);

    // Persist the user message in parallel with the agent request.
    void persistMessage("user", text, {
      ...(imageUrl ? { imageUrl } : {}),
      ...(coffeeRef ? { coffeeRef } : {}),
    });

    let assistantContent = "";
    let assistantActions: NavAction[] | undefined;

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

      const res = await fetch("/api/explore-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          recentSessions,
          ...(imageUrl ? { attachedImageUrl: imageUrl } : {}),
        }),
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

      if (assistantContent || assistantActions) {
        void persistMessage("assistant", assistantContent, {
          ...(assistantActions ? { actions: assistantActions } : {}),
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't reach BTTS. Check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between pl-5 pr-5 pt-12 pb-3">
          <h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground">
            Better taste<br />than sorry.
          </h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        <section className="flex-1 min-h-0">
          {showStarter ? (
            <div className="flex h-full items-center px-5">
              <p className="font-fraunces text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-light-foreground">
                {starter}
              </p>
            </div>
          ) : (
            <ChatThread messages={messages} loading={loading} />
          )}
        </section>

        <ChatInput
          loading={loading}
          onSend={handleSend}
          onComposeStart={() => setInteracted(true)}
        />
      </main>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
