"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import ChatThread, { type Message } from "@/components/ui/light/ChatThread";
import type { NavAction } from "@/app/api/explore-agent/route";

/**
 * BTTS Past Conversation detail (specs/home.md §10).
 *
 * Read-only view of an archived thread. Same ChatThread component as
 * Home so user bubbles, photo bubbles, coffee references, agent prose,
 * and action pills all render identically. No input bar — this surface
 * is a record, not a composition.
 *
 * Back button (top-left, mirroring the Burger position) returns to
 * /past-conversations. The Burger still works for navigating
 * elsewhere.
 */

interface ConversationDetail {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export default function PastConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/conversations/${id}`, { cache: "no-store" })
      .then((r) => {
        if (r.status === 404) {
          throw new Error("not found");
        }
        if (!r.ok) throw new Error("server");
        return r.json();
      })
      .then((d: ConversationDetail) => setData(d))
      .catch((err: Error) => {
        setError(err.message === "not found" ? "Conversation not found." : "Couldn't load.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const messages: Message[] =
    data?.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
      ...(m.coffeeRef ? { coffeeRef: m.coffeeRef } : {}),
      ...(m.actions ? { actions: m.actions } : {}),
    })) ?? [];

  return (
    <>
      <main className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between pl-5 pr-5 pt-12 pb-3">
          <button
            type="button"
            onClick={() => router.push("/past-conversations")}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h1 className="font-chivo text-[14px] font-medium text-light-foreground/60">
            {data ? formatDate(data.conversation.lastMessageAt) : "Conversation"}
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
          {loading ? (
            <div className="flex h-full items-center px-5">
              <p className="font-chivo text-[15px] text-light-muted-foreground">Loading…</p>
            </div>
          ) : error ? (
            <div className="flex h-full items-center px-5">
              <p className="font-chivo text-[15px] text-light-muted-foreground">{error}</p>
            </div>
          ) : (
            <ChatThread messages={messages} loading={false} />
          )}
        </section>

        {/* No input bar — read-only surface. Bottom safe-area padding
            still respected via an empty footer. */}
        <div className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]" />
      </main>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
