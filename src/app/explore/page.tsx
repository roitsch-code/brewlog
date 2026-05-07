"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import type { Session } from "@/lib/types/session";
import type { CafeSummary } from "@/lib/types/cafes";
import { ArrowUp, FlaskConical, Thermometer, RotateCcw, Globe, BookOpen, MapPin, Crosshair, User } from "lucide-react";
import type { NavAction } from "@/app/api/explore-agent/route";

const CafeMap = dynamic(() => import("@/components/cafes/CafeMap"), { ssr: false });

const SUGGESTION_ICONS = [FlaskConical, Thermometer, RotateCcw, Globe, BookOpen, FlaskConical];

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
  actions?: NavAction[];
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
  "What's the ideal V60 pour-over ratio for light roast Ethiopian beans?",
  "How does water temperature affect extraction for different roast levels?",
  "Why does bloom time matter and how long should I bloom for fresh beans?",
  "What are the key differences between Ethiopian and Kenyan single origins?",
];

// ── Main page ──────────────────────────────────────────────────────────────

type ExploreTab = "ask" | "insights" | "nearby";

const TAB_LABELS: Record<ExploreTab, string> = {
  ask: "Chat",
  insights: "Insights",
  nearby: "Nearby",
};

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ExploreTab = tabParam === "insights" || tabParam === "nearby" ? tabParam : "ask";
  const setActiveTab = (tab: ExploreTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "ask") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
  };

  return (
    <div className="min-h-full bg-brew-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div className="mb-4">
          <h1 className="font-display text-3xl text-white leading-none">Ask anything</h1>
          <p className="text-brew-muted text-sm mt-1">about coffee</p>
        </div>

        {/* Tabs — pill style */}
        <div className="flex gap-2">
          {(["ask", "insights", "nearby"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-5 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeTab === tab ? "var(--primary)" : "var(--card)",
                color: activeTab === tab ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: activeTab === tab ? "none" : "1px solid var(--border)",
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "ask" && <AskTab />}
        {activeTab === "insights" && <InsightsTab />}
        {activeTab === "nearby" && <NearbyTab focus={searchParams.get("focus") ?? undefined} />}
      </div>
    </div>
  );
}

// ── Ask Tab ────────────────────────────────────────────────────────────────

function AskTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [starterQuestions, setStarterQuestions] = useState<string[]>(DEFAULT_STARTER_QUESTIONS);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
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

    // Load recent sessions so explore can reference the user's actual brew history
    fetch("/api/sessions?limit=5", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Session[]) => { if (Array.isArray(data)) setRecentSessions(data); })
      .catch(() => {});
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
    setAgentStatus(null);

    const endpoint = "/api/explore-agent";

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "You're offline. Reconnect and try again." },
      ]);
      setLoading(false);
      setAgentStatus(null);
      return;
    }

    let receivedAnyDelta = false;
    let errorMessage = "Sorry, I couldn't get a response right now. Please try again.";

    try {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            recentSessions,
          }),
        });
      } catch {
        errorMessage = "Couldn't reach BrewLog. Check your connection.";
        throw new Error("network");
      }

      if (!res.ok) {
        errorMessage = `BrewLog is having trouble (server ${res.status}). Try again in a moment.`;
        throw new Error("server");
      }
      if (!res.body) {
        errorMessage = "No response from BrewLog. Try again.";
        throw new Error("nobody");
      }

      // Seed an empty assistant bubble we progressively fill
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let streamError: string | null = null;

      const applyEvent = (event: string, data: string) => {
        let payload: {
          text?: string;
          message?: string;
          sources?: { title: string; url: string }[];
          actions?: NavAction[];
          error?: string;
        };
        try {
          payload = JSON.parse(data);
        } catch {
          return; // Malformed event — skip
        }
        try {
          if (event === "retract") {
            // Claude started responding then decided to call a tool — clear the bubble
            setMessages(prev => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: "" };
              return copy;
            });
          } else if (event === "status" && payload.message) {
            setAgentStatus(payload.message);
          } else if (event === "delta" && payload.text) {
            receivedAnyDelta = true;
            setAgentStatus(null);
            setMessages(prev => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + payload.text };
              }
              return copy;
            });
          } else if (event === "done") {
            setAgentStatus(null);
            if (payload.sources || payload.actions) {
              setMessages(prev => {
                const copy = prev.slice();
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    ...(payload.sources ? { sources: payload.sources } : {}),
                    ...(payload.actions ? { actions: payload.actions } : {}),
                  };
                }
                return copy;
              });
            }
          } else if (event === "error") {
            streamError = payload.error ?? "Stream error";
          }
        } catch {
          // Defensive — never let render side-effects break the read loop
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });

        let boundary = carry.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = carry.slice(0, boundary);
          carry = carry.slice(boundary + 2);
          let eventName = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (dataLine) applyEvent(eventName, dataLine);
          boundary = carry.indexOf("\n\n");
        }

        if (streamError) {
          errorMessage = "The AI hit an error mid-response. Try again.";
          throw new Error(streamError);
        }
      }
    } catch {
      const dropped = receivedAnyDelta;
      setMessages(prev => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (dropped && last?.role === "assistant" && last.content) {
          copy[copy.length - 1] = {
            ...last,
            content: `${last.content}\n\n_(Connection dropped — try resending if the answer looks incomplete.)_`,
          };
          return copy;
        }
        if (last?.role === "assistant" && last.content === "") {
          copy[copy.length - 1] = { role: "assistant", content: errorMessage };
          return copy;
        }
        return [...prev, { role: "assistant", content: errorMessage }];
      });
    } finally {
      setLoading(false);
      setAgentStatus(null);
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
        className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
        style={{ paddingBottom: "1rem" }}
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
            {/* Starter questions — full-width list with icons */}
            <div>
              <p className="label-mono mb-3" style={{ color: "var(--muted-foreground)" }}>Suggested</p>
              <div className="flex flex-col gap-2">
                {starterQuestions.slice(0, 4).map((q, i) => {
                  const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="flex items-center gap-3 text-left rounded-2xl px-4 py-3 active:scale-[0.98] transition-all w-full"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <Icon size={16} style={{ color: "var(--primary)" }} className="shrink-0" />
                      <span className="text-sm leading-snug" style={{ color: "var(--foreground)" }}>{q}</span>
                    </button>
                  );
                })}
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
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {msg.actions.map((action, j) => (
                        <NavActionChip key={j} action={action} />
                      ))}
                    </div>
                  )}
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
                <div className="bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 flex flex-col gap-1.5">
                  <CoffeeBeanGlow size={24} />
                  {agentStatus && (
                    <p className="text-white/40 text-xs leading-snug">{agentStatus}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area — in normal flow, sits at bottom of flex column */}
      <div className="shrink-0">
        <div
          className="h-6 pointer-events-none"
          style={{ background: "linear-gradient(to top, #111111 0%, transparent 100%)" }}
        />
        <div
          className="px-4 bg-brew-bg"
          style={{ paddingBottom: "0.75rem", paddingTop: "0.25rem" }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about brewing, beans, gear..."
              rows={1}
              className="flex-1 text-sm resize-none focus:outline-none transition-colors"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "10px 16px",
                color: "var(--foreground)",
                minHeight: "44px",
                maxHeight: "120px",
                fontSize: "16px",
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-30"
              style={{ background: "var(--primary)" }}
            >
              <ArrowUp size={18} style={{ color: "var(--primary-foreground)" }} />
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

// ── Nav action chips ───────────────────────────────────────────────────────

function navActionToPath(action: NavAction): string {
  switch (action.destination) {
    case "coffee_library": return "/coffees";
    case "coffee_detail":  return action.id ? `/coffees/${action.id}` : "/coffees";
    case "cafe_map":       return "/explore?tab=nearby";
    case "cafe_detail":    return action.id
      ? `/explore?tab=nearby&focus=${encodeURIComponent(action.id)}`
      : "/explore?tab=nearby";
    case "taste_profile":  return "/taste";
    case "match":          return "/match";
    default:               return "/";
  }
}

function NavActionIcon({ destination }: { destination: NavAction["destination"] }) {
  const props = { size: 12, style: { color: "var(--primary)" } };
  switch (destination) {
    case "coffee_library":
    case "coffee_detail":  return <BookOpen {...props} />;
    case "cafe_map":
    case "cafe_detail":    return <MapPin {...props} />;
    case "taste_profile":  return <User {...props} />;
    case "match":          return <Crosshair {...props} />;
    default:               return <Globe {...props} />;
  }
}

function NavActionChip({ action }: { action: NavAction }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(navActionToPath(action))}
      title={action.reason}
      className="flex items-center gap-1.5 active:scale-95 transition-all"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "999px",
        padding: "5px 12px",
        color: "var(--muted-foreground)",
        fontSize: "11px",
        lineHeight: 1.4,
      }}
    >
      <NavActionIcon destination={action.destination} />
      {action.label}
    </button>
  );
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
      setInsights(Array.isArray(insightData?.items) ? insightData.items.slice(0, 10) : []);
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
      className="flex-1 overflow-y-auto flex flex-col gap-0 pb-8"
    >
      {/* ── News Ticker ─────────────────────────────────────── */}
      {news.length > 0 && (
        <div className="pt-4 pb-2">
          <p className="label-mono text-brew-muted mb-3 px-5">
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
          <p className="label-mono text-brew-muted mb-3">
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
          <p className="label-mono text-brew-muted mb-3">
            Research insights
          </p>
        )}
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <CoffeeBeanGlow size={48} />
            <div>
              <p className="text-white/60 text-sm">No content yet</p>
              <p className="text-white/30 text-xs mt-1">Research updates every 2 days</p>
            </div>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">No research insights yet — check back soon</p>
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

// ── Nearby Tab ─────────────────────────────────────────────────────────────

function NearbyTab({ focus }: { focus?: string }) {
  const router = useRouter();
  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then(r => r.json())
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><CoffeeBeanGlow size={48} /></div>;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top) + 140px)",
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <CafeMap
        cafes={cafes}
        onSelect={cafe => router.push(`/cafes/place/${encodeURIComponent(cafe.name)}`)}
        initialSearch={focus}
      />
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
