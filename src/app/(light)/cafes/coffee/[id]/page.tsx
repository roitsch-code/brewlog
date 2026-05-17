"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import type { Session } from "@/lib/types/session";
import StarRating from "@/components/ui/light/StarRating";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import { BREW_METHODS } from "@/lib/constants/brewMethods";

function formatRelativeDate(iso: string): string {
  const ms = new Date(iso).getTime();
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function toCoffeeKey(roaster: string, name: string): string {
  return `${roaster}__${name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export default function CafeCoffeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const coffeeKey = params.id as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState("");
  const [editDose, setEditDose] = useState("");
  const [editWater, setEditWater] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
      .then(r => r.json())
      .then((data: Session[]) => {
        const filtered = Array.isArray(data)
          ? data.filter(s => s.coffee?.name && toCoffeeKey(s.coffee.roaster ?? "", s.coffee.name) === coffeeKey)
          : [];
        setSessions(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coffeeKey]);

  function startEdit(s: Session) {
    setEditingId(s.id);
    setEditMethod(s.brew?.methodUsed || s.place?.methodServed || "");
    setEditDose(s.brew?.doseGrams != null ? String(s.brew.doseGrams) : "");
    setEditWater(s.brew?.waterGrams != null ? String(s.brew.waterGrams) : "");
    setEditTime(s.brew?.actualTimeSec != null ? String(s.brew.actualTimeSec) : "");
    setEditNotes(s.result?.freeNotes || "");
  }

  async function saveEdit(s: Session) {
    setSaving(true);
    const brewUpdate = {
      ...(s.brew ?? {}),
      methodUsed: editMethod || undefined,
      doseGrams: editDose ? Number(editDose) : undefined,
      waterGrams: editWater ? Number(editWater) : undefined,
      actualTimeSec: editTime ? Number(editTime) : undefined,
    };
    const resultUpdate = s.result
      ? { ...s.result, freeNotes: editNotes || undefined }
      : undefined;

    setSessions(prev => prev.map(sess =>
      sess.id === s.id
        ? { ...sess, brew: brewUpdate, ...(resultUpdate ? { result: resultUpdate } : {}) }
        : sess
    ));
    setEditingId(null);

    try {
      await fetch(`/api/sessions/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brew: brewUpdate,
          ...(resultUpdate ? { result: resultUpdate } : {}),
        }),
      });
    } catch {
      // optimistic update stands
    }
    setSaving(false);
  }

  const coffee = sessions[0]?.coffee;
  const avgRating = sessions.length > 0
    ? (() => {
        const rated = sessions.filter(s => s.result?.rating);
        if (rated.length === 0) return null;
        return Math.round(rated.reduce((sum, x) => sum + (x.result?.rating ?? 0), 0) / rated.length * 10) / 10;
      })()
    : null;

  const uniqueCafes = Array.from(new Set(
    (sessions.map(s => s.place?.name) as (string | undefined)[]).filter((n): n is string => Boolean(n))
  ));
  const sub = coffee ? [coffee.origin, coffee.process].filter(Boolean).join(" · ") : "";

  return (
    <div className="min-h-full bg-transparent flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <button
            type="button"
            onClick={() => router.push("/cafes?tab=coffees")}
            className="flex items-center gap-1 text-light-muted-foreground text-sm mt-1"
            aria-label="Back to Coffees"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Coffees
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150 active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-48 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 rounded-full animate-pulse" />
          </div>
        ) : coffee ? (
          <>
            {coffee.roaster && (
              <p className="text-light-muted-foreground text-sm mb-0.5">{coffee.roaster}</p>
            )}
            <h1 className="font-fraunces text-3xl text-light-foreground leading-none">{coffee.name}</h1>
            {sub && <p className="text-light-muted-foreground text-sm mt-1">{sub}</p>}
            <p className="text-light-muted-foreground text-sm mt-1.5">
              <span className="text-light-foreground">{sessions.length}</span> session{sessions.length !== 1 ? "s" : ""}
              {avgRating != null && (
                <> · <span className="text-light-foreground">{avgRating.toFixed(1)}</span> avg</>
              )}
            </p>
          </>
        ) : (
          <h1 className="font-fraunces text-3xl text-light-foreground leading-none">Coffee</h1>
        )}

        {/* Cafés that served it */}
        {uniqueCafes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {uniqueCafes.map(name => (
              <span
                key={name}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3">
            <p className="text-light-foreground font-medium">No sessions found</p>
            <p className="text-light-muted-foreground text-sm">Could not find sessions for this coffee.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(s => {
              const method = s.brew?.methodUsed || s.place?.methodServed;
              const sessionSub = s.coffee ? [s.coffee.origin, s.coffee.process].filter(Boolean).join(" · ") : "";
              const isEditing = editingId === s.id;

              return (
                <div key={s.id} className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {s.place?.name && (
                        <p className="text-light-foreground/85 text-xs font-medium truncate mb-0.5">{s.place.name}</p>
                      )}
                      {s.place?.location && (
                        <p className="text-light-muted-foreground text-xs truncate">{s.place.location}</p>
                      )}
                      {sessionSub && <p className="text-light-muted-foreground text-xs mt-0.5">{sessionSub}</p>}
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-light-muted-foreground text-xs">{formatRelativeDate(s.createdAt)}</p>
                        {s.result?.rating != null && s.result.rating > 0 && (
                          <div className="mt-1">
                            <StarRating value={s.result.rating} readonly size="sm" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => isEditing ? setEditingId(null) : startEdit(s)}
                        className="p-1 rounded-lg text-light-muted-foreground active:text-light-foreground transition-colors mt-0.5"
                        aria-label="Edit brew details"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {(method || s.brew?.doseGrams || s.brew?.waterGrams || s.brew?.actualTimeSec) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {method && <SummaryChip>{method}</SummaryChip>}
                      {(s.brew?.doseGrams || s.brew?.waterGrams) && (
                        <SummaryChip>
                          {[s.brew.doseGrams ? `${s.brew.doseGrams}g` : null, s.brew.waterGrams ? `${s.brew.waterGrams}ml` : null].filter(Boolean).join(" / ")}
                        </SummaryChip>
                      )}
                      {s.brew?.actualTimeSec && (
                        <SummaryChip>
                          {Math.floor(s.brew.actualTimeSec / 60)}:{String(s.brew.actualTimeSec % 60).padStart(2, "0")}
                        </SummaryChip>
                      )}
                    </div>
                  )}

                  {s.result?.flavorNotes && s.result.flavorNotes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.result.flavorNotes.slice(0, 3).map(note => (
                        <SummaryChip key={note}>{note}</SummaryChip>
                      ))}
                    </div>
                  ) : s.coffee?.tastingNotesFromBag && s.coffee.tastingNotesFromBag.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.coffee.tastingNotesFromBag.slice(0, 3).map(note => (
                        <SummaryChip key={note} dashed>{note}</SummaryChip>
                      ))}
                    </div>
                  ) : null}

                  {/* Library cross-link — to the bag's coffee detail
                      in /coffees (different from the cafe-coffee key) */}
                  {s.coffee?.coffeeId && (
                    <div className="mt-2">
                      <Link
                        href={`/coffees/${s.coffee.coffeeId}`}
                        className="inline-flex items-center gap-1 text-xs text-light-foreground/70 border border-light-foreground/20 rounded-full px-2.5 py-0.5"
                      >
                        Coffee Library
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  )}

                  {/* Inline edit panel */}
                  <div className={`overflow-hidden transition-all duration-300 ${isEditing ? "max-h-[30rem] opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
                    <div className="border-t border-light-foreground/15 pt-3 space-y-3">
                      <div>
                        <p className="text-light-muted-foreground text-xs mb-1.5">Method</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                          {BREW_METHODS.map(m => (
                            <button
                              key={m.id}
                              onClick={() => setEditMethod(editMethod === m.label ? "" : m.label)}
                              className={`shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                editMethod === m.label
                                  ? "bg-light-foreground text-[hsl(36_55%_96%)] border-light-foreground"
                                  : "text-light-muted-foreground border-light-foreground/20 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <LabeledNumber label="Dose (g)" value={editDose} onChange={setEditDose} />
                        <LabeledNumber label="Water (ml)" value={editWater} onChange={setEditWater} />
                      </div>

                      <LabeledNumber label="Time (seconds)" value={editTime} onChange={setEditTime} />

                      <div>
                        <label className="text-light-muted-foreground text-xs block mb-1">Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          placeholder="Add notes..."
                          rows={2}
                          className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/20 rounded-xl px-2.5 py-1.5 text-light-foreground text-sm resize-none placeholder:text-light-muted-foreground"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(s)}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-light-foreground text-[hsl(36_55%_96%)] text-sm font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 py-2 rounded-xl border border-light-foreground/20 text-light-muted-foreground text-sm bg-light-card-default backdrop-blur-light-card backdrop-saturate-150"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function SummaryChip({ children, dashed = false }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground ${
        dashed ? "border border-dashed border-light-foreground/30 italic" : ""
      }`}
    >
      {children}
    </span>
  );
}

function LabeledNumber({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-light-muted-foreground text-xs block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/20 rounded-xl px-2.5 py-1.5 text-light-foreground text-sm placeholder:text-light-muted-foreground"
      />
    </div>
  );
}
