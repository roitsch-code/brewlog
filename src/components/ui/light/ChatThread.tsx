"use client";

import { useEffect, useRef } from "react";

/**
 * BTTS Chat Thread — specs/home.md §4.
 *
 * Owns the scroll container so the top-edge fade (§4.4) and the
 * stick-to-bottom auto-scroll (§4.5) live together.
 *
 * §4.4 — Top-edge fade. Older messages disappear into a 80px gradient
 * mask at the top of the thread, so they read as "fading toward the
 * header" rather than getting clipped at a hard line. The header above
 * has no background, so the warm Field stays continuous.
 *
 * §4.5 — Scroll behaviour. Latest message at bottom, conversation
 * scrolled to bottom by default. Auto-scroll-to-bottom on new delta
 * UNLESS the user has manually scrolled up — in which case their
 * position is preserved so they can keep reading older content while
 * the agent's response streams in below.
 *
 * Detection: a ref tracks "stick to bottom" state. Every scroll event
 * recomputes it (50px tolerance to allow rounding). Programmatic
 * scrolls land us back at the bottom and flip the ref true again.
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Latest message content reference — included as a dep so streamed
  // deltas (which mutate the last assistant message in place) trigger
  // a scroll attempt.
  const tailContent = messages[messages.length - 1]?.content ?? "";

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, tailContent]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
    stickToBottomRef.current = atBottom;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_80px)] [mask-image:linear-gradient(to_bottom,transparent_0,black_80px)]"
    >
      <div className="flex min-h-full flex-col justify-end">
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
        </div>
      </div>
    </div>
  );
}
