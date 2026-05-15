"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import ChatInput from "@/components/ui/light/ChatInput";
import ChatThread from "@/components/ui/light/ChatThread";
import type { Session } from "@/lib/types/session";

/**
 * BTTS Home (specs/home.md §0, §11).
 *
 * PR2b: static Starter view.
 * PR2c: Burger opens the Navigation Overlay.
 * PR2d: chat input wired to /api/explore-agent. Send / receive / stream.
 *       The Hero slot switches from Starter (§11.1) to Live-thread (§11.2)
 *       once the user starts composing or has sent at least one message.
 *
 * Out of PR2d scope (deferred):
 *   - Voice / transcript review (PR2f)
 *   - Attachment + Reference Coffee (PR2g, PR2h)
 *   - Action Pills (PR2i)
 *   - Real Haiku Starter (PR2j)
 *   - Persistence / 30-min idle reset (PR2k)
 *   - Past Conversations view (PR2l)
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STARTER_TEXT =
  "Good morning. DAK Coffee Roasters yesterday — try Process or anything new today?";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [interacted, setInteracted] = useState(false);

  // Fetch recent sessions once so /api/explore-agent has the personal
  // recipe context. Same shape as /explore consumes.
  useEffect(() => {
    fetch("/api/sessions?limit=5", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Session[]) => {
        if (Array.isArray(data)) setRecentSessions(data);
      })
      .catch(() => {});
  }, []);

  const showStarter = messages.length === 0 && !interacted;

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setInteracted(true);

    try {
      const res = await fetch("/api/explore-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, recentSessions }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't get a response. Try again." },
        ]);
        return;
      }

      // Seed an empty assistant entry that delta events progressively fill.
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });

        // SSE frames are "event: NAME\ndata: JSON\n\n".
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
              /* malformed event — skip */
            }
          } else if (event === "retract") {
            // Agent started speaking, then decided to call a tool — drop
            // whatever it streamed before the tool call.
            setMessages((prev) => {
              const copy = prev.slice();
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last?.role === "assistant") {
                copy[lastIdx] = { ...last, content: "" };
              }
              return copy;
            });
          }
          // status / done events ignored in PR2d — status messages and
          // navigation actions land in PR2i with the Action Pills work.
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

        {/* Hero slot — §11.0. flex-1 + min-h-0 hold the height; ChatThread
            owns its own scrollable container (§4.4 fade + §4.5 stick-
            to-bottom auto-scroll). */}
        <section className="flex-1 min-h-0">
          {showStarter ? (
            <div className="flex h-full items-center px-5">
              <p className="font-fraunces text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-light-foreground">
                {STARTER_TEXT}
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
