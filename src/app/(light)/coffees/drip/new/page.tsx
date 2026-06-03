"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useFlowStore } from "@/store/flowStore";
import Hero from "@/components/ui/light/Hero";
import Section from "@/components/ui/light/Section";
import Chip from "@/components/ui/light/Chip";
import StarRating from "@/components/ui/light/StarRating";
import CTA from "@/components/ui/light/CTA";
import FlavorWheel from "@/components/ui/FlavorWheel";
import { SCA_WHEEL, QUICK_FLAVORS } from "@/lib/constants/scaFlavorWheel";
import { useFieldConfig } from "@/lib/field/FieldContext";
import type { FieldZones } from "@/lib/field/types";

// Same wording as the post-brew taste log so a drip-bag rating reads
// identically to a brewed coffee's. Half-star values fall back to "".
const RATING_LABELS = ["", "Disappointing", "Okay", "Good", "Great", "Outstanding"];

const inputClass =
  "w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none";

const chipStatic =
  "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground";

/**
 * Log a drip bag — a lightweight documentation page (NOT the brew flow).
 * Always entered from the New Session scan via the "This is a drip bag"
 * toggle: the scan already extracted the identity, uploaded the photo and
 * mapped the Field, so this page just records the flavours tasted + a star
 * rating and saves (isolated, in drip_bags). Direct visits with no flow
 * draft bounce back to /brew/new.
 */
export default function LogDripBagPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);

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

  // Tasting
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [freeNotes, setFreeNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed from the brew-flow scan once on mount. No seed = arrived here
  // without scanning → send the user to the scan where the toggle lives.
  useEffect(() => {
    const st = useFlowStore.getState();
    const c = st.draft.coffee;
    if (!st.isDripBag || !c || !(c.name || c.roaster)) {
      router.replace("/brew/new");
      return;
    }
    setRoaster(c.roaster ?? "");
    setName(c.name ?? "");
    setOrigin(c.origin || undefined);
    setRegion(c.region || undefined);
    setVariety(c.variety || undefined);
    setProcess(c.process || undefined);
    setRoastLevel(c.roastLevel || undefined);
    if (c.tastingNotesFromBag?.length) setBagNotes(c.tastingNotesFromBag);
    setBagPhotoUrl(c.bagPhotoUrl || undefined);
    setBagPhotoPath(c.bagPhotoPath || undefined);
    if (st.fieldZones) setFieldZones(st.fieldZones);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paint the page in the scanned coffee's Field, like the rest of the app.
  useFieldConfig(fieldZones ? { fieldZones, rotation: 0 } : null);

  const toggleFlavor = (f: string) =>
    setSelectedFlavors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const meta = [origin, region, process, variety, roastLevel].filter((v): v is string => !!v);
  const canSave = roaster.trim().length > 0 && name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/drip-bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          aiExtracted: true,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Clear the brew-flow draft + drip-bag flag so the next "New Session"
      // starts clean (the scan step seeded this page from the flow store).
      useFlowStore.getState().reset();
      router.push("/coffees");
    } catch {
      setSaving(false);
      setSaveError("Couldn't save — check your connection and try again.");
    }
  };

  if (!ready) return null;

  return (
    <div className="relative mx-auto max-w-[430px] px-5 pb-4">
      {/* Header — standard borderless back button (design system §7.3). */}
      <div className="flex items-center" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)", paddingBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center text-light-foreground/70 active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <Hero eyebrow="Drip bag" question={<>Log a drip bag.</>} />

      <div className="mt-6 space-y-10">
        {/* ── IDENTITY ─────────────────────────────────────── */}
        <div className="space-y-3">
          {bagPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bagPhotoUrl} alt={name} className="w-full h-48 object-cover rounded-2xl mb-2" />
          )}
          <div>
            <p className="label-eyebrow mb-1.5 px-1">Roaster</p>
            <input value={roaster} onChange={(e) => setRoaster(e.target.value)} placeholder="e.g. INNO" className={inputClass} />
          </div>
          <div>
            <p className="label-eyebrow mb-1.5 px-1">Coffee</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ethiopia" className={inputClass} />
          </div>
          {meta.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {meta.map((v) => (
                <span key={v} className={chipStatic}>{v}</span>
              ))}
            </div>
          )}
          {bagNotes.length > 0 && (
            <div className="pt-1">
              <p className="label-eyebrow mb-1.5 px-1">Printed notes</p>
              <div className="flex flex-wrap gap-1.5">
                {bagNotes.map((n) => (
                  <span key={n} className={`${chipStatic} capitalize`}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RATING — identical to the post-brew taste log ── */}
        <Section eyebrow="Your rating">
          <div className="flex flex-col items-center gap-3 py-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
            <p className="text-[13px] text-light-muted-foreground">
              {rating === 0 ? "Tap to rate" : RATING_LABELS[rating] ?? ""}
            </p>
          </div>
        </Section>

        {/* ── FLAVOURS ─────────────────────────────────────── */}
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

        {/* ── NOTES ────────────────────────────────────────── */}
        <Section eyebrow="Notes (optional)">
          <textarea
            value={freeNotes}
            onChange={(e) => setFreeNotes(e.target.value)}
            placeholder="Anything else worth noting…"
            rows={3}
            className="w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none resize-none"
          />
        </Section>

        {saveError && <p className="text-light-destructive text-sm px-1">{saveError}</p>}
      </div>

      {/* Non-sticky design-system CTA (no pinned bar / cream box). */}
      <CTA onClick={handleSave} disabled={!canSave} loading={saving}>
        Save drip bag
      </CTA>
    </div>
  );
}
