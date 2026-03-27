"use client";
import { useState } from "react";
import PhotoUpload from "@/components/ui/PhotoUpload";
import TopMenu from "@/components/layout/TopMenu";
import type { MatchResult } from "@/app/api/match/route";

type InputMode = "photo" | "url" | "manual";

const PROCESSES = ["Natural", "Washed", "Honey", "Anaerobic", "Other"];
const ROAST_LEVELS = ["Light", "Medium-Light", "Medium", "Dark"];

const MATCH_LABEL: Record<MatchResult["matchLevel"], string> = {
  great: "Great match",
  good:  "Good match",
  maybe: "Maybe",
  avoid: "Not your cup",
};

export default function MatchPage() {
  const [mode, setMode] = useState<InputMode>("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);

  // Manual form state
  const [name, setName] = useState("");
  const [roaster, setRoaster] = useState("");
  const [origin, setOrigin] = useState("");
  const [region, setRegion] = useState("");
  const [variety, setVariety] = useState("");
  const [process, setProcess] = useState("");
  const [roastLevel, setRoastLevel] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [bagNotes, setBagNotes] = useState("");
  const [url, setUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const handlePhoto = (file: File) => {
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
  };

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {};

      if (mode === "photo" && photoFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
        body.imageBase64 = base64;
        body.mimeType = photoFile.type || "image/jpeg";
      } else if (mode === "url") {
        body.url = url;
      } else {
        body.coffee = {
          name, roaster, origin, region, variety,
          process, roastLevel,
          roastDate: roastDate || undefined,
          tastingNotes: bagNotes,
        };
      }

      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch {
      setResult({ matchLevel: "maybe", score: 0, headline: "Analysis failed", reasons: [], expect: "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze =
    (mode === "photo" && !!photoFile) ||
    (mode === "url" && url.trim().length > 5) ||
    (mode === "manual" && (name.trim() || roaster.trim() || origin.trim()));

  // Score ring: single cream stroke, fill = score
  const circumference = 94.2;
  const scoreDash = result ? (result.score / 100) * circumference : 0;

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <div>
          <h1 className="font-display text-2xl text-white">Match Finder</h1>
          <p className="text-brew-muted text-sm">Check a coffee against your taste profile</p>
        </div>
        <TopMenu />
      </div>

      <div className="px-5 flex flex-col gap-6 pb-10">
        {/* Mode selector */}
        <div className="flex gap-2 bg-brew-surface rounded-2xl p-1">
          {(["photo", "url", "manual"] as InputMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setResult(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${mode === m ? "bg-brew-elevated text-white" : "text-brew-muted"}`}
            >
              {m === "photo" ? "Photo" : m === "url" ? "Link" : "Manual"}
            </button>
          ))}
        </div>

        {/* Photo input */}
        {mode === "photo" && (
          <PhotoUpload onFile={handlePhoto} preview={preview || undefined} loading={false} />
        )}

        {/* URL input */}
        {mode === "url" && (
          <div>
            <p className="text-brew-muted text-xs mb-2">Paste a link to the coffee product page</p>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://fiveelephant.com/products/..."
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        {/* Manual input */}
        {mode === "manual" && (
          <div className="space-y-3">
            <input type="text" value={roaster} onChange={e => setRoaster(e.target.value)} placeholder="Roaster"
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Coffee name"
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />
            <input type="text" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Origin (e.g. Ethiopia)"
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />
            <div className="flex gap-3">
              <input type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="Region"
                className="flex-1 min-w-0 bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />
              <input type="text" value={variety} onChange={e => setVariety(e.target.value)} placeholder="Variety"
                className="flex-1 min-w-0 bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />
            </div>
            <input type="text" value={bagNotes} onChange={e => setBagNotes(e.target.value)} placeholder="Bag tasting notes (optional)"
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30" />

            {/* Roast date */}
            <div>
              <p className="text-brew-muted text-xs mb-2 uppercase tracking-widest">Roast date</p>
              <input
                type="date"
                value={roastDate}
                onChange={e => setRoastDate(e.target.value)}
                className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base focus:outline-none focus:border-white/30"
                style={{ colorScheme: "dark" }}
              />
            </div>

            <div>
              <p className="text-brew-muted text-xs mb-2 uppercase tracking-widest">Process</p>
              <div className="flex flex-wrap gap-2">
                {PROCESSES.map(p => (
                  <button key={p} type="button" onClick={() => setProcess(prev => prev === p ? "" : p)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${process === p ? "border-white/40 bg-white/10 text-white" : "border-brew-border text-brew-muted"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-brew-muted text-xs mb-2 uppercase tracking-widest">Roast level</p>
              <div className="flex flex-wrap gap-2">
                {ROAST_LEVELS.map(r => (
                  <button key={r} type="button" onClick={() => setRoastLevel(prev => prev === r ? "" : r)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${roastLevel === r ? "border-white/40 bg-white/10 text-white" : "border-brew-border text-brew-muted"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analyze button */}
        <button
          type="button"
          onClick={analyze}
          disabled={!canAnalyze || loading}
          className="w-full py-4 rounded-2xl bg-white text-black text-sm font-semibold disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {loading ? "Analysing…" : "Check this coffee"}
        </button>

        {/* Result card — no color coding, score ring communicates quality */}
        {result && (
          <div className="rounded-2xl border border-brew-border bg-brew-surface p-5 space-y-5">

            {/* Score + verdict */}
            <div className="flex items-center gap-5">
              {/* Ring: fill level = match quality, always cream */}
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#1E1E1E" strokeWidth="2.5" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    strokeWidth="2.5"
                    stroke="#F0EDE8"
                    strokeDasharray={`${scoreDash} ${circumference}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.6s ease" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-base font-bold text-white">
                  {result.score}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">
                  {MATCH_LABEL[result.matchLevel]}
                </p>
                <p className="font-display text-xl text-white leading-snug">{result.headline}</p>
              </div>
            </div>

            {/* Reasons */}
            {result.reasons.length > 0 && (
              <div className="space-y-2 pt-1">
                {result.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                    <p className="text-white/60 text-sm leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            )}

            {/* In the cup */}
            <div className="pt-3 border-t border-white/10">
              <p className="text-brew-muted text-xs uppercase tracking-widest mb-1.5">In the cup</p>
              <p className="text-white text-sm leading-relaxed">{result.expect}</p>
            </div>

            {/* Freshness */}
            {result.freshnessNote && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-brew-muted text-xs uppercase tracking-widest mb-1.5">Freshness</p>
                <p className="text-white/60 text-sm leading-relaxed">{result.freshnessNote}</p>
              </div>
            )}

            {/* Caution */}
            {result.caution && (
              <div className="pt-3 border-t border-white/10 flex items-start gap-2.5">
                <svg className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-white/40 text-sm leading-relaxed">{result.caution}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
