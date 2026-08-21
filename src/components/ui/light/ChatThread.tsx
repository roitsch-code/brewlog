"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Coffee as CoffeeIcon } from "lucide-react";
import type { NavAction } from "@/app/api/explore-agent/route";
import ActionPill from "@/components/ui/light/ActionPill";

/**
 * BTTS Chat Thread — specs/home.md §4 + §6.
 *
 * Visual distinction (the spec's "user chats, BTTS writes" anchor):
 *   - User content: right-aligned Glass bubble(s). When a message has
 *     a photo or coffee reference, those render as their own bubble
 *     above the text bubble (§4.2 stacked-bubble rule).
 *   - Agent content: left-aligned prose, no bubble. Inline Markdown
 *     bold + italic parsed so /api/explore-agent's `**Roaster — Name**`
 *     renders as actual bold.
 *
 * Below an agent response, up to three Action Pills (§6) render in a
 * horizontal flex row when the agent emitted suggest_navigation calls.
 *
 * §4.4 top-edge fade + §4.5 stick-to-bottom auto-scroll preserved from
 * PR2e.
 */

export interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  coffeeRef?: { id: string; roaster: string; name: string };
  actions?: NavAction[];
}

interface ChatThreadProps {
  messages: Message[];
  loading: boolean;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let buffer = "";
  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    const boldDelim = text.startsWith("**", i) ? "**" : text.startsWith("__", i) ? "__" : null;
    if (boldDelim) {
      const end = text.indexOf(boldDelim, i + 2);
      if (end > i + 2) {
        flush();
        nodes.push(
          <strong key={key++} className="font-semibold text-light-foreground">
            {text.slice(i + 2, end)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*" || text[i] === "_") {
      const delim = text[i];
      const end = text.indexOf(delim, i + 1);
      // Both delimiters must sit on a word boundary. Without this, the
      // underscores in "brew_again and coffee_library" pair up and italicise
      // everything between them — the model writes snake_case tool names
      // constantly, so this fired often.
      const openOk = i === 0 || /[^A-Za-z0-9]/.test(text[i - 1]);
      const closeOk = end === text.length - 1 || /[^A-Za-z0-9]/.test(text[end + 1]);
      if (
        end > i + 1 &&
        openOk &&
        closeOk &&
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

/**
 * Render one assistant message as blocks.
 *
 * Until now this component understood exactly two things, bold and italic, and
 * everything else fell through to literal text. So when the model answered a
 * comparison with a markdown table — which it does, because the system prompt
 * itself demonstrates one — the user read raw pipe characters: "| | |" and
 * "|---|---|" printed as prose. Tables and short lists are the two shapes a
 * chat about coffee actually reaches for, so they render properly now.
 */
function renderBlocks(content: string): ReactNode[] {
  return content.split(/\n\n+/).map((block, j) => {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);

    // ── Table: a header row, a |---|---| separator, then rows ──
    const isSeparator = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
    if (lines.length >= 2 && lines[0].includes("|") && isSeparator(lines[1])) {
      const cells = (l: string) =>
        l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = cells(lines[0]);
      const rows = lines.slice(2).map(cells);
      return (
        // Its own horizontal scroller: a wide table must never widen the page.
        // A finger drag stays inside it (see the overflow notes in CLAUDE.md).
        <div key={j} className="-mx-1 overflow-x-auto [overscroll-behavior-x:contain] px-1">
          <table className="w-full border-collapse font-chivo text-[13px] text-light-foreground">
            <thead>
              <tr>
                {header.map((h, k) => (
                  <th
                    key={k}
                    className="border-b border-light-foreground/20 px-2 py-1.5 text-left align-bottom font-medium"
                  >
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, k) => (
                <tr key={k}>
                  {row.map((c, l) => (
                    <td
                      key={l}
                      className="border-b border-light-foreground/10 px-2 py-1.5 align-top [overflow-wrap:anywhere]"
                    >
                      {renderInlineMarkdown(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // ── List: every line is a bullet, or every line is numbered ──
    const bullet = /^\s*[-*•]\s+(.*)$/;
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/;
    if (lines.length >= 1 && lines.every((l) => bullet.test(l))) {
      return (
        <ul key={j} className="ml-1 list-outside list-disc space-y-1 pl-4 font-chivo text-[15px] leading-[1.5] text-light-foreground marker:text-light-foreground/40">
          {lines.map((l, k) => (
            <li key={k} className="[overflow-wrap:anywhere]">{renderInlineMarkdown(l.replace(bullet, "$1"))}</li>
          ))}
        </ul>
      );
    }
    if (lines.length >= 1 && lines.every((l) => numbered.test(l))) {
      return (
        <ol key={j} className="ml-1 list-outside list-decimal space-y-1 pl-5 font-chivo text-[15px] leading-[1.5] text-light-foreground marker:text-light-foreground/40">
          {lines.map((l, k) => (
            <li key={k} className="[overflow-wrap:anywhere]">{renderInlineMarkdown(l.replace(numbered, "$2"))}</li>
          ))}
        </ol>
      );
    }

    return (
      <p
        key={j}
        className="whitespace-pre-wrap [overflow-wrap:anywhere] font-chivo text-[15px] font-normal leading-[1.5] text-light-foreground"
      >
        {renderInlineMarkdown(block)}
      </p>
    );
  });
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
      className="scroll-y-only h-full overflow-y-auto [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_80px)] [mask-image:linear-gradient(to_bottom,transparent_0,black_80px)]"
    >
      <div className="flex min-h-full flex-col justify-end">
        <div className="flex w-full flex-col gap-3 px-5 py-5">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-col items-end gap-2">
                {m.imageUrl && (
                  <div className="max-w-[80%] overflow-hidden rounded-2xl border border-light-foreground/25 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt="Attached"
                      className="block max-h-[280px] w-auto max-w-full object-cover"
                    />
                  </div>
                )}
                {m.coffeeRef && (
                  <div className="flex max-w-[80%] items-start gap-3 rounded-2xl border border-light-foreground/25 bg-light-card-default px-4 py-3 backdrop-blur-light-card backdrop-saturate-150">
                    <CoffeeIcon className="mt-0.5 h-5 w-5 shrink-0 text-light-foreground/80" strokeWidth={1.5} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 break-words font-chivo text-[13px] font-normal text-light-muted-foreground">
                        {m.coffeeRef.roaster}
                      </span>
                      <span className="break-words font-chivo text-[15px] font-medium text-light-foreground">
                        {m.coffeeRef.name}
                      </span>
                    </div>
                  </div>
                )}
                {m.content && (
                  <div className="max-w-[80%] min-w-0 rounded-2xl bg-light-card-default px-4 py-3 backdrop-blur-light-card backdrop-saturate-150">
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere] font-chivo text-[15px] font-normal text-light-foreground">
                      {m.content}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              (m.content || (m.actions && m.actions.length > 0)) && (
                <div key={i} className="max-w-[80%] space-y-3">
                  {m.content && renderBlocks(m.content)}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {m.actions.slice(0, 3).map((a, j) => (
                        <ActionPill key={j} action={a} />
                      ))}
                    </div>
                  )}
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
