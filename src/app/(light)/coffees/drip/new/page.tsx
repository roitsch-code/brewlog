"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "@/components/ui/light/Hero";
import Section from "@/components/ui/light/Section";
import Chip from "@/components/ui/light/Chip";
import StarRating from "@/components/ui/light/StarRating";
import FlavorWheel from "@/components/ui/FlavorWheel";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import { SCA_WHEEL, QUICK_FLAVORS } from "@/lib/constants/scaFlavorWheel";
import { useFieldConfig } from "@/lib/field/FieldContext";
import type { FieldZones } from "@/lib/field/types";

interface Extracted {
  roaster?: string;
  name?: string;
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  roastLevel?: string;
  tastingNotesFromBag?: string[];
}

const inputClass =
  "w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none";

/**
 * Add a drip bag — a lightweight documentation flow (NOT the brew flow).
 * Scan the sachet → we extract the identity + printed notes → you pick
 * the flavours you tasted + a star rating → save. No recipe, no timer:
 * drip bags brew one fixed way. Page-local state only; never touches the
 * brew flowStore. See src/lib/types/dripBag.ts.
 */
export default function AddDripBagPage() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Identity (roaster + name editable; the rest are read-only chips)
  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<string | undefined>();
  const [region, setRegion] = useState<string | undefined>();
  const [variety, setVariety] = useState<string | undefined>();
  const [process, setProcess] = useState<string | undefined>();
  const [roastLevel, setRoastLevel] = useState<string | undefined>();
  const [bagNotes, setBagNotes] = useState<string[]>([]);

  const [bagPhotoUrl, setBagPhotoUrl] = useState<string | undefined>();
  const [bagPhotoPath, setBagPhotoPath] = useState<string | undefined>();
  const [fieldZones, setFieldZones] = useState<FieldZones | null>(null);
  const [aiExtracted, setAiExtracted] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // URL crawl (the package QR → product page)
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");

  // Tasting
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [freeNotes, setFreeNotes] = useState("");

  const [saving, setSaving] = useState(false);

  // Paint the page in the scanned coffee's Field, like the rest of the app.
  useFieldConfig(fieldZones ? { fieldZones, rotation: 0 } : null);

  const toggleFlavor = (f: string) =>
    setSelectedFlavors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const applyExtracted = (ex: Extracted) => {
    if (ex.roaster) setRoaster(ex.roaster);
    if (ex.name) setName(ex.name);
    setOrigin(ex.origin);
    setRegion(ex.region);
    setVariety(ex.variety);
    setProcess(ex.process);
    setRoastLevel(ex.roastLevel);
    if (ex.tastingNotesFromBag?.length) setBagNotes(ex.tastingNotesFromBag);
    setAiExtracted(true);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);
    try {
      // 1. Upload to S3 (bags/ prefix is enforced by /api/upload)
      const upFd = new FormData();
      upFd.append("file", file);
      upFd.append("path", `bags/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`);
      const up = await fetch("/api/upload", { method: "POST", body: upFd });
      if (up.ok) {
        const { url: storedUrl, storagePath } = await up.json();
        setBagPhotoUrl(storedUrl);
        setBagPhotoPath(storagePath);
      }

      // 2. Analyze the label
      const anFd = new FormData();
      anFd.append("image", file);
      const an = await fetch("/api/analyze-bag", { method: "POST", body: anFd });
      if (!an.ok) throw new Error("Analysis failed");
      const data = await an.json();
      applyExtracted((data.extracted ?? {}) as Extracted);
      if (data.fieldZones) setFieldZones(data.fieldZones as FieldZones);
    } catch {
      setScanError("Couldn't read the package — add the details by hand below.");
      setAiExtracted(true); // reveal the manual form anyway
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setScanError(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      applyExtracted((data.extracted ?? {}) as Extracted);
    } catch {
      setScanError("Couldn't read that link — add the details by hand below.");
      setAiExtracted(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const started = aiExtracted || previewUrl != null;
  const canSave = roaster.trim().length > 0 && name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      roaster: roaster.trim(),
      name: name.trim(),
      origin,
      region,
      variety,
      process,
      roastLevel,
      bagNotes,
      flavorNotes: selectedFlavors,
      rating,
      freeNotes: freeNotes.trim() || undefined,
      bagPhotoUrl,
      bagPhotoPath,
      fieldZones,
      aiExtracted,
    };
    try {
      const res = await fetch("/api/drip-bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      router.push("/coffees");
    } catch {
      setSaving(false);
      setScanError("Couldn't save — check your connection and try again.");
    }
  };

  return (
    <div className="min-h-svh bg-transparent flex flex-col pb-32">
      {/* Header */}
      <div className="px-5 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={() => router.push("/coffees")} className="text-light-muted-foreground text-sm">
          ← Library
        </button>
      </div>

      <div className="px-5">
        <Hero eyebrow="Drip bag" question={<>Document a drip bag.</>} />
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />

      <div className="px-5 mt-2 space-y-10">
        {/* ── SCAN ─────────────────────────────────────────── */}
        <Section eyebrow="The package">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Drip bag" className="w-full h-48 object-cover rounded-2xl mb-3" />
          )}
          {!started ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full h-14 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] font-semibold active:scale-[0.98] transition-transform"
              >
                Scan package
              </button>
              {!showUrl ? (
                <button
                  type="button"
                  onClick={() => setShowUrl(true)}
                  className="w-full text-light-muted-foreground text-sm py-2"
                >
                  Paste a link instead
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleUrl}
                    aria-label="Analyze link"
                    className="shrink-0 h-12 w-12 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] flex items-center justify-center"
                  >
                    →
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAiExtracted(true)}
                className="w-full text-light-muted-foreground text-sm py-2"
              >
                Enter manually
              </button>
            </div>
          ) : null}

          {analyzing && (
            <div className="flex items-center gap-3 py-4">
              <CoffeeBeanGlow size={28} />
              <p className="text-light-muted-foreground text-sm">Reading the package…</p>
            </div>
          )}

          {scanError && <p className="text-[hsl(12_70%_45%)] text-sm mt-2">{scanError}</p>}

          {started && !analyzing && (
            <div className="space-y-3 mt-1">
              <div>
                <p className="text-[11px] text-light-muted-foreground mb-1.5 px-1">Roaster</p>
                <input value={roaster} onChange={(e) => setRoaster(e.target.value)} placeholder="e.g. INNO" className={inputClass} />
              </div>
              <div>
                <p className="text-[11px] text-light-muted-foreground mb-1.5 px-1">Coffee</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ethiopia" className={inputClass} />
              </div>
              {(origin || process || variety || roastLevel || region) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[origin, region, process, variety, roastLevel]
                    .filter((v): v is string => !!v)
                    .map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
                      >
                        {v}
                      </span>
                    ))}
                </div>
              )}
              {bagNotes.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] text-light-muted-foreground mb-1.5 px-1">Printed notes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bagNotes.map((nVal) => (
                      <span
                        key={nVal}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
                      >
                        {nVal}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── RATING ───────────────────────────────────────── */}
        {started && (
          <Section eyebrow="Your rating">
            <div className="flex flex-col items-center gap-2 py-2">
              <StarRating value={rating} onChange={setRating} size="lg" />
              <p className="text-[13px] text-light-muted-foreground">{rating === 0 ? "Tap to rate" : `${rating} / 5`}</p>
            </div>
          </Section>
        )}

        {/* ── FLAVOURS ─────────────────────────────────────── */}
        {started && (
          <Section eyebrow="Flavours you tasted">
            <div className="w-full flex justify-center">
              <FlavorWheel
                mode="select"
                activeCategory={activeCategory}
                onCategorySelect={setActiveCategory}
                selectedFlavors={selectedFlavors}
                size={320}
              />
            </div>

            {activeCategory ? (
              <div className="space-y-3 mt-3">
                <p className="label-eyebrow px-1">{activeCategory}</p>
                {Object.entries(SCA_WHEEL[activeCategory].subcategories).map(([sub, flavors]) => (
                  <div key={sub}>
                    {Object.keys(SCA_WHEEL[activeCategory].subcategories).length > 1 && (
                      <p className="text-[11px] text-light-muted-foreground/70 mb-1.5 px-1">{sub}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {flavors.map((f) => (
                        <Chip key={f} size="sm" selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)}>
                          {f}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                <div className="flex flex-wrap gap-2">
                  {QUICK_FLAVORS.map((f) => (
                    <Chip key={f} size="sm" selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)}>
                      {f}
                    </Chip>
                  ))}
                </div>
                <p className="text-[12px] text-light-muted-foreground px-1 mt-1">Tap the wheel to explore by category</p>
              </div>
            )}

            {selectedFlavors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3 mt-2 border-t border-light-foreground/10">
                {selectedFlavors.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFlavor(f)}
                    className="text-[12px] text-light-foreground bg-light-card-selected px-2 py-0.5 rounded-lg"
                  >
                    {f} ×
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── NOTES ────────────────────────────────────────── */}
        {started && (
          <Section eyebrow="Notes (optional)">
            <textarea
              value={freeNotes}
              onChange={(e) => setFreeNotes(e.target.value)}
              placeholder="Anything else worth noting…"
              rows={3}
              className="w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none resize-none"
            />
          </Section>
        )}
      </div>

      {/* Save bar */}
      {started && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-gradient-to-t from-[hsl(36_55%_96%)] via-[hsl(36_55%_96%/0.85)] to-transparent"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full h-14 rounded-full font-semibold transition-transform active:scale-[0.98] ${
              canSave
                ? "bg-light-foreground text-[hsl(36_55%_96%)]"
                : "bg-light-foreground/30 text-[hsl(36_55%_96%)] cursor-not-allowed"
            }`}
          >
            {saving ? "Saving…" : "Save drip bag"}
          </button>
        </div>
      )}
    </div>
  );
}
