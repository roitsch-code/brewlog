"use client";
import { useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import PhotoUpload from "@/components/ui/PhotoUpload";
import Chip from "@/components/ui/Chip";
import PlaceSearch from "@/components/ui/PlaceSearch";
import type { BagAnalysisResult } from "@/lib/claude/analyzeBag";

const PROCESSES = ["Natural", "Washed", "Honey", "Anaerobic", "Other"];
const ROAST_LEVELS = ["Light", "Medium-Light", "Medium", "Dark"];

export default function StepScan() {
  const { draft, setCoffee, setStep, isAnalyzing, setIsAnalyzing, clarificationMessages, addClarificationMessage, clearClarifications } = useFlowStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [clarificationIndex, setClarificationIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<BagAnalysisResult | null>(null);
  const [freeText, setFreeText] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  // Place fields (external mode)
  const [placeSearch, setPlaceSearch] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeManual, setPlaceManual] = useState("");

  // Manual coffee entry
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualRoaster, setManualRoaster] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualOrigin, setManualOrigin] = useState("");
  const [manualRegion, setManualRegion] = useState("");
  const [manualVariety, setManualVariety] = useState("");
  const [manualBagNotes, setManualBagNotes] = useState("");
  const [manualProcess, setManualProcess] = useState("");
  const [manualRoastLevel, setManualRoastLevel] = useState("");

  const handlePhoto = async (file: File) => {
    setIsAnalyzing(true);
    setScanError(null);
    clearClarifications();
    setShowManualForm(false);

    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("path", `scans/${Date.now()}-${file.name}`);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const { url: photoUrl, storagePath } = await uploadRes.json();

      const analyzeForm = new FormData();
      analyzeForm.append("image", file);
      const analyzeRes = await fetch("/api/analyze-bag", { method: "POST", body: analyzeForm });
      const result: BagAnalysisResult = await analyzeRes.json();

      setAnalysisResult(result);
      setCoffee({
        ...result.extracted,
        bagPhotoUrl: photoUrl,
        bagPhotoPath: storagePath,
        aiExtracted: true,
        tastingNotesFromBag: result.extracted.tastingNotesFromBag || [],
      });

      if (result.clarifications?.length > 0) {
        addClarificationMessage({ role: "assistant", text: result.clarifications[0], chips: getClarificationChips(result.clarifications[0]) });
        setClarificationIndex(0);
      }
    } catch (err) {
      console.error(err);
      setScanError("Could not analyze the photo. Please try again or enter details manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClarificationAnswer = async (answer: string) => {
    if (!analysisResult) return;
    setFreeText("");
    addClarificationMessage({ role: "user", text: answer });

    const question = analysisResult.clarifications[clarificationIndex];
    try {
      const res = await fetch("/api/analyze-bag/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCoffeeData: draft.coffee, question, answer }),
      });
      const { updated } = await res.json();
      setCoffee(updated);
    } catch {}

    const next = clarificationIndex + 1;
    if (analysisResult.clarifications[next]) {
      addClarificationMessage({ role: "assistant", text: analysisResult.clarifications[next], chips: getClarificationChips(analysisResult.clarifications[next]) });
      setClarificationIndex(next);
    }
  };

  const applyManualForm = () => {
    setCoffee({
      roaster: manualRoaster || undefined,
      name: manualName || undefined,
      origin: manualOrigin || undefined,
      region: manualRegion || undefined,
      variety: manualVariety || undefined,
      tastingNotesFromBag: manualBagNotes ? manualBagNotes.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      process: manualProcess || undefined,
      roastLevel: manualRoastLevel || undefined,
      aiExtracted: false,
    });
  };

  const isExternal = draft.mode === "external";
  const effectivePlaceName = placeSearch.trim() || placeManual.trim();

  const hasCoffeeInfo = !!(draft.coffee?.name || draft.coffee?.roaster || draft.coffee?.origin)
    || !!(showManualForm && (manualRoaster || manualName || manualOrigin));

  const canProceed = isExternal
    ? !!(effectivePlaceName || hasCoffeeInfo)
    : hasCoffeeInfo || !!(draft.coffee?.roaster || draft.coffee?.name || draft.coffee?.origin);

  const nextStep = () => {
    // Apply manual form data if visible
    if (showManualForm && (manualRoaster || manualName || manualOrigin)) {
      applyManualForm();
    }
    if (isExternal && effectivePlaceName) {
      useFlowStore.getState().setPlace({ name: effectivePlaceName, location: placeCity || undefined });
    }
    setStep(isExternal ? "log" : "context");
  };

  // For external mode, allow proceeding with just a place name even without coffee info
  const externalCanProceed = isExternal ? !!(effectivePlaceName) : canProceed;

  return (
    <FlowShell onNext={externalCanProceed || canProceed ? nextStep : undefined} nextDisabled={!(externalCanProceed || canProceed)} nextLabel={isExternal ? "Next →" : "Get Recommendation"}>
      <div className="px-5 py-4 flex flex-col gap-6">
        {/* Header */}
        <div>
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">{isExternal ? "Coffee Shop" : "Home Brew"}</p>
          <h1 className="font-display text-2xl text-white">
            {isExternal ? "What are you drinking today?" : "What are you brewing today?"}
          </h1>
        </div>

        {/* Place fields (external only) */}
        {isExternal && (
          <div className="space-y-3">
            <p className="text-brew-muted text-xs uppercase tracking-widest">Coffee Shop</p>

            {/* Search field */}
            <div>
              <p className="text-white/60 text-xs mb-1.5">Search</p>
              <PlaceSearch
                value={placeSearch}
                onChange={setPlaceSearch}
                onSelect={r => { setPlaceSearch(r.name); setPlaceCity(r.displayLine); }}
              />
              {placeCity && (
                <p className="text-brew-muted text-xs mt-1.5 px-1">{placeCity}</p>
              )}
            </div>

            {/* Manual name field */}
            <div>
              <p className="text-white/60 text-xs mb-1.5">Or enter manually</p>
              <input
                type="text"
                value={placeManual}
                onChange={e => setPlaceManual(e.target.value)}
                placeholder="e.g. Kaffeerösterei Burg"
                className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}

        {/* Photo Upload */}
        <PhotoUpload onFile={handlePhoto} preview={preview || undefined} loading={isAnalyzing} />

        {/* Scan error */}
        {scanError && !isAnalyzing && (
          <p className="text-red-400 text-sm text-center">{scanError}</p>
        )}

        {/* Extracted info */}
        {(draft.coffee?.name || draft.coffee?.roaster) && !isAnalyzing && (
          <div className="bg-brew-surface rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-brew-muted uppercase tracking-widest">Identified</span>
              <span className="text-xs text-brew-muted">Tap to correct</span>
            </div>
            {(draft.coffee.roaster !== undefined) && (
              <EditableRow
                label="Roaster"
                value={draft.coffee.roaster || ""}
                onChange={v => setCoffee({ roaster: v })}
              />
            )}
            {(draft.coffee.name !== undefined) && (
              <EditableRow
                label="Coffee"
                value={draft.coffee.name || ""}
                onChange={v => setCoffee({ name: v })}
              />
            )}
            {(draft.coffee.origin !== undefined) && (
              <EditableRow
                label="Origin"
                value={[draft.coffee.origin, draft.coffee.region].filter(Boolean).join(" · ")}
                onChange={v => {
                  const parts = v.split("·").map(s => s.trim());
                  setCoffee({ origin: parts[0] || "", region: parts[1] || undefined });
                }}
              />
            )}
            {draft.coffee.process && (
              <div>
                <p className="text-brew-muted text-xs mb-2">Process</p>
                <div className="flex flex-wrap gap-2">
                  {PROCESSES.map(p => (
                    <Chip key={p} label={p} selected={draft.coffee?.process === p} onClick={() => setCoffee({ process: p })} size="sm" />
                  ))}
                </div>
              </div>
            )}
            {draft.coffee.roastLevel && (
              <div>
                <p className="text-brew-muted text-xs mb-2">Roast Level</p>
                <div className="flex flex-wrap gap-2">
                  {ROAST_LEVELS.map(r => (
                    <Chip key={r} label={r} selected={draft.coffee?.roastLevel === r} onClick={() => setCoffee({ roastLevel: r })} size="sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clarification chat */}
        {clarificationMessages.length > 0 && (
          <div className="space-y-3">
            {clarificationMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                {msg.role === "assistant" ? (
                  <div className="max-w-[80%]">
                    <div className="bg-brew-surface rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-white text-sm">{msg.text}</p>
                    </div>
                    {msg.chips && i === clarificationMessages.length - 1 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {msg.chips.map(chip => (
                            <button
                              key={chip}
                              onClick={() => handleClarificationAnswer(chip)}
                              className="px-3 py-1.5 rounded-full border border-brew-border text-white/60 text-sm active:scale-95 transition-all"
                            >
                              {chip}
                            </button>
                          ))}
                          <button
                            onClick={() => handleClarificationAnswer("Not sure")}
                            className="px-3 py-1.5 rounded-full border border-brew-border text-brew-muted text-sm active:scale-95 transition-all"
                          >
                            Not sure
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={freeText}
                            onChange={e => setFreeText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && freeText.trim() && handleClarificationAnswer(freeText.trim())}
                            placeholder="Or type your answer..."
                            className="flex-1 bg-brew-surface border border-brew-border rounded-2xl px-3 py-2 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                          />
                          {freeText.trim() && (
                            <button
                              onClick={() => handleClarificationAnswer(freeText.trim())}
                              className="px-3 py-2 rounded-xl bg-brew-accent text-brew-bg text-sm font-medium active:scale-95 transition-all"
                            >
                              ↵
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-brew-accent/20 border border-brew-accent/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[60%]">
                    <p className="text-white text-sm">{msg.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Manual coffee entry toggle */}
        {!draft.coffee?.name && !draft.coffee?.roaster && !isAnalyzing && (
          <div>
            {!showManualForm ? (
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="w-full text-brew-muted text-sm text-center hover:text-white transition-colors"
              >
                Enter coffee details manually →
              </button>
            ) : (
              <div className="bg-brew-surface rounded-2xl p-4 space-y-4">
                <p className="text-brew-muted text-xs uppercase tracking-widest">Coffee Details</p>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={manualRoaster}
                    onChange={e => setManualRoaster(e.target.value)}
                    placeholder="Roaster"
                    className="w-full bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                  />
                  <input
                    type="text"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="Coffee name"
                    className="w-full bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                  />
                  <input
                    type="text"
                    value={manualOrigin}
                    onChange={e => setManualOrigin(e.target.value)}
                    placeholder="Origin (e.g. Ethiopia)"
                    className="w-full bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                  />
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={manualRegion}
                      onChange={e => setManualRegion(e.target.value)}
                      placeholder="Region"
                      className="flex-1 min-w-0 bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                    />
                    <input
                      type="text"
                      value={manualVariety}
                      onChange={e => setManualVariety(e.target.value)}
                      placeholder="Variety"
                      className="flex-1 min-w-0 bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                    />
                  </div>
                  <input
                    type="text"
                    value={manualBagNotes}
                    onChange={e => setManualBagNotes(e.target.value)}
                    placeholder="Tasting notes from bag (comma separated)"
                    className="w-full bg-brew-elevated border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <p className="text-brew-muted text-xs mb-2">Process</p>
                  <div className="flex flex-wrap gap-2">
                    {PROCESSES.map(p => (
                      <Chip key={p} label={p} selected={manualProcess === p} onClick={() => setManualProcess(p)} size="sm" />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-brew-muted text-xs mb-2">Roast Level</p>
                  <div className="flex flex-wrap gap-2">
                    {ROAST_LEVELS.map(r => (
                      <Chip key={r} label={r} selected={manualRoastLevel === r} onClick={() => setManualRoastLevel(r)} size="sm" />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-brew-muted text-xs hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </FlowShell>
  );
}

function EditableRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  const commit = () => {
    setEditing(false);
    if (local.trim() !== value) onChange(local.trim());
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-brew-muted text-xs">{label}</span>
        <input
          autoFocus
          type="text"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          className="w-full bg-brew-elevated border border-white/30 rounded-2xl px-3 py-2 text-white text-base focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setLocal(value); setEditing(true); }}
      className="w-full flex items-baseline justify-between gap-4 group text-left"
    >
      <span className="text-brew-muted text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right group-active:text-brew-accent transition-colors underline underline-offset-2 decoration-white/20">
        {value || <span className="text-brew-muted italic">tap to add</span>}
      </span>
    </button>
  );
}

function getClarificationChips(question: string): string[] {
  const lower = question.toLowerCase();
  if (lower.includes("yirgacheffe") || lower.includes("guji") || lower.includes("sidama")) {
    return ["Yirgacheffe", "Guji", "Sidama", "Harrar"];
  }
  if (lower.includes("washed") || lower.includes("natural") || lower.includes("honey")) {
    return ["Natural", "Washed", "Honey"];
  }
  if (lower.includes("week") || lower.includes("month") || lower.includes("bought")) {
    return ["This week", "2–4 weeks ago", "1–2 months ago"];
  }
  return [];
}
