"use client";
import React, { useState, useEffect, useRef } from "react";
import TopMenu from "@/components/layout/TopMenu";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
}

interface InsightItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  tags: string[];
  savedAt: string;
}

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  type: "article" | "video" | "instagram" | "podcast" | "research" | "social";
  source: string;
  savedAt: string;
}

interface CoffeeAlert {
  id: string;
  roaster: string;
  coffeeName: string;
  origin: string;
  process?: string;
  score: number;
  summary: string;
  url?: string;
  alertedAt: string;
  read: boolean;
}

// ── Fallback starter questions (shown before API responds) ─────────────────

const DEFAULT_STARTER_QUESTIONS = [
  "What makes Kenyan AA so distinctive?",
  "Explain the 4:6 method",
  "How does terroir affect taste?",
  "Best temp for light roasts?",
  "Natural vs Washed: key differences?",
  "Why does grind distribution matter?",
];

// ── Main page ──────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<"ask" | "insights">("ask");

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Header — atmospheric */}
      <div
        className="relative px-5 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
      >
        {/* Warm radial glow from top-left */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 140% at 10% 0%, rgba(240,237,232,0.07) 0%, transparent 60%)" }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-white leading-none mb-2">Explore</h1>
            <p className="text-white/25 text-xs uppercase pl-1" style={{ letterSpacing: "0.18em" }}>
              Origins · Extraction · Science · Championships
            </p>
          </div>
          <TopMenu />
        </div>
      </div>

      {/* Tabs — underline style */}
      <div className="flex border-b border-brew-border/40 px-5 mt-1">
        {(["ask", "insights"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? "border-white text-white"
                : "border-transparent text-white/30"
            }`}
          >
            {tab === "ask" ? "Ask" : "Insights"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "ask" ? <AskTab /> : <InsightsTab />}
      </div>
    </div>
  );
}

// ── Ask Tab ────────────────────────────────────────────────────────────────

function AskTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starterQuestions, setStarterQuestions] = useState<string[]>(DEFAULT_STARTER_QUESTIONS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/questions")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.items) && data.items.length > 0) {
          setStarterQuestions(data.items);
        }
      })
      .catch(() => {/* keep defaults */});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json() as { reply: string; sources?: { title: string; url: string }[] };

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        sources: data.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't get a response right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <>
      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{ paddingBottom: "8rem" }}
      >
        {isEmpty ? (
          <div className="flex flex-col gap-5 mt-4">
            {/* Atmospheric intro */}
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="relative">
                {/* Glow halo behind the bean */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, rgba(240,237,232,0.12) 0%, transparent 70%)",
                    transform: "scale(2.5)",
                  }}
                />
                <CoffeeBeanGlow size={72} />
              </div>
              <p className="text-white/30 text-xs text-center leading-relaxed max-w-[200px]">
                Ask anything — methods, origins, science, championships, or your next brew.
              </p>
            </div>
            {/* Starter questions — 2-column grid */}
            <div>
              <p className="text-brew-muted text-xs uppercase tracking-widest mb-3">Start with a question</p>
              <div className="grid grid-cols-2 gap-2">
                {starterQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-left bg-brew-surface border border-brew-border/60 rounded-2xl px-3 py-3 text-white/55 text-xs leading-snug active:scale-95 transition-all hover:border-white/20 hover:text-white/80"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icons/BrewLog.png"
                      alt=""
                      aria-hidden="true"
                      width={20}
                      height={24}
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5" style={{ maxWidth: msg.role === "user" ? "80%" : "85%" }}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-brew-elevated text-white"
                        : "bg-brew-surface border border-brew-border text-white"
                    }`}
                  >
                    <MessageContent content={msg.content} />
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {msg.sources.map((s, j) => (
                        <a
                          key={j}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/40 underline underline-offset-2"
                        >
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/BrewLog.png"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={24}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-3">
                  <CoffeeBeanGlow size={24} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area — gradient fade instead of hard border */}
      <div className="fixed bottom-0 left-0 right-0">
        {/* Soft fade from transparent to page bg */}
        <div
          className="h-8 pointer-events-none"
          style={{ background: "linear-gradient(to top, #0A0A0A 0%, transparent 100%)" }}
        />
        <div
          className="px-4 bg-brew-bg"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)", paddingTop: "0.5rem" }}
        >
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about coffee..."
            rows={1}
            className="flex-1 text-base bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30 transition-colors"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-30"
          >
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7 7 7-7 7" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

// Renders markdown: **bold**, *italic*, bullet lists, line breaks
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith("**")) {
      parts.push(<strong key={key++} className="text-white font-semibold">{match[2]}</strong>);
    } else {
      parts.push(<em key={key++} className="italic">{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines (add spacing via gap instead)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Bullet list item
    if (/^[-•]\s/.test(line.trim())) {
      const bullets: React.ReactNode[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) {
        bullets.push(
          <li key={i} className="leading-snug">
            {renderInline(lines[i].trim().replace(/^[-•]\s/, ""))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-outside pl-4 flex flex-col gap-1 my-1">
          {bullets}
        </ul>
      );
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <p key={i} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="flex flex-col gap-2 text-sm">{nodes}</div>;
}

// ── Insights Tab ───────────────────────────────────────────────────────────

function InsightsTab() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [alerts, setAlerts] = useState<CoffeeAlert[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/insights", { signal: controller.signal }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch("/api/alerts",   { signal: controller.signal }).then(r => r.ok ? r.json() : { alerts: [] }).catch(() => ({ alerts: [] })),
      fetch("/api/news",     { signal: controller.signal }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ]).then(([insightData, alertData, newsData]) => {
      setInsights(Array.isArray(insightData?.items) ? insightData.items : []);
      setAlerts(Array.isArray(alertData?.alerts) ? alertData.alerts : []);
      setNews(Array.isArray(newsData?.items) ? newsData.items : []);
    }).finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const unreadAlerts = alerts.filter(a => !a.read);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><CoffeeBeanGlow size={48} /></div>;
  }

  const hasContent = news.length > 0 || unreadAlerts.length > 0 || insights.length > 0;

  return (
    <div
      className="flex-1 overflow-y-auto flex flex-col gap-0"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      {/* ── News Ticker ─────────────────────────────────────── */}
      {news.length > 0 && (
        <div className="pt-4 pb-2">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-3 px-5">
            Coffee feed
          </p>
          {/* Horizontal scroll — no scrollbar */}
          <div
            className="flex gap-3 overflow-x-auto"
            style={{ paddingLeft: "1.25rem", paddingRight: "1.25rem", scrollbarWidth: "none" }}
          >
            {news.map(item => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* ── Coffee Alerts ────────────────────────────────────── */}
      {unreadAlerts.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-3">
            New coffees spotted
          </p>
          <div className="flex flex-col gap-3">
            {unreadAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ── Research Insights ────────────────────────────────── */}
      <div className="px-5 pt-4">
        {(news.length > 0 || unreadAlerts.length > 0) && (
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-3">
            Research insights
          </p>
        )}
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <CoffeeBeanGlow size={48} />
            <div>
              <p className="text-white/60 text-sm">No content yet</p>
              <p className="text-white/30 text-xs mt-1">Research runs every Monday</p>
            </div>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">No research insights yet — check back Monday</p>
        ) : (
          <div className="flex flex-col gap-3">
            {insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── News type helpers ────────────────────────────────────────────────────────

function newsTypeIcon(type: NewsItem["type"]): string {
  switch (type) {
    case "video":     return "▶";
    case "instagram": return "◈";
    case "podcast":   return "◉";
    case "research":  return "◆";
    case "social":    return "◇";
    default:          return "◎"; // article
  }
}

function newsTypeLabel(type: NewsItem["type"]): string {
  switch (type) {
    case "video":     return "Video";
    case "instagram": return "Instagram";
    case "podcast":   return "Podcast";
    case "research":  return "Research";
    case "social":    return "Social";
    default:          return "Article";
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  const date = new Date(item.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 w-52 bg-brew-surface border border-brew-border rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform"
    >
      {/* Type badge + date */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">{newsTypeIcon(item.type)}</span>
          <span className="text-brew-muted text-xs uppercase tracking-widest">{newsTypeLabel(item.type)}</span>
        </span>
        <span className="text-white/20 text-xs">{date}</span>
      </div>

      {/* Title — 2 lines max */}
      <p className="text-white text-sm font-medium leading-snug line-clamp-2">{item.title}</p>

      {/* Source + link arrow */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-white/40 text-xs truncate max-w-[80%]">{item.source}</span>
        <span className="text-white/30 text-xs">→</span>
      </div>
    </a>
  );
}

function InsightCard({ insight }: { insight: InsightItem }) {
  const date = new Date(insight.savedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white font-medium text-sm leading-snug flex-1">
          {insight.title}
        </p>
        <span className="text-white/30 text-xs shrink-0">{date}</span>
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{insight.summary}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white/40 text-xs bg-brew-elevated rounded-full px-2.5 py-0.5">
          {insight.source}
        </span>
        {insight.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-white/30 text-xs">
            #{tag}
          </span>
        ))}
        {insight.url && (
          <a
            href={insight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 text-xs underline underline-offset-2 ml-auto"
          >
            Read more
          </a>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: CoffeeAlert }) {
  return (
    <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-white font-medium text-sm leading-snug">
            {alert.roaster} — {alert.coffeeName}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {alert.origin}
            {alert.process ? ` · ${alert.process}` : ""}
          </p>
        </div>
        <ScoreBadge score={alert.score} />
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{alert.summary}</p>
      {alert.url && (
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/50 underline underline-offset-2 self-start"
        >
          View
        </a>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const label =
    score >= 85 ? "Great" : score >= 65 ? "Good" : score >= 45 ? "Maybe" : "Pass";
  return (
    <div className="shrink-0 flex flex-col items-center gap-0.5">
      <span className="font-mono-num text-white text-sm font-medium">{score}</span>
      <span className="text-white/30 text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
