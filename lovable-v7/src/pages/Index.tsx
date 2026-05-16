import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Brain,
  Users,
  Moon,
  FlaskConical,
  CupSoda,
  type LucideIcon,
} from "lucide-react";

const CARD_H = "h-[104px]";

type Variant = "ring" | "pressed";

/* ---------- Custom icons ---------- */

const SunriseNoArrow = ({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 17 L20 17" />
    <path d="M7 17 A5 5 0 0 1 17 17" />
    <path d="M4 12 L6 14" />
    <path d="M7 9 L8.5 10.5" />
    <path d="M12 7 L12 9" />
    <path d="M17 9 L15.5 10.5" />
    <path d="M20 12 L18 14" />
  </svg>
);

/* ---------- Section data ---------- */

type Occasion = { id: string; label: string; Icon: LucideIcon | React.FC<any> };
const occasions: Occasion[] = [
  { id: "morning-ritual", label: "Morning Ritual", Icon: SunriseNoArrow },
  { id: "deep-focus", label: "Deep Focus", Icon: Brain },
  { id: "social", label: "Social", Icon: Users },
  { id: "after-dinner", label: "After Dinner", Icon: Moon },
  { id: "experiment", label: "Experiment", Icon: FlaskConical },
  { id: "summer-time", label: "Summer Time", Icon: CupSoda },
];

const amounts = [
  { id: "small", title: "Small", sub: "350 ml" },
  { id: "big", title: "Big", sub: "520 ml" },
  { id: "custom", title: "Custom", sub: "enter ml" },
  { id: "surprise", title: "Surprise me", sub: "Claude picks" },
];

const times = [
  { id: "quick", title: "Quick", sub: "~2 min" },
  { id: "normal", title: "Normal", sub: "~5 min" },
];

const goals = [
  { id: "balanced", title: "Balanced", sub: "no taste-axis bias" },
  { id: "bright", title: "Bright / Clarity", sub: "Zone-1 emphasis" },
  { id: "sweet", title: "Sweet", sub: "Zone-2 emphasis" },
  { id: "bold", title: "Bold / Body", sub: "mouthfeel emphasis" },
  { id: "aromatic", title: "Aromatic / Floral", sub: "volatile & delicate emphasis" },
  { id: "explore", title: "Explore", sub: "Wildcard" },
];

const grinders = [
  { id: "niche-zero", title: "Niche Zero", sub: "° values" },
  { id: "comandante", title: "Comandante C40", sub: "click values" },
];

const approaches = [
  { id: "claude-picks", title: "Claude picks", sub: "Best method for this coffee" },
  { id: "ill-choose", title: "I'll choose", sub: "Claude dials in the recipe" },
];

const waters = [
  { id: "tap", title: "Tap only", sub: "~300 ppm" },
  { id: "championship", title: "Championship", sub: "~50 ppm" },
];

/* ---------- Footnote logic ---------- */

type Section =
  | "occasion"
  | "amount"
  | "time"
  | "goal"
  | "grinder"
  | "approach"
  | "water";

const getFootnote = (section: Section, selectedId: string | null): string | null => {
  switch (section) {
    case "occasion": {
      const map: Record<string, string> = {
        "morning-ritual":
          "A slower, deliberate pour that anchors the start of a day.",
        "deep-focus":
          "A clean, mid-strength cup engineered for sustained attention.",
        social: "A forgiving recipe that holds its character as it cools.",
        "after-dinner":
          "A heavier, dessert-leaning brew that closes the day with body and sweetness.",
        experiment:
          "The recipe will push ratios, methods or sequences you haven\u2019t tried on this coffee.",
        "summer-time":
          "Bright and refreshing, leaning into clarity and travelling well over ice.",
      };
      return (selectedId && map[selectedId]) || "Sets the pace and ritual of this brew.";
    }
    case "amount": {
      if (!selectedId) return null;
      const map: Record<string, string> = {
        small: "A single cup \u2014 focused tasting, faster brew.",
        big: "A mug or two to share.",
        custom: "Set your own target in millilitres.",
        surprise: "Claude picks the volume to match this coffee.",
      };
      return map[selectedId] ?? null;
    }
    case "goal":
      return "The goal defines which method works best for THIS coffee.";
    case "approach": {
      if (!selectedId) return null;
      const map: Record<string, string> = {
        "claude-picks":
          "Claude picks the best method for this coffee & context.",
        "ill-choose": "You set the method; Claude tunes everything else.",
      };
      return map[selectedId] ?? null;
    }
    case "water": {
      if (!selectedId) return null;
      const map: Record<string, string> = {
        tap: "Above SCA ceiling. Recipe will adjust accordingly.",
        championship: "Soft, mineral-light water \u2014 what most pros brew with.",
      };
      return map[selectedId] ?? null;
    }
    default:
      return null;
  }
};

/* ---------- Card primitive ---------- */

const FROSTED_DEFAULT =
  "bg-[hsl(36_55%_96%_/_0.55)] backdrop-blur-[14px] backdrop-saturate-150 text-foreground";
const SELECTED_FILL =
  "bg-[hsl(28_22%_84%_/_0.7)] backdrop-blur-[14px] backdrop-saturate-150 text-foreground";

const cardClass = (selected: boolean, variant: Variant) => {
  const base = `flex ${CARD_H} w-full flex-col items-center justify-center gap-1.5 rounded-3xl px-3 py-4 text-center transition-all`;
  if (!selected) return `${base} ${FROSTED_DEFAULT}`;
  if (variant === "ring") {
    return `${base} ${SELECTED_FILL} ring-1 ring-[hsl(28_25%_72%)]`;
  }
  return `${base} ${SELECTED_FILL} scale-[0.98] shadow-[inset_0_2px_4px_rgba(60,40,30,0.12)]`;
};

const titleClass = "text-[15px] font-medium leading-tight";
const subClass = "text-[12px] leading-tight line-clamp-2 text-muted-foreground";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="label-eyebrow mb-3 px-1">{children}</h2>
);

const Footnote = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted-foreground">
    {children}
  </p>
);

/* ---------- Custom amount input ---------- */

const CustomAmountInput = ({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <span
      className="inline-flex items-baseline gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        min={100}
        max={1000}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = parseInt(raw, 10);
          onChange(Number.isFinite(n) ? n : null);
        }}
        placeholder="350"
        className="w-14 bg-transparent text-center text-[15px] font-medium leading-tight text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-[12px] text-muted-foreground">ml</span>
    </span>
  );
};

/* ---------- Variant block (one full Brew Context view) ---------- */

type AmountState = { selectedId: string | null; customMl: number | null };

const VariantBlock = ({ variant }: { variant: Variant }) => {
  const [occasionId, setOccasionId] = useState<string | null>("morning-ritual");
  const [amount, setAmount] = useState<AmountState>({
    selectedId: "small",
    customMl: null,
  });
  const [timeId, setTimeId] = useState<string | null>("normal");
  const [goalId, setGoalId] = useState<string | null>("balanced");
  const [grinderId, setGrinderId] = useState<string | null>("niche-zero");
  const [approachId, setApproachId] = useState<string | null>("claude-picks");
  const [waterId, setWaterId] = useState<string | null>("tap");

  const renderGrid = <T extends { id: string; title: string; sub: string }>(
    items: T[],
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => {
        const sel = it.id === selectedId;
        return (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={cardClass(sel, variant)}
          >
            <span className={titleClass}>{it.title}</span>
            <span className={subClass}>{it.sub}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-10">
      {/* OCCASION */}
      <section>
        <SectionLabel>OCCASION</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {occasions.map(({ id, label, Icon }) => {
            const sel = id === occasionId;
            return (
              <button
                key={id}
                onClick={() => setOccasionId((prev) => (prev === id ? null : id))}
                className={cardClass(sel, variant)}
              >
                <span className={titleClass}>{label}</span>
                <span className="flex h-6 w-6 items-center justify-center text-foreground/80">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
              </button>
            );
          })}
        </div>
        <Footnote>{getFootnote("occasion", occasionId)}</Footnote>
      </section>

      {/* AMOUNT */}
      <section>
        <SectionLabel>AMOUNT</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {amounts.map((a) => {
            const sel = a.id === amount.selectedId;
            const isCustom = a.id === "custom";
            return (
              <button
                key={a.id}
                onClick={() =>
                  setAmount((prev) =>
                    prev.selectedId === a.id
                      ? { selectedId: null, customMl: null }
                      : { selectedId: a.id, customMl: isCustom ? prev.customMl : null }
                  )
                }
                className={cardClass(sel, variant)}
              >
                <span className={titleClass}>{a.title}</span>
                {isCustom && sel ? (
                  <CustomAmountInput
                    value={amount.customMl}
                    onChange={(v) =>
                      setAmount({ selectedId: "custom", customMl: v })
                    }
                  />
                ) : (
                  <span className={subClass}>{a.sub}</span>
                )}
              </button>
            );
          })}
        </div>
        {getFootnote("amount", amount.selectedId) && (
          <Footnote>{getFootnote("amount", amount.selectedId)}</Footnote>
        )}
      </section>

      {/* TIME */}
      <section>
        <SectionLabel>TIME</SectionLabel>
        {renderGrid(times, timeId, (id) => setTimeId((p) => (p === id ? null : id)))}
      </section>

      {/* GOAL */}
      <section>
        <SectionLabel>GOAL</SectionLabel>
        {renderGrid(goals, goalId, (id) => setGoalId((p) => (p === id ? null : id)))}
        <Footnote>{getFootnote("goal", goalId)}</Footnote>
      </section>

      {/* GRINDER */}
      <section>
        <SectionLabel>GRINDER</SectionLabel>
        {renderGrid(grinders, grinderId, (id) => setGrinderId((p) => (p === id ? null : id)))}
      </section>

      {/* APPROACH */}
      <section>
        <SectionLabel>BREWING APPROACH</SectionLabel>
        {renderGrid(approaches, approachId, (id) => setApproachId((p) => (p === id ? null : id)))}
        {getFootnote("approach", approachId) && (
          <Footnote>{getFootnote("approach", approachId)}</Footnote>
        )}
      </section>

      {/* WATER */}
      <section>
        <SectionLabel>WATER</SectionLabel>
        {renderGrid(waters, waterId, (id) => setWaterId((p) => (p === id ? null : id)))}
        {getFootnote("water", waterId) && (
          <Footnote>{getFootnote("water", waterId)}</Footnote>
        )}
      </section>

      {/* CTA with localized warmth */}
      <div className="relative pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="bg-brew-cta-warmth pointer-events-none absolute inset-x-[-20%] -bottom-10 -top-16 -z-10" />
        <button className="relative h-14 w-full rounded-full bg-foreground text-[15px] font-semibold text-background active:scale-[0.99]">
          Get my recipe
        </button>
      </div>
    </div>
  );
};

/* ---------- Page ---------- */

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fixed atmospheric gradient field */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-brew-field absolute inset-[-10%]" />
      </div>

      <div className="relative mx-auto max-w-[430px] px-5 pb-10">
        {/* Top bar */}
        <header className="flex items-center justify-between pt-12 pb-8">
          <button
            aria-label="Back"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground/70"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
          </div>
          <div className="w-9" />
        </header>

        {/* Hero */}
        <section className="pb-10">
          <p className="label-eyebrow mb-3">Context</p>
          <h1 className="font-serif font-semibold text-[40px] leading-[1.05] tracking-[-0.01em] text-foreground">
            What{"\u2019"}s the vibe?
          </h1>
        </section>

        <VariantBlock variant="pressed" />
      </div>
    </div>
  );
};

export default Index;
