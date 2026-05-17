"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";

/**
 * BTTS Past Conversations (specs/home.md §7.2 / §10).
 *
 * Archive list. Each row shows the date the thread last had activity
 * plus the first user message as a preview. Tap → detail view at
 * /past-conversations/[id]. The trash icon deletes the conversation
 * (cascade-removes its messages).
 *
 * Auto-archive is what populates this list — see /api/conversations/
 * archive: a thread without any user message gets dropped instead of
 * archived, so we only ever see things the user actually engaged with.
 */

interface ConversationRow {
  id: string;
  startedAt: string;
  lastMessageAt: string;
  archivedAt: string | null;
  messageCount: number;
  firstUserMessage: string | null;
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

export default function PastConversationsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch("/api/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConversationRow[]) => {
        if (Array.isArray(data)) setRows(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <main className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between pl-5 pr-5 pt-12 pb-3">
          <h1 className="font-fraunces text-3xl leading-none text-light-foreground">
            Past conversations
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

        <section className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="font-chivo text-[15px] text-light-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="font-chivo text-[15px] text-light-muted-foreground">
              No archived conversations yet. Send a message on Home, leave the app idle for 30
              minutes, and it lands here.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <div className="flex items-stretch gap-2">
                    <Link
                      href={`/past-conversations/${row.id}`}
                      className="flex flex-1 items-center gap-3 rounded-2xl border border-light-foreground/25 bg-light-card-default px-4 py-3 backdrop-blur-[14px] backdrop-saturate-150"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-chivo text-[12px] font-normal text-light-muted-foreground">
                          {formatDate(row.lastMessageAt)} · {row.messageCount} turns
                        </span>
                        <span className="line-clamp-2 break-words font-chivo text-[15px] font-medium text-light-foreground">
                          {row.firstUserMessage || "(empty thread)"}
                        </span>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-light-foreground/40"
                        strokeWidth={1.5}
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.id)}
                      aria-label="Delete conversation"
                      className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/70 backdrop-blur-[14px] backdrop-saturate-150"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
