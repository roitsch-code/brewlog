"use client";

import { useEffect, useRef } from "react";

/**
 * BTTS Chat Thread — specs/home.md §4 (conversation thread).
 *
 * PR2d minimum: render messages array. User content as right-aligned Glass
 * bubbles (§4.2); agent responses as left-aligned prose, no bubble (§4.3).
 * That visual distinction is the spec's "user chats, BTTS writes" anchor.
 *
 * PR2e refines: top-edge fade (mask-image), proper sticky-aware scroll
 * behaviour with manual-scroll detection, and the streaming/done UX
 * polish. For PR2d, basic auto-scroll-to-bottom is enough so streamed
 * content stays in view.
 *
 * Three-dot indicator renders only between a sent user message and the
 * first assistant delta — once any assistant text arrives, the indicator
 * is replaced by the (still-streaming) prose.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatThreadProps {
  messages: Message[];
  loading: boolean;
}

export default function ChatThread({ messages, loading }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Show the dots only when waiting for the first delta — i.e. the most
  // recent message is the user's, OR the latest assistant message is empty.
  const last = messages[messages.length - 1];
  const showDots =
    loading &&
    (!last || last.role === "user" || (last.role === "assistant" && last.content === ""));

  return (
    <div className="flex w-full flex-col gap-3 px-5 py-5">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl border border-light-foreground/10 bg-light-card-default px-4 py-3 backdrop-blur-[14px] backdrop-saturate-150">
              <p className="whitespace-pre-wrap font-inter text-[15px] font-normal text-light-foreground">
                {m.content}
              </p>
            </div>
          </div>
        ) : (
          m.content && (
            <div key={i} className="space-y-3">
              {m.content.split(/\n\n+/).map((para, j) => (
                <p
                  key={j}
                  className="whitespace-pre-wrap font-inter text-[15px] font-normal leading-[1.5] text-light-foreground"
                >
                  {para}
                </p>
              ))}
            </div>
          )
        )
      )}

      {showDots && (
        <div className="flex items-center gap-1.5 pt-1" aria-label="Thinking">
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-light-foreground/40"
            style={{ animationDuration: "1200ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-light-foreground/40"
            style={{ animationDuration: "1200ms", animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-light-foreground/40"
            style={{ animationDuration: "1200ms", animationDelay: "300ms" }}
          />
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
