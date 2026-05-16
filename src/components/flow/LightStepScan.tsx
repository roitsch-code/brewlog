"use client";
import { useRef, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import PhotoUpload from "@/components/ui/PhotoUpload";
import Chip from "@/components/ui/light/Chip";
import type { BagAnalysisResult, RoasterPriorSummary } from "@/lib/claude/analyzeBag";
import type { Coffee as CoffeeLibEntry } from "@/lib/types/coffee";
import { Camera, PenLine, Link2, Coffee, ShoppingBag } from "lucide-react";

/**
 * Light System fork of /components/flow/StepScan.tsx.
 *
 * Surface-level swap of the 1396-line Dark file. Business logic is
 * byte-for-byte the same — same /api/analyze-bag call path, same
 * roaster prior pipeline (auto-generate + confirm-to-save), same
 * /api/analyze-bag/clarify Q&A loop, same /api/analyze-url scrape,
 * same manual-entry roaster Q&A, same library-match lookup, same
 * tasting-notes chip list, same RoastDateInput / EditableRow /
 * RoasterInput helpers.
 *
 * Surface mapping vs Dark:
 *   - var(--card)              → bg-light-card-default + backdrop-blur
 *   - var(--border)            → border-light-foreground/15
 *   - var(--foreground)        → text-light-foreground (warm anthracite)
 *   - var(--muted-foreground)  → text-light-muted-foreground
 *   - var(--primary)           → text-light-foreground (no peach in Light)
 *   - var(--primary-foreground)→ cream (hsl(36 55% 96%))
 *   - var(--secondary)         → bg-light-card-default
 *   - text-white               → text-light-foreground
 *   - text-brew-muted          → text-light-muted-foreground
 *   - bg-brew-surface          → bg-light-card-default + backdrop-blur
 *   - border-brew-border       → border-light-foreground/15
 *   - text-red-400 (errors)    → kept (semantic)
 *
 * Mounted only by /app/(light)/brew/preview at step "scan". Dark
 * StepScan keeps painting /brew/new until cut-over.
 */


type InputMethod = "photo" | "manual" | "link";
type ModeChoice = "home" | "external";

const SCAN_MODES: { id: ModeChoice; label: string; Icon: React.ElementType }[] = [
  { id: "home", label: "Brew at home", Icon: Coffee },
  { id: "external", label: "Coffee shop", Icon: ShoppingBag },
];

const PROCESSES = ["Natural", "Washed", "Honey", "Anaerobic", "Other"];
const ROAST_LEVELS = ["Light", "Medium-Light", "Medium", "Dark"];

type RoasterQAMessage = { role: "assistant" | "user"; text: string; chips?: string[] };
type RoasterQAState = { messages: RoasterQAMessage[]; step: number; location?: string };

const ROASTER_QA_LOCATION_CHIPS = ["Germany", "Netherlands", "UK", "USA", "Denmark", "Norway", "Greece", "Belgium", "Other"];
const ROASTER_QA_STYLE_CHIPS = ["Very light", "Light", "Light-medium", "Medium", "Varies"];

export default function LightStepScan() {
  const { draft, setCoffee, setMode, setStep, setFieldZones, isAnalyzing, setIsAnalyzing, clarificationMessages, addClarificationMessage, clearClarifications } = useFlowStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModeChoice | null>(null);
  const [clarificationIndex, setClarificationIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<BagAnalysisResult | null>(null);
  const [freeText, setFreeText] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  // Light-only — the Photo card triggers iOS's native picker directly
  // (Markus' feedback: skip the Camera/Library two-step UX from
  // PhotoUpload's empty state, jump straight to Fotomediathek / Foto
  // aufnehmen / Datei auswählen). Hidden <input type="file"> without
  // `capture` so iOS shows the full menu.
  const photoInputRef = useRef<HTMLInputElement>(null);

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
  const [manualRoastDate, setManualRoastDate] = useState<string | undefined>(undefined);

  // Roaster prior for manual entry (looked up client-side on blur)
  const [manualRoasterPrior, setManualRoasterPrior] = useState<RoasterPriorSummary | null>(null);

  // Link / URL analysis
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Add/edit roaster profile form
  const [showRoasterForm, setShowRoasterForm] = useState(false);

  // Auto-generating roaster profile after photo scan
  const [isGeneratingRoaster, setIsGeneratingRoaster] = useState(false);
  // AI-generated profile awaiting user confirmation before it's written to the library
  const [pendingRoasterSave, setPendingRoasterSave] = useState<{
    profile: RoasterPriorSummary;
    originalName: string;
  } | null>(null);
  const [isSavingRoaster, setIsSavingRoaster] = useState(false);

  // Roaster onboarding Q&A (manual entry only — photo scan auto-generates)
  const [roasterQA, setRoasterQA] = useState<RoasterQAState | null>(null);
  const [roasterQAFreeText, setRoasterQAFreeText] = useState("");

  // Existing roaster names for autocomplete
  const [existingRoasters, setExistingRoasters] = useState<string[]>([]);
  const loadRoasters = () => {
    if (existingRoasters.length > 0) return;
    fetch("/api/coffees?roasters=true", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((names: string[]) => setExistingRoasters(names))
      .catch(() => {});
  };

  // Library match — check if this coffee has been brewed before
  const [libraryMatch, setLibraryMatch] = useState<CoffeeLibEntry | null>(null);
  const checkLibraryMatch = (name?: string, roaster?: string) => {
    const n = name?.trim();
    const r = roaster?.trim();
    if (!n && !r) { setLibraryMatch(null); return; }
    const params = new URLSearchParams({ match: "true" });
    if (n) params.set("name", n);
    if (r) params.set("roaster", r);
    fetch(`/api/coffees?${params}`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then((match: CoffeeLibEntry | null) => setLibraryMatch(match ?? null))
      .catch(() => {});
  };

  const handlePhoto = async (file: File) => {
    setIsAnalyzing(true);
    setScanError(null);
    clearClarifications();
    setShowManualForm(false);
    setShowRoasterForm(false);

    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("path", `bags/${Date.now()}-${file.name}`);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = uploadRes.ok ? await uploadRes.json() : {};
      const photoUrl: string | undefined = uploadData.url || undefined;
      const storagePath: string | undefined = uploadData.storagePath || undefined;

      const analyzeForm = new FormData();
      analyzeForm.append("image", file);
      const analyzeRes = await fetch("/api/analyze-bag", { method: "POST", body: analyzeForm });
      const result: BagAnalysisResult = await analyzeRes.json();

      const cleanExtracted = Object.fromEntries(
        Object.entries(result.extracted).filter(([, v]) => v !== null && v !== undefined)
      ) as typeof result.extracted;

      setAnalysisResult(result);
      loadRoasters();
      setCoffee({
        ...cleanExtracted,
        bagPhotoUrl: photoUrl,
        bagPhotoPath: storagePath,
        aiExtracted: true,
        tastingNotesFromBag: result.extracted.tastingNotesFromBag ?? [],
      });
      // Generative Field v1.1 — capture the server-mapped composition
      // so LightFlowShell can paint the brew flow in this coffee's
      // colours. null is valid (= use Default).
      setFieldZones(result.fieldZones ?? null);
      checkLibraryMatch(result.extracted.name, result.extracted.roaster);

      // If roaster is unknown, auto-generate its profile immediately — no Q&A interruption
      if (result.extracted.roaster && (!result.roasterPrior || result.roasterPrior.confidence === "fallback")) {
        autoGenerateRoasterProfile(result.extracted.roaster, result);
      }

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

  const autoGenerateRoasterProfile = async (name: string, currentResult: BagAnalysisResult) => {
    setIsGeneratingRoaster(true);
    try {
      const res = await fetch("/api/roasters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const generated: RoasterPriorSummary = await res.json();
      if (!generated?.styleSummary) throw new Error("Invalid roaster profile");
      const profile: RoasterPriorSummary = { ...generated, confidence: "inferred" };
      // Show the profile to the user. Save requires explicit confirmation so the
      // library always reflects what you approved, not what the AI first guessed.
      setAnalysisResult({ ...currentResult, roasterPrior: profile });
      setPendingRoasterSave({ profile, originalName: name });
    } catch (err) {
      console.error("autoGenerateRoasterProfile error:", err);
    } finally {
      setIsGeneratingRoaster(false);
    }
  };

  const confirmSaveRoaster = async () => {
    if (!pendingRoasterSave) return;
    setIsSavingRoaster(true);
    try {
      const payload = {
        ...pendingRoasterSave.profile,
        confidence: "user" as const,
        originalName: pendingRoasterSave.originalName,
      };
      const res = await fetch("/api/roasters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      const saved: RoasterPriorSummary = { ...pendingRoasterSave.profile, confidence: "user" };
      if (analysisResult) setAnalysisResult({ ...analysisResult, roasterPrior: saved });
      else setManualRoasterPrior(saved);
      setPendingRoasterSave(null);
    } catch (err) {
      console.error("confirmSaveRoaster error:", err);
    } finally {
      setIsSavingRoaster(false);
    }
  };

  const dismissPendingRoaster = () => setPendingRoasterSave(null);

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
      const clean = Object.fromEntries(
        Object.entries(updated ?? {}).filter(([, v]) => v !== null && v !== undefined)
      ) as Parameters<typeof setCoffee>[0];
      setCoffee(clean);
    } catch {}

    const next = clarificationIndex + 1;
    if (analysisResult.clarifications[next]) {
      addClarificationMessage({ role: "assistant", text: analysisResult.clarifications[next], chips: getClarificationChips(analysisResult.clarifications[next]) });
      setClarificationIndex(next);
    }
  };

  const startRoasterQA = (name: string) => {
    setRoasterQA({
      messages: [{ role: "assistant", text: `I don't know ${name} yet. Where are they based?`, chips: ROASTER_QA_LOCATION_CHIPS }],
      step: 0,
    });
    setRoasterQAFreeText("");
  };

  const handleManualRoasterBlur = async () => {
    const name = manualRoaster.trim();
    if (!name) { setManualRoasterPrior(null); setRoasterQA(null); return; }
    if (roasterQA !== null || manualRoasterPrior?.name === name) return;
    try {
      const res = await fetch(`/api/roasters?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        setManualRoasterPrior(await res.json());
        setRoasterQA(null);
      } else if (res.status === 404) {
        setManualRoasterPrior(null);
        startRoasterQA(name);
      }
    } catch {}
  };

  const handleUrlAnalyze = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsAnalyzingUrl(true);
    setUrlError(null);
    clearClarifications();
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error || "Could not extract details from that page.");
        return;
      }
      const { extracted, roasterPrior } = data as {
        extracted: Record<string, unknown>;
        roasterPrior: RoasterPriorSummary | null;
      };
      const clean = Object.fromEntries(
        Object.entries(extracted).filter(([, v]) => v !== null && v !== undefined)
      ) as Parameters<typeof setCoffee>[0];
      setCoffee({ ...clean, aiExtracted: true });
      checkLibraryMatch(
        typeof extracted.name === "string" ? extracted.name : undefined,
        typeof extracted.roaster === "string" ? extracted.roaster : undefined
      );
      if (roasterPrior) {
        setManualRoasterPrior(roasterPrior);
      } else if (extracted.roaster && typeof extracted.roaster === "string") {
        startRoasterQA(extracted.roaster);
      }
    } catch {
      setUrlError("Network error — check your connection and try again.");
    } finally {
      setIsAnalyzingUrl(false);
    }
  };

  const handleRoasterQAAnswer = async (answer: string) => {
    if (!roasterQA) return;
    setRoasterQAFreeText("");
    const roasterName = (analysisResult ? draft.coffee?.roaster : manualRoaster) || draft.coffee?.roaster || manualRoaster;
    if (!roasterName) return;

    const withUser: RoasterQAMessage[] = [...roasterQA.messages, { role: "user", text: answer }];

    if (roasterQA.step === 0) {
      setRoasterQA({
        messages: [...withUser, { role: "assistant", text: "What's their roasting style?", chips: ROASTER_QA_STYLE_CHIPS }],
        step: 1,
        location: answer,
      });
    } else if (roasterQA.step === 1) {
      setRoasterQA({ ...roasterQA, messages: withUser, step: 2 });
      try {
        const genRes = await fetch("/api/roasters/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roasterName,
            region: roasterQA.location !== "Other" ? roasterQA.location : undefined,
            roastStyle: answer,
          }),
        });
        if (!genRes.ok) throw new Error("generation failed");
        const generated: RoasterPriorSummary = await genRes.json();
        const saved: RoasterPriorSummary = { ...generated, confidence: "user" };

        // Auto-save to Firestore — user explicitly confirmed the name + style through the Q&A
        fetch("/api/roasters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...saved, originalName: roasterName }),
        }).catch(() => {});

        if (analysisResult) {
          setAnalysisResult({ ...analysisResult, roasterPrior: saved });
        } else {
          setManualRoasterPrior(saved);
        }
      } catch {}
      setRoasterQA(null);
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
      roastDate: manualRoastDate || undefined,
      aiExtracted: false,
    });
  };

  const hasCoffeeInfo = !!(draft.coffee?.name || draft.coffee?.roaster || draft.coffee?.origin)
    || !!(showManualForm && (manualRoaster || manualName || manualOrigin));

  // Continue is gated on BOTH having coffee info AND picking a mode —
  // mode no longer defaults to "home" so the user has to make an
  // explicit choice (Markus' feedback: pre-selected Brew-at-home was
  // confusing).
  const canProceed = hasCoffeeInfo && selectedMode !== null;

  const nextStep = () => {
    if (!selectedMode) return;
    if (showManualForm && (manualRoaster || manualName || manualOrigin)) {
      applyManualForm();
    }
    setMode(selectedMode);
    if (selectedMode === "home") setStep("context");
    else setStep("mode");
  };

  // Roaster prior to show — from scan result or manual entry lookup
  const displayPrior: RoasterPriorSummary | null =
    analysisResult?.roasterPrior ?? manualRoasterPrior ?? null;

  return (
    <LightFlowShell onNext={canProceed ? nextStep : undefined} nextDisabled={!canProceed} nextLabel="Continue →">
      <div className="px-5 py-4 flex flex-col gap-5" style={{ paddingBottom: "2rem" }}>
        {/* Header */}
        <div>
          <p className="label-eyebrow mb-2" style={{ color: "var(--muted-foreground)" }}>New Session</p>
          <h1 className="font-fraunces text-2xl" style={{ color: "var(--foreground)" }}>What are you brewing today?</h1>
        </div>

        {/* Hidden file input for the Photo card — no `capture` attr so
            iOS opens its full native picker (Photo Library / Take
            Photo / Choose File). */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhoto(file);
            e.target.value = "";
          }}
        />

        {/* Input method cards */}
        <div className="flex flex-col gap-3">
          {/* Photo — primary large card. Tap triggers iOS picker
              directly; the inputMethod state stays in sync so the
              extracted-info expansion below renders after a successful
              file pick. Tapping again re-opens the picker (lets the
              user re-select before any file has been chosen). */}
          <button
            type="button"
            onClick={() => {
              setInputMethod("photo");
              setShowManualForm(false);
              photoInputRef.current?.click();
            }}
            className="w-full rounded-2xl border p-5 text-left transition-all active:scale-[0.98]"
            style={{
              background: inputMethod === "photo" ? "hsl(28 22% 84% / 0.7)" : "var(--card)",
              borderColor: inputMethod === "photo" ? "var(--primary)" : "var(--border)",
              boxShadow: inputMethod === "photo" ? "inset 0 2px 4px rgba(60,40,30,0.12)" : undefined,
            }}
          >
            <Camera size={24} style={{ color: "var(--primary)", marginBottom: "12px" }} />
            <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Take a photo or choose from library</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Claude reads the label and extracts all details</p>
          </button>

          {/* Photo upload + analysis (expanded when photo selected) */}
          {inputMethod === "photo" && (
            <div className="flex flex-col gap-4">
              {/* PhotoUpload's empty-state UI (Camera + Library buttons)
                  is hidden in the Light path — the Photo card above
                  triggers the iOS picker directly. We still render
                  PhotoUpload for the preview + Retake / Choose-other
                  buttons once a file is in flight. */}
              {(preview || isAnalyzing) && (
                <PhotoUpload onFile={handlePhoto} preview={preview || undefined} loading={isAnalyzing} />
              )}
              {scanError && !isAnalyzing && (
                <p className="text-red-400 text-sm text-center">{scanError}</p>
              )}
              {/* Extracted info */}
              {(draft.coffee?.name || draft.coffee?.roaster) && !isAnalyzing && (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-eyebrow" style={{ color: "var(--muted-foreground)" }}>Identified</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Tap to correct</span>
                  </div>
                  {draft.coffee.roaster !== undefined && (
                    <EditableRow label="Roaster" value={draft.coffee.roaster || ""} onChange={v => setCoffee({ roaster: v })} suggestions={existingRoasters} />
                  )}
                  {draft.coffee.name !== undefined && (
                    <EditableRow label="Coffee" value={draft.coffee.name || ""} onChange={v => setCoffee({ name: v })} />
                  )}
                  {draft.coffee.origin !== undefined && (
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
                      <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Process</p>
                      <div className="flex flex-wrap gap-2">
                        {PROCESSES.map(p => <Chip key={p} selected={draft.coffee?.process === p} onClick={() => setCoffee({ process: p })} size="sm">{p}</Chip>)}
                      </div>
                    </div>
                  )}
                  {draft.coffee.roastLevel && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Roast Level</p>
                      <div className="flex flex-wrap gap-2">
                        {ROAST_LEVELS.map(r => <Chip key={r} selected={draft.coffee?.roastLevel === r} onClick={() => setCoffee({ roastLevel: r })} size="sm">{r}</Chip>)}
                      </div>
                    </div>
                  )}
                  {draft.coffee.variety !== undefined && (
                    <EditableRow label="Variety" value={draft.coffee.variety || ""} onChange={v => setCoffee({ variety: v })} />
                  )}
                  {draft.coffee.fermentationStyle !== undefined && (
                    <EditableRow label="Fermentation" value={draft.coffee.fermentationStyle || ""} onChange={v => setCoffee({ fermentationStyle: v || undefined })} />
                  )}
                  {draft.coffee.cuppingScore !== undefined && (
                    <EditableRow
                      label="Cupping Score"
                      value={draft.coffee.cuppingScore ? String(draft.coffee.cuppingScore) : ""}
                      onChange={v => {
                        const n = parseFloat(v);
                        setCoffee({ cuppingScore: Number.isFinite(n) ? n : undefined });
                      }}
                    />
                  )}
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Roast Date</p>
                      {!draft.coffee?.roastDate && (
                        <span className="text-[10px]" style={{ color: "var(--primary)" }}>Improves bloom timing</span>
                      )}
                    </div>
                    <RoastDateInput
                      value={draft.coffee?.roastDate}
                      onChange={v => setCoffee({ roastDate: v })}
                    />
                  </div>
                  {(draft.coffee.tastingNotesFromBag !== undefined) && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Tasting Notes from Bag</p>
                      {(draft.coffee.tastingNotesFromBag?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {draft.coffee.tastingNotesFromBag!.map(n => (
                            <span key={n} className="px-2.5 py-1 rounded-full border text-xs capitalize" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{n}</span>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="e.g. Toffee, Nectarine, Plum"
                          className="w-full rounded-2xl px-3 py-2 text-base focus:outline-none"
                          style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                          onChange={e => setCoffee({ tastingNotesFromBag: e.target.value ? e.target.value.split(",").map(s => s.trim()).filter(Boolean) : [] })}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Roaster profile loading */}
              {!isAnalyzing && isGeneratingRoaster && (
                <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="label-eyebrow mb-1" style={{ color: "var(--muted-foreground)" }}>Roaster Intelligence</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Looking up roaster profile…</p>
                </div>
              )}
              {/* Roaster profile + edit form */}
              {!isAnalyzing && !isGeneratingRoaster && displayPrior && (
                <RoasterProfileCard prior={displayPrior} onEdit={() => setShowRoasterForm(v => !v)} />
              )}
              {/* AI-generated profile awaiting confirmation — save builds a permanent library entry */}
              {!isAnalyzing && !isGeneratingRoaster && pendingRoasterSave && !showRoasterForm && (
                <div
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{
                    background: "rgba(212,184,150,0.08)",
                    border: "1px solid rgba(212,184,150,0.25)",
                  }}
                >
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    AI-generated from web research. Save to your library so every future bag from this roaster uses the same profile.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmSaveRoaster}
                      disabled={isSavingRoaster}
                      className="flex-1 px-4 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all disabled:opacity-40"
                      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      {isSavingRoaster ? "Saving…" : "Save to library"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRoasterForm(true)}
                      className="px-4 py-2 rounded-xl text-sm border active:scale-95 transition-all"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      Edit first
                    </button>
                    <button
                      type="button"
                      onClick={dismissPendingRoaster}
                      className="px-4 py-2 rounded-xl text-sm active:scale-95 transition-all"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              {showRoasterForm && (
                <GenerateRoasterForm
                  roasterName={draft.coffee?.roaster || manualRoaster || ""}
                  existingPrior={displayPrior ?? undefined}
                  originalName={pendingRoasterSave?.originalName}
                  onSaved={saved => {
                    if (analysisResult) setAnalysisResult({ ...analysisResult, roasterPrior: saved });
                    else setManualRoasterPrior(saved);
                    setShowRoasterForm(false);
                    setPendingRoasterSave(null);
                  }}
                  onCancel={() => setShowRoasterForm(false)}
                />
              )}
              {/* Roaster onboarding Q&A */}
              {roasterQA && !isAnalyzing && (
                <div className="space-y-3">
                  {roasterQA.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                      {msg.role === "assistant" ? (
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--card)" }}>
                            <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                          </div>
                          {msg.chips && i === roasterQA.messages.length - 1 && roasterQA.step < 2 && (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {msg.chips.map(chip => (
                                  <button key={chip} onClick={() => handleRoasterQAAnswer(chip)}
                                    className="px-3 py-1.5 rounded-full border text-sm active:scale-95 transition-all"
                                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                                  >{chip}</button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input type="text" value={roasterQAFreeText}
                                  onChange={e => setRoasterQAFreeText(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && roasterQAFreeText.trim() && handleRoasterQAAnswer(roasterQAFreeText.trim())}
                                  placeholder="Or type your answer..."
                                  className="flex-1 rounded-2xl px-3 py-2 text-base focus:outline-none"
                                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                                />
                                {roasterQAFreeText.trim() && (
                                  <button onClick={() => handleRoasterQAAnswer(roasterQAFreeText.trim())}
                                    className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all"
                                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                                  >↵</button>
                                )}
                              </div>
                              <button onClick={() => setRoasterQA(null)} className="text-xs transition-colors"
                                style={{ color: "var(--muted-foreground)" }}>Skip for now</button>
                            </div>
                          )}
                          {i === roasterQA.messages.length - 1 && roasterQA.step === 2 && (
                            <div className="mt-2 px-4 py-2">
                              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Building profile…</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[60%]"
                          style={{ background: "rgba(212,184,150,0.15)", border: "1px solid rgba(212,184,150,0.25)" }}>
                          <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Clarification chat */}
              {clarificationMessages.length > 0 && (
                <div className="space-y-3">
                  {clarificationMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                      {msg.role === "assistant" ? (
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--card)" }}>
                            <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                          </div>
                          {msg.chips && i === clarificationMessages.length - 1 && (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {msg.chips.map(chip => (
                                  <button key={chip} onClick={() => handleClarificationAnswer(chip)}
                                    className="px-3 py-1.5 rounded-full border text-sm active:scale-95 transition-all"
                                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                                  >{chip}</button>
                                ))}
                                <button onClick={() => handleClarificationAnswer("Not sure")}
                                  className="px-3 py-1.5 rounded-full border text-sm active:scale-95 transition-all"
                                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                                >Not sure</button>
                              </div>
                              <div className="flex gap-2">
                                <input type="text" value={freeText}
                                  onChange={e => setFreeText(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && freeText.trim() && handleClarificationAnswer(freeText.trim())}
                                  placeholder="Or type your answer..."
                                  className="flex-1 rounded-2xl px-3 py-2 text-base focus:outline-none"
                                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                                />
                                {freeText.trim() && (
                                  <button onClick={() => handleClarificationAnswer(freeText.trim())}
                                    className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all"
                                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                                  >↵</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[60%]"
                          style={{ background: "rgba(212,184,150,0.15)", border: "1px solid rgba(212,184,150,0.25)" }}>
                          <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secondary: Manual + Link (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setInputMethod(inputMethod === "manual" ? null : "manual"); setShowManualForm(inputMethod !== "manual"); loadRoasters(); }}
              className="rounded-2xl border p-4 text-center flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: inputMethod === "manual" ? "hsl(28 22% 84% / 0.7)" : "var(--card)",
                borderColor: inputMethod === "manual" ? "var(--primary)" : "var(--border)",
                boxShadow: inputMethod === "manual" ? "inset 0 2px 4px rgba(60,40,30,0.12)" : undefined,
              }}
            >
              <PenLine size={20} style={{ color: "var(--primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Enter manually</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMethod(inputMethod === "link" ? null : "link")}
              className="rounded-2xl border p-4 text-center flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: inputMethod === "link" ? "hsl(28 22% 84% / 0.7)" : "var(--card)",
                borderColor: inputMethod === "link" ? "var(--primary)" : "var(--border)",
                boxShadow: inputMethod === "link" ? "inset 0 2px 4px rgba(60,40,30,0.12)" : undefined,
              }}
            >
              <Link2 size={20} style={{ color: "var(--primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Paste a link</span>
            </button>
          </div>

          {/* Manual form (expanded when manual selected) */}
          {inputMethod === "manual" && (
            <div className="rounded-2xl p-4 space-y-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="label-eyebrow" style={{ color: "var(--muted-foreground)" }}>Coffee Details</p>
              <div className="space-y-3">
                <RoasterInput
                  value={manualRoaster}
                  suggestions={existingRoasters}
                  onChange={v => { setManualRoaster(v); setManualRoasterPrior(null); }}
                  onBlur={handleManualRoasterBlur}
                />
                {manualRoasterPrior && <RoasterProfileCard prior={manualRoasterPrior} compact />}
                <input type="text" value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onBlur={() => checkLibraryMatch(manualName, manualRoaster)}
                  placeholder="Coffee name" className="w-full rounded-2xl px-4 py-3 text-base focus:outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <input type="text" value={manualOrigin} onChange={e => setManualOrigin(e.target.value)}
                  placeholder="Origin (e.g. Ethiopia)" className="w-full rounded-2xl px-4 py-3 text-base focus:outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <div className="flex gap-3">
                  <input type="text" value={manualRegion} onChange={e => setManualRegion(e.target.value)}
                    placeholder="Region" className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-base focus:outline-none"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <input type="text" value={manualVariety} onChange={e => setManualVariety(e.target.value)}
                    placeholder="Variety" className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-base focus:outline-none"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <input type="text" value={manualBagNotes} onChange={e => setManualBagNotes(e.target.value)}
                  placeholder="Tasting notes from bag (comma separated)" className="w-full rounded-2xl px-4 py-3 text-base focus:outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Process</p>
                <div className="flex flex-wrap gap-2">
                  {PROCESSES.map(p => <Chip key={p} selected={manualProcess === p} onClick={() => setManualProcess(p)} size="sm">{p}</Chip>)}
                </div>
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Roast Level</p>
                <div className="flex flex-wrap gap-2">
                  {ROAST_LEVELS.map(r => <Chip key={r} selected={manualRoastLevel === r} onClick={() => setManualRoastLevel(r)} size="sm">{r}</Chip>)}
                </div>
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Roast Date</p>
                <RoastDateInput value={manualRoastDate} onChange={setManualRoastDate} />
              </div>
            </div>
          )}

          {/* Link paste (expanded when link selected) */}
          {inputMethod === "link" && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="label-eyebrow" style={{ color: "var(--muted-foreground)" }}>Paste a product URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setUrlError(null); }}
                  onKeyDown={e => e.key === "Enter" && urlInput.trim() && handleUrlAnalyze()}
                  placeholder="https://..."
                  className="flex-1 rounded-2xl px-4 py-3 text-base focus:outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: "16px" }}
                />
                <button
                  type="button"
                  onClick={handleUrlAnalyze}
                  disabled={!urlInput.trim() || isAnalyzingUrl}
                  className="px-4 py-3 rounded-2xl text-sm font-medium active:scale-95 transition-all disabled:opacity-40"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {isAnalyzingUrl ? "…" : "Scan"}
                </button>
              </div>
              {urlError && (
                <p className="text-xs" style={{ color: "var(--color-error-foreground)" }}>{urlError}</p>
              )}
              {/* Show extracted info after URL scan */}
              {(draft.coffee?.name || draft.coffee?.roaster) && !isAnalyzingUrl && inputMethod === "link" && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
                  <p className="label-eyebrow" style={{ color: "var(--muted-foreground)" }}>Extracted</p>
                  {draft.coffee.roaster && <p className="text-sm" style={{ color: "var(--foreground)" }}>{draft.coffee.roaster}</p>}
                  {draft.coffee.name && <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{draft.coffee.name}</p>}
                  {draft.coffee.origin && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{draft.coffee.origin}</p>}
                </div>
              )}
              {/* Roaster Q&A after URL scan */}
              {roasterQA && !isAnalyzingUrl && (
                <div className="space-y-3">
                  {roasterQA.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                      {msg.role === "assistant" ? (
                        <div className="max-w-[85%]">
                          <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--secondary)" }}>
                            <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                          </div>
                          {msg.chips && i === roasterQA.messages.length - 1 && roasterQA.step < 2 && (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {msg.chips.map(chip => (
                                  <button key={chip} onClick={() => handleRoasterQAAnswer(chip)}
                                    className="px-3 py-1.5 rounded-full border text-sm active:scale-95 transition-all"
                                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                                  >{chip}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[60%]"
                          style={{ background: "rgba(212,184,150,0.15)", border: "1px solid rgba(212,184,150,0.25)" }}>
                          <p className="text-sm" style={{ color: "var(--foreground)" }}>{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Library match notice */}
        {libraryMatch && (
          <a
            href={`/coffees/${libraryMatch.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all active:scale-[0.98]"
            style={{ background: "rgba(212,184,150,0.08)", borderColor: "rgba(212,184,150,0.25)" }}
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "var(--primary)" }}>You&apos;ve had this before</p>
              <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                {libraryMatch.name}
                {libraryMatch.avgRating != null ? ` · ${libraryMatch.avgRating.toFixed(1)}★` : ""}
                {libraryMatch.sessionCount ? ` · ${libraryMatch.sessionCount} brew${libraryMatch.sessionCount !== 1 ? "s" : ""}` : ""}
              </p>
              {libraryMatch.personalNotes && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>&ldquo;{libraryMatch.personalNotes}&rdquo;</p>
              )}
            </div>
            <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>Library →</span>
          </a>
        )}

        {/* THEN CHOOSE */}
        <div>
          <p className="label-eyebrow mb-3" style={{ color: "var(--muted-foreground)" }}>Then Choose</p>
          <div className="flex gap-2">
            {SCAN_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 transition-all active:scale-[0.98]"
                style={{
                  background: selectedMode === m.id ? "hsl(28 22% 84% / 0.7)" : "var(--card)",
                  borderColor: selectedMode === m.id ? "var(--primary)" : "var(--border)",
                  boxShadow: selectedMode === m.id ? "inset 0 2px 4px rgba(60,40,30,0.12)" : undefined,
                }}
              >
                <m.Icon size={20} style={{ color: selectedMode === m.id ? "var(--primary)" : "var(--muted-foreground)" }} />
                <span className="text-xs font-medium text-center leading-tight"
                  style={{ color: selectedMode === m.id ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </LightFlowShell>
  );
}

// ── Roaster Profile Card ──────────────────────────────────────────────────

function RoasterProfileCard({
  prior,
  compact = false,
  onEdit,
}: {
  prior: RoasterPriorSummary;
  compact?: boolean;
  onEdit?: () => void;
}) {
  const confidenceLabel =
    prior.confidence === "user"
      ? "Your profile"
      : prior.confidence === "curated"
      ? "Curated"
      : prior.confidence === "inferred"
      ? "Inferred"
      : "Estimate";

  const confidenceClass =
    prior.confidence === "user"
      ? "text-emerald-600 border-emerald-600/30"
      : prior.confidence === "curated"
      ? "text-light-foreground border-light-foreground/30"
      : "text-light-foreground/40 border-white/15";

  const tempLabel =
    prior.tempBias === "high"
      ? "High (96–99°C)"
      : prior.tempBias === "low"
      ? "Low (88–93°C)"
      : "Standard (93–96°C)";

  const ratioLabel =
    prior.ratioBias === "lean"
      ? "Lean (1:16+)"
      : prior.ratioBias === "rich"
      ? "Rich (1:14–)"
      : "Standard (1:15)";

  return (
    <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-light-muted-foreground text-xs uppercase tracking-widest mb-1">
            Roaster Intelligence
          </p>
          <p className="font-fraunces text-lg text-light-foreground leading-tight">{prior.name}</p>
          {prior.region && (
            <p className="text-light-muted-foreground text-xs mt-0.5">{prior.region}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${confidenceClass}`}>
            {confidenceLabel}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-light-muted-foreground text-xs hover:text-light-foreground transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Style summary */}
      <p className="text-light-foreground/60 text-sm italic leading-relaxed">{prior.styleSummary}</p>

      {/* Key fields */}
      {!compact && (
        <div className="space-y-1.5 pt-1">
          <PriorRow label="Roast tendency" value={prior.roastTendency.replace("-", " ")} />
          <PriorRow
            label="Style bias"
            value={prior.clarityVsSweetnessBias === "balanced" ? "Clarity + sweetness" : prior.clarityVsSweetnessBias === "clarity" ? "Clarity-forward" : "Sweetness-forward"}
          />
          <PriorRow label="Extraction temp" value={tempLabel} />
          <PriorRow label="Ratio" value={ratioLabel} />
          {(prior.methodAffinities?.length ?? 0) > 0 && (
            <PriorRow label="Methods" value={(prior.methodAffinities ?? []).slice(0, 3).join(", ")} />
          )}
          {(prior.extractionRisks?.length ?? 0) > 0 && (
            <PriorRow label="Watch for" value={prior.extractionRisks![0]} />
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-light-foreground/25 text-xs leading-relaxed pt-1">
        Prior based on roaster style — individual coffee and your brew history take precedence.
      </p>
    </div>
  );
}

function PriorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-light-muted-foreground text-xs shrink-0 w-28">{label}</span>
      <span className="text-light-foreground/70 text-xs leading-snug capitalize">{value}</span>
    </div>
  );
}

// ── Generate / Edit Roaster Form ─────────────────────────────────────────

const ROAST_TENDENCIES = ["very-light", "light", "light-medium", "medium", "varied"] as const;
const STYLE_BIASES = ["clarity", "sweetness", "balanced", "varied"] as const;
const TEMP_BIASES = ["high", "standard", "low"] as const;
const RATIO_BIASES = ["lean", "standard", "rich"] as const;

function GenerateRoasterForm({
  roasterName,
  existingPrior,
  originalName,
  onSaved,
  onCancel,
}: {
  roasterName: string;
  existingPrior?: RoasterPriorSummary;
  /** Raw name from the bag, tracked as an alias when it differs from the canonical. */
  originalName?: string;
  onSaved: (prior: RoasterPriorSummary) => void;
  onCancel: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<RoasterPriorSummary>>(
    existingPrior ?? { name: roasterName }
  );
  const [generated, setGenerated] = useState(!!existingPrior);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/roasters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roasterName }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const prior = await res.json();
      setDraft(prior);
      setGenerated(true);
    } catch {
      setError("Could not generate profile. Fill in manually below.");
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!draft.name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/roasters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, confidence: "user", originalName }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSaved({ ...draft, confidence: "user" } as RoasterPriorSummary);
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-light-muted-foreground text-xs uppercase tracking-widest">
          {existingPrior ? "Edit Roaster Profile" : "Add Roaster Profile"}
        </p>
        <button type="button" onClick={onCancel} className="text-light-muted-foreground text-xs hover:text-light-foreground transition-colors">
          Cancel
        </button>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="w-full py-3 rounded-2xl border border-light-foreground/15 text-sm text-light-foreground disabled:opacity-40 active:scale-95 transition-all"
      >
        {generating ? "Searching…" : existingPrior ? "Re-search from web" : `Generate profile for ${roasterName}`}
      </button>

      {generated && (
        <div className="space-y-4">
          {/* Style summary */}
          <div className="space-y-1.5">
            <p className="text-light-muted-foreground text-xs">Style summary</p>
            <textarea
              value={draft.styleSummary ?? ""}
              onChange={e => setDraft(d => ({ ...d, styleSummary: e.target.value }))}
              rows={2}
              className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-3 py-2 text-light-foreground text-sm resize-none placeholder:text-light-muted-foreground focus:outline-none focus:border-white/30"
              placeholder="Describe this roaster's style…"
            />
          </div>

          {/* Roast tendency */}
          <div className="space-y-1.5">
            <p className="text-light-muted-foreground text-xs">Roast tendency</p>
            <div className="flex flex-wrap gap-2">
              {ROAST_TENDENCIES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, roastTendency: v }))}
                  className={`px-3 py-1 rounded-full border text-xs transition-all active:scale-95 ${
                    draft.roastTendency === v
                      ? "border-light-foreground bg-light-foreground/10 text-light-foreground"
                      : "border-light-foreground/15 text-light-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Style bias */}
          <div className="space-y-1.5">
            <p className="text-light-muted-foreground text-xs">Style bias</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_BIASES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, clarityVsSweetnessBias: v }))}
                  className={`px-3 py-1 rounded-full border text-xs transition-all active:scale-95 ${
                    draft.clarityVsSweetnessBias === v
                      ? "border-light-foreground bg-light-foreground/10 text-light-foreground"
                      : "border-light-foreground/15 text-light-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Temp + Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-light-muted-foreground text-xs">Temp bias</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMP_BIASES.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, tempBias: v }))}
                    className={`px-2 py-1 rounded-full border text-xs transition-all active:scale-95 ${
                      draft.tempBias === v
                        ? "border-light-foreground bg-light-foreground/10 text-light-foreground"
                        : "border-light-foreground/15 text-light-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-light-muted-foreground text-xs">Ratio bias</p>
              <div className="flex flex-wrap gap-1.5">
                {RATIO_BIASES.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, ratioBias: v }))}
                    className={`px-2 py-1 rounded-full border text-xs transition-all active:scale-95 ${
                      draft.ratioBias === v
                        ? "border-light-foreground bg-light-foreground/10 text-light-foreground"
                        : "border-light-foreground/15 text-light-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-light-muted-foreground text-xs">Notes</p>
            <textarea
              value={draft.notes ?? ""}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              rows={2}
              className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-3 py-2 text-light-foreground text-sm resize-none placeholder:text-light-muted-foreground focus:outline-none focus:border-white/30"
              placeholder="Best extraction approach…"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.styleSummary}
            className="w-full py-3 rounded-2xl bg-light-foreground text-[hsl(36_55%_96%)] text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all"
          >
            {saving ? "Saving…" : "Save to my roasters"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Roast date input ──────────────────────────────────────────────────────

function toLocalIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function RoastDateInput({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const todayIso = toLocalIso(new Date());
  const daysAgoIso = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toLocalIso(d);
  };
  const chips: { label: string; iso: string }[] = [
    { label: "Today", iso: daysAgoIso(0) },
    { label: "3d ago", iso: daysAgoIso(3) },
    { label: "1 wk", iso: daysAgoIso(7) },
    { label: "2 wk", iso: daysAgoIso(14) },
    { label: "1 mo", iso: daysAgoIso(30) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <input
        type="date"
        value={value ?? ""}
        max={todayIso}
        onChange={e => {
          const v = e.target.value || undefined;
          if (v && v > todayIso) return;
          onChange(v);
        }}
        className="w-full rounded-2xl px-3 py-2 text-base focus:outline-none"
        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />
      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <Chip key={c.label} selected={value === c.iso} onClick={() => onChange(c.iso)} size="sm">{c.label}</Chip>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs px-2 py-1 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Other helpers ─────────────────────────────────────────────────────────

function EditableRow({ label, value, onChange, suggestions }: { label: string; value: string; onChange: (v: string) => void; suggestions?: string[] }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  const commit = () => {
    setEditing(false);
    if (local.trim() !== value) onChange(local.trim());
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-light-muted-foreground text-xs">{label}</span>
        {suggestions && suggestions.length > 0 ? (
          <RoasterInput
            value={local}
            suggestions={suggestions}
            autoFocus
            onChange={setLocal}
            onSelect={v => { setLocal(v); setEditing(false); onChange(v); }}
            onBlur={commit}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
            className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-white/30 rounded-2xl px-3 py-2 text-light-foreground text-base focus:outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setLocal(value); setEditing(true); }}
      className="w-full flex items-baseline justify-between gap-4 group text-left"
    >
      <span className="text-light-muted-foreground text-sm shrink-0">{label}</span>
      <span className="text-light-foreground text-sm text-right group-active:text-light-foreground transition-colors underline underline-offset-2 decoration-white/20">
        {value || <span className="text-light-muted-foreground italic">tap to add</span>}
      </span>
    </button>
  );
}

// ── Roaster autocomplete input ─────────────────────────────────────────────

function RoasterInput({
  value,
  suggestions,
  onChange,
  onSelect,
  onBlur,
  autoFocus,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const filtered = value.trim().length === 0
    ? []
    : suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    onSelect?.(name);
    onBlur?.();
  };

  return (
    <div className="relative">
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); onBlur?.(); }, 150)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); onBlur?.(); }
        }}
        placeholder="Roaster"
        className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-3 text-light-foreground text-base placeholder:text-light-muted-foreground focus:outline-none focus:border-white/30"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl overflow-hidden shadow-xl">
          {filtered.slice(0, 6).map(name => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(name)}
                className="w-full text-left px-4 py-3 text-light-foreground text-sm active:bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 transition-colors border-b border-light-foreground/15 last:border-b-0"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
