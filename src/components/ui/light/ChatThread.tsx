"use client";

import { useEffect, useRef } from "react";

/**
 * BTTS Chat Thread — specs/home.md §4 (conversation thread).
 *
 * User content as right-aligned Glass bubbles (§4.2); agent responses as
 * left-aligned prose, no bubble (§4.3) — the spec's "user chats, BTTS
 * writes" anchor.
 *
 * The "thinking" three-dot indicator lives in ChatInput (§2.2 — above the
 * empty bar with mb-3) so the loading signal stays anchored to the
 * input area rather than the thread tail.
 *
 * PR2e refines: top-edge fade (mask-image), manual-scroll detection,
 * proper sticky-aware scroll behaviour. For PR2d, basic auto-scroll to
 * bottom on new content is enough.
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
      <div ref={endRef} />
    </div>
  );
}
