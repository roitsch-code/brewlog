"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import ChatInput, { type SendPayload } from "@/components/ui/light/ChatInput";
import ChatThread, { type Message } from "@/components/ui/light/ChatThread";
import type { Session } from "@/lib/types/session";
import type { NavAction } from "@/app/api/explore-agent/route";

/**
 * BTTS Home (specs/home.md §0, §8, §11).
 *
 * State derives the Hero-slot content:
 *   - showStarter — the daily editorial Haiku (§8) when no thread
 *     exists and the user hasn't started composing.
 *   - otherwise — the live conversation thread.
 *
 * Starter (§8.2):
 *   - One Haiku call per calendar day, cached in localStorage under
 *     `brewlog.starter.<YYYY-MM-DD>`.
 *   - On mount we check today's cache; if missing, fetch from
 *     /api/greeting and store. Failures fall back to the hardcoded
 *     welcome line.
 *
 * Compose flow now passes a SendPayload (text + optional photo URL +
 * optional coffee reference). The coffee reference is folded into the
 * last user message as an inline `[Coffee: roaster · name]` tag (same
 * pattern /explore uses) so /api/explore-agent surfaces it without
 * needing a new field.
 *
 * Action Pills (§6): the SSE `done` event carries a `actions` array;
 * we attach it to the last assistant message so ChatThread can render
 * the pills under the response.
 */

const FALLBACK_STARTER = "Welcome to Better Taste Than Sorry.";

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [starter, setStarter] = useState<string>(FALLBACK_STARTER);

  // Recent sessions for the agent's personal-context block.
  useEffect(() => {
    fetch("/api/sessions?limit=5", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Session[]) => {
        if (Array.isArray(data)) setRecentSessions(data);
      })
      .catch(() => {});
  }, []);

  // Daily Starter — read cache, fetch if today's slot is empty.
  useEffect(() => {
    const key = `brewlog.starter.${todayKey()}`;
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        setStarter(cached);
        return;
      }
    } catch {
      /* private mode etc. — fall through to fetch */
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
          /* ignore quota / private-mode errors */
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  const showStarter = messages.length === 0 && !interacted;

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

    try {
      // Inline the coffee reference into the last user turn — same
      // pattern /explore uses so /api/explore-agent picks it up
      // without a new API field.
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
              /* malformed — skip */
            }
          } else if (event === "retract") {
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
          <h1 className="font-inter text-[14px] font-medium text-light-foreground/60">
            Better taste than sorry
          </h1>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/10 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
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
