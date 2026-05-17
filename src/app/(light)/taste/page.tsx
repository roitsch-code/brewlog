"use client";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import type { Session } from "@/lib/types/session";
import { SCA_CATEGORIES, flavorCategory } from "@/lib/constants/scaFlavorWheel";
import FlavorWheel from "@/components/ui/FlavorWheel";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";

interface TasteStats {
  radarData: { label: string; value: number }[];
  topFlavors: { name: string; count: number }[];
  bodyDist: Record<string, number>;
  acidityDist: Record<string, number>;
  topOrigins: { name: string; avg: number; count: number }[];
  topProcesses: { name: string; avg: number; count: number }[];
  topMethods: { name: string; avg: number; count: number }[];
  avgRating: number;
  ratingTrend: { label: string; avg: number }[];
  totalSessions: number;
}

function computeStats(sessions: Session[]): TasteStats {
  const rated = sessions.filter(s => s.result?.rating);
  const totalSessions = rated.length;

  const categoryCount: Record<string, number> = {};
  const flavorCount: Record<string, number> = {};

  rated.forEach(s => {
    const notes = s.result?.flavorNotes || [];
    notes.forEach(note => {
      flavorCount[note] = (flavorCount[note] || 0) + 1;
      const cat = flavorCategory(note);
      if (cat) categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
  });

  const maxCat = Math.max(1, ...Object.values(categoryCount));
  const radarData = SCA_CATEGORIES.map(cat => ({
    label: cat,
    value: Math.round(((categoryCount[cat] || 0) / maxCat) * 100),
  }));

  const topFlavors = Object.entries(flavorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const bodyDist: Record<string, number> = {};
  const acidityDist: Record<string, number> = {};
  rated.forEach(s => {
    if (s.result?.body) bodyDist[s.result.body] = (bodyDist[s.result.body] || 0) + 1;
    if (s.result?.acidity) acidityDist[s.result.acidity] = (acidityDist[s.result.acidity] || 0) + 1;
  });

  const originData: Record<string, { sum: number; count: number }> = {};
  const processData: Record<string, { sum: number; count: number }> = {};
  const methodData: Record<string, { sum: number; count: number }> = {};

  rated.forEach(s => {
    const r = s.result!.rating;
    if (s.coffee?.origin) {
      const k = s.coffee.origin;
      originData[k] = originData[k] || { sum: 0, count: 0 };
      originData[k].sum += r; originData[k].count += 1;
    }
    if (s.coffee?.process) {
      const k = s.coffee.process;
      processData[k] = processData[k] || { sum: 0, count: 0 };
      processData[k].sum += r; processData[k].count += 1;
    }
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    if (method) {
      methodData[method] = methodData[method] || { sum: 0, count: 0 };
      methodData[method].sum += r; methodData[method].count += 1;
    }
  });

  const toRanked = (d: Record<string, { sum: number; count: number }>) =>
    Object.entries(d)
      .filter(([, v]) => v.count >= 1)
      .map(([name, v]) => ({ name, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4);

  const topOrigins = toRanked(originData);
  const topProcesses = toRanked(processData);
  const topMethods = toRanked(methodData);

  const avgRating = totalSessions > 0
    ? Math.round((rated.reduce((sum, s) => sum + (s.result?.rating || 0), 0) / totalSessions) * 10) / 10
    : 0;

  const byMonth: Record<string, { sum: number; count: number }> = {};
  rated.forEach(s => {
    const d = (s as Session & { createdAtMs?: number }).createdAtMs
      ? new Date((s as Session & { createdAtMs?: number }).createdAtMs!)
      : new Date(s.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = byMonth[key] || { sum: 0, count: 0 };
    byMonth[key].sum += s.result!.rating;
    byMonth[key].count += 1;
  });
  const ratingTrend = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, v]) => ({
      label: new Date(key + "-01").toLocaleDateString("en", { month: "short", year: "2-digit" }),
      avg: Math.round((v.sum / v.count) * 10) / 10,
    }));

  return { radarData, topFlavors, bodyDist, acidityDist, topOrigins, topProcesses, topMethods, avgRating, ratingTrend, totalSessions };
}

export default function TastePage() {
  const [stats, setStats] = useState<TasteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{type: string; text: string; tag: string}>>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch("/api/sessions?limit=300", { cache: "no-store", signal: controller.signal })
      .then(r => r.json())
      .then((sessions: Session[]) => {
        const s = computeStats(Array.isArray(sessions) ? sessions : []);
        setStats(s);
        if (s.totalSessions >= 3) {
          setSummaryLoading(true);
          fetch("/api/taste-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(s),
          })
            .then(r => r.json())
            .then(d => { setSummary(d.summary ?? null); setSuggestions(d.suggestions ?? []); })
            .catch(() => {})
            .finally(() => setSummaryLoading(false));
        }
      })
      .catch(() => setStats(computeStats([])))
      .finally(() => { clearTimeout(timer); setLoading(false); });

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-full bg-transparent flex flex-col">
        <Header onMenu={() => setMenuOpen(true)} />
        <div className="flex-1 flex items-center justify-center">
          <CoffeeBeanGlow size={64} />
        </div>
        <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="min-h-full bg-transparent flex flex-col">
        <Header onMenu={() => setMenuOpen(true)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <svg className="w-12 h-12 text-light-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V21M7.5 9V21M12 6v15M16.5 10.5V21M21 7.5V21" />
          </svg>
          <p className="font-fraunces text-2xl text-light-foreground">No data yet</p>
          <p className="text-light-muted-foreground text-sm">Log and rate a few brews to see your taste profile.</p>
        </div>
        <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    );
  }

  const maxFlavor = stats.topFlavors[0]?.count || 1;
  const trendMax = Math.max(5, ...stats.ratingTrend.map(t => t.avg));

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      <Header onMenu={() => setMenuOpen(true)} />

      <div className="px-5 pb-12 flex flex-col gap-8">
        {/* Summary stat */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-mono-num text-4xl text-light-foreground font-medium">{stats.avgRating}</p>
            <p className="text-light-muted-foreground text-xs uppercase tracking-widest mt-1">Avg Rating</p>
          </div>
          <div className="w-px h-10 bg-light-foreground/15" />
          <div className="text-center">
            <p className="font-mono-num text-4xl text-light-foreground font-medium">{stats.totalSessions}</p>
            <p className="text-light-muted-foreground text-xs uppercase tracking-widest mt-1">Rated Brews</p>
          </div>
          <p className="text-light-muted-foreground/60 text-xs ml-auto self-end">All time</p>
        </div>

        {/* AI narrative summary */}
        {(summaryLoading || summary) && (
          <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-4">
            {summaryLoading && !summary ? (
              <div className="space-y-2">
                <div className="h-3 bg-light-foreground/10 rounded-full w-full animate-pulse" />
                <div className="h-3 bg-light-foreground/10 rounded-full w-5/6 animate-pulse" />
                <div className="h-3 bg-light-foreground/10 rounded-full w-4/6 animate-pulse" />
              </div>
            ) : (
              <p className="text-light-foreground/85 text-sm leading-relaxed">{summary}</p>
            )}
          </div>
        )}

        {/* Flavor Profile — SCA wheel with radar overlay */}
        <Section title="Flavor Profile">
          <div className="w-full">
            <FlavorWheel mode="profile" profileData={stats.radarData} size={320} />
          </div>
        </Section>

        {/* Top flavors */}
        {stats.topFlavors.length > 0 && (
          <Section title="Top Flavors">
            <div className="space-y-2">
              {stats.topFlavors.map(f => (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="text-light-foreground text-sm w-28 shrink-0 capitalize">{f.name}</span>
                  <div className="flex-1 h-1.5 bg-light-foreground/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-light-foreground rounded-full transition-all"
                      style={{ width: `${(f.count / maxFlavor) * 100}%` }}
                    />
                  </div>
                  <span className="text-light-muted-foreground text-xs w-5 text-right">{f.count}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Rating trend */}
        {stats.ratingTrend.length > 1 && (
          <Section title="Rating Over Time">
            <div className="flex items-end gap-2 h-24">
              {stats.ratingTrend.map(t => (
                <div key={t.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-light-muted-foreground text-xs">{t.avg}</span>
                  <div className="w-full bg-light-foreground/10 rounded-t-lg overflow-hidden" style={{ height: "60px" }}>
                    <div
                      className="w-full bg-light-foreground rounded-t-lg transition-all"
                      style={{ height: `${(t.avg / trendMax) * 60}px`, marginTop: `${60 - (t.avg / trendMax) * 60}px` }}
                    />
                  </div>
                  <span className="text-light-muted-foreground text-xs">{t.label}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Body + Acidity */}
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(stats.bodyDist).length > 0 && (
            <Section title="Body">
              <DistBar data={stats.bodyDist} total={stats.totalSessions} />
            </Section>
          )}
          {Object.keys(stats.acidityDist).length > 0 && (
            <Section title="Acidity">
              <DistBar data={stats.acidityDist} total={stats.totalSessions} />
            </Section>
          )}
        </div>

        {/* Top origins */}
        {stats.topOrigins.length > 0 && (
          <Section title="Best Origins">
            <RankedList items={stats.topOrigins} />
          </Section>
        )}

        {/* Top processes */}
        {stats.topProcesses.length > 0 && (
          <Section title="Best Processes">
            <RankedList items={stats.topProcesses} />
          </Section>
        )}

        {/* Top methods */}
        {stats.topMethods.length > 0 && (
          <Section title="Best Methods">
            <RankedList items={stats.topMethods} />
          </Section>
        )}

        {/* Explore Next */}
        {suggestions.length > 0 && (
          <Section title="Explore Next">
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-3">
                  <span className="text-light-foreground/80 text-xs font-medium uppercase tracking-wide bg-light-foreground/10 px-2 py-1 rounded-lg inline-block mb-2">{s.tag}</span>
                  <p className="text-light-foreground/80 text-sm leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="px-5 pb-4 flex items-start justify-between gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
      <div>
        <h1 className="font-fraunces text-3xl text-light-foreground leading-none">Taste Profile</h1>
        <p className="text-light-muted-foreground text-sm mt-1.5">What you love, over time</p>
      </div>
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150 active:scale-95 transition-transform"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-light-muted-foreground text-xs uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

function DistBar({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-light-foreground/85 capitalize">{k}</span>
            <span className="text-light-muted-foreground">{Math.round((v / total) * 100)}%</span>
          </div>
          <div className="h-1 bg-light-foreground/10 rounded-full overflow-hidden">
            <div className="h-full bg-light-foreground rounded-full" style={{ width: `${(v / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankedList({ items }: { items: { name: string; avg: number; count: number }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="font-mono-num text-light-muted-foreground text-xs w-4">{i + 1}</span>
          <span className="text-light-foreground text-sm flex-1 truncate">{item.name}</span>
          <span className="font-mono-num text-light-foreground text-sm font-medium">{item.avg}</span>
          <span className="text-light-muted-foreground/60 text-xs">×{item.count}</span>
        </div>
      ))}
    </div>
  );
}
