"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * BTTS Chat Thread — specs/home.md §4.
 *
 * User content as right-aligned Glass bubbles (§4.2); agent responses as
 * left-aligned prose, no bubble (§4.3). Stacked-bubble rule when the
 * user message includes an attachment (photo bubble above text bubble).
 *
 * §4.4 top-edge fade + §4.5 stick-to-bottom auto-scroll preserved from
 * PR2e.
 *
 * Inline Markdown: the agent prose is rendered through a tiny
 * Markdown-to-React parser so `**bold**` and `*italic*` from the
 * /api/explore-agent response don't leak through as literal asterisks.
 * Anything beyond inline bold/italic (lists, headers, code blocks)
 * stays as plain text for now — add cases here as they show up in
 * real responses.
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

/**
 * Render a string with inline Markdown emphasis. Supports `**bold**`
 * and `*italic*` (and their underscore variants). Anything else flows
 * through as plain text — `whitespace-pre-wrap` on the `<p>` preserves
 * single newlines.
 *
 * Strategy: scan left-to-right; longer delimiters (`**` / `__`) before
 * shorter (`*` / `_`) so bold isn't misread as two adjacent italics.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const matchDelim = (delim: string): number => {
    if (text.startsWith(delim, i)) {
      const end = text.indexOf(delim, i + delim.length);
      if (end > i + delim.length) return end;
    }
    return -1;
  };

  let buffer = "";
  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    const boldEnd =
      matchDelim("**") !== -1
        ? matchDelim("**")
        : matchDelim("__") !== -1
        ? matchDelim("__")
        : -1;
    const boldDelim = text.startsWith("**", i) ? "**" : text.startsWith("__", i) ? "__" : null;

    if (boldDelim && boldEnd !== -1) {
      flush();
      nodes.push(
        <strong key={key++} className="font-semibold text-light-foreground">
          {text.slice(i + 2, boldEnd)}
        </strong>
      );
      i = boldEnd + 2;
      continue;
    }

    // Italic — single * or _ . Require non-space on both sides so URLs
    // and word_with_underscores don't trip it.
    if (text[i] === "*" || text[i] === "_") {
      const delim = text[i];
      const end = text.indexOf(delim, i + 1);
      if (
        end > i + 1 &&
        text[i + 1] !== " " &&
        text[end - 1] !== " " &&
        !text.slice(i + 1, end).includes("\n")
      ) {
        flush();
        nodes.push(
          <em key={key++} className="italic">
            {text.slice(i + 1, end)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }

    buffer += text[i];
    i += 1;
  }

  flush();
  return nodes;
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
                      {renderInlineMarkdown(para)}
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
