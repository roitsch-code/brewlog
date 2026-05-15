"use client";

import { useEffect, useRef } from "react";

/**
 * BTTS Chat Thread — specs/home.md §4.
 *
 * User content as right-aligned Glass bubbles (§4.2); agent responses as
 * left-aligned prose, no bubble (§4.3).
 *
 * §4.2 stacked-bubble rule: when a user message includes an attachment,
 * the attachment renders as its own bubble above the text bubble. Two
 * bubbles, both right-aligned, both Glass, separated by mb-2.
 *
 * §4.4 fade + §4.5 stick-to-bottom auto-scroll preserved from PR2e.
 */

export interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

interface ChatThreadProps {
  messages: Message[];
  loading: boolean;
}

export default function ChatThread({ messages, loading }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

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
              <div key={i} className="flex flex-col items-end gap-2">
                {m.imageUrl && (
                  <div className="max-w-[80%] overflow-hidden rounded-2xl border border-light-foreground/10 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt="Attached"
                      className="block max-h-[280px] w-auto max-w-full object-cover"
                    />
                  </div>
                )}
                {m.content && (
                  <div className="max-w-[80%] rounded-2xl border border-light-foreground/10 bg-light-card-default px-4 py-3 backdrop-blur-[14px] backdrop-saturate-150">
                    <p className="whitespace-pre-wrap font-inter text-[15px] font-normal text-light-foreground">
                      {m.content}
                    </p>
                  </div>
                )}
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
