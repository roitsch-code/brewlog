"use client";
import Chip from "@/components/ui/light/Chip";
import { Plus, X } from "lucide-react";
import type { BlendComponent } from "@/lib/types/session";

/**
 * Per-component editor for a coffee blend. Each component pairs its own
 * origin / region / variety / process (a blend can mix processes) plus an
 * optional percentage. Used inside LightStepScan when the user marks a bag as
 * a blend.
 *
 * This is a controlled component: it never derives the scalar origin/process
 * summary itself — the caller does that in `onChange` (via
 * deriveIdentitySummary) so the draft's scalar fields stay in sync for every
 * downstream consumer that reads them.
 */
export default function BlendComponentsEditor({
  components,
  processes,
  onChange,
}: {
  components: BlendComponent[];
  /** Process options (shared with the single-origin picker). */
  processes: string[];
  onChange: (next: BlendComponent[]) => void;
}) {
  const patch = (i: number, p: Partial<BlendComponent>) =>
    onChange(components.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  const add = () =>
    onChange([...components, { origin: "" }]);

  const remove = (i: number) =>
    onChange(components.filter((_, idx) => idx !== i));

  const fieldStyle = {
    background: "var(--secondary)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  } as const;

  return (
    <div className="space-y-3">
      {components.map((c, i) => (
        <div
          key={i}
          className="rounded-2xl p-3 space-y-2.5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="label-eyebrow"
              style={{ color: "var(--muted-foreground)" }}
            >
              Origin {i + 1}
            </span>
            {components.length > 1 && (
              <button
                type="button"
                aria-label={`Remove origin ${i + 1}`}
                onClick={() => remove(i)}
                className="opacity-60 active:opacity-100"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={c.origin}
              placeholder="Country (e.g. Brazil)"
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-base focus:outline-none"
              style={fieldStyle}
              onChange={(e) => patch(i, { origin: e.target.value })}
            />
            <div className="relative w-20 shrink-0">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={c.ratio ?? ""}
                placeholder="%"
                className="w-full rounded-xl pl-3 pr-6 py-2 text-base focus:outline-none"
                style={fieldStyle}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  patch(i, { ratio: Number.isFinite(n) ? n : undefined });
                }}
              />
              <span
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                %
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={c.region ?? ""}
              placeholder="Region (optional)"
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-base focus:outline-none"
              style={fieldStyle}
              onChange={(e) => patch(i, { region: e.target.value || undefined })}
            />
            <input
              type="text"
              value={c.variety ?? ""}
              placeholder="Variety (optional)"
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-base focus:outline-none"
              style={fieldStyle}
              onChange={(e) => patch(i, { variety: e.target.value || undefined })}
            />
          </div>

          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--muted-foreground)" }}>
              Process
            </p>
            <div className="flex flex-wrap gap-2">
              {processes.map((p) => (
                <Chip
                  key={p}
                  selected={c.process === p}
                  onClick={() => patch(i, { process: c.process === p ? undefined : p })}
                  size="sm"
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm"
        style={{ border: "1px dashed var(--border)", color: "var(--foreground)" }}
      >
        <Plus size={15} /> Add origin
      </button>
    </div>
  );
}
