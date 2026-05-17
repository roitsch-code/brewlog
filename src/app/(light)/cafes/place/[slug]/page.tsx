"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, ThumbsUp, ThumbsDown } from "lucide-react";
import type { Session } from "@/lib/types/session";
import type { CafeVisit, CafeVisitRating } from "@/lib/types/cafes";
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

export default function CafeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cafeName = decodeURIComponent(params.slug as string);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [visits, setVisits] = useState<CafeVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState("");
  const [editDose, setEditDose] = useState("");
  const [editWater, setEditWater] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions?mode=external&limit=200", { cache: "no-store" })
        .then(r => r.json())
        .then((data: Session[]) => {
          const filtered = Array.isArray(data)
            ? data.filter(s => s.place?.name === cafeName)
            : [];
          setSessions(filtered);
        })
        .catch(() => {}),
      fetch(`/api/cafe-visits?cafeName=${encodeURIComponent(cafeName)}`, { cache: "no-store" })
        .then(r => r.json())
        .then((data: CafeVisit[]) => setVisits(Array.isArray(data) ? data : []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [cafeName]);

  async function saveVisit(rating: CafeVisitRating) {
    setVisitSaving(true);
    try {
      const location = sessions[0]?.place?.location;
      const res = await fetch("/api/cafe-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeName, location, rating }),
      });
      if (res.ok) {
        const created: CafeVisit = await res.json();
        setVisits(prev => [created, ...prev]);
        setVisitModalOpen(false);
      }
    } finally {
      setVisitSaving(false);
    }
  }

  async function deleteVisit(id: string) {
    try {
      await fetch(`/api/cafe-visits/${id}`, { method: "DELETE" });
      setVisits(prev => prev.filter(v => v.id !== id));
    } catch {
      // leave as-is on error
    }
  }

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

  async function deleteSession(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions(prev => prev.filter(s => s.id !== id));
      setEditingId(null);
    } catch {
      // leave as-is on error
    }
    setDeletingId(null);
  }

  const location = sessions[0]?.place?.location;
  const avgRating = sessions.length > 0
    ? (() => {
        const rated = sessions.filter(s => s.result?.rating);
        if (rated.length === 0) return null;
        return Math.round(rated.reduce((sum, x) => sum + (x.result?.rating ?? 0), 0) / rated.length * 10) / 10;
      })()
    : null;

  const mapsUrl = location
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${cafeName} ${location}`)}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(cafeName)}`;

  return (
    <div className="min-h-full bg-transparent flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <button
            type="button"
            onClick={() => router.push("/cafes")}
            className="flex items-center gap-1 text-light-muted-foreground text-sm mt-1"
            aria-label="Back to Cafés"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Cafés
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
        <h1 className="font-fraunces text-3xl text-light-foreground leading-none">{cafeName}</h1>
        {location && (
          <p className="text-light-muted-foreground text-sm mt-1">{location}</p>
        )}

        {/* Stats + Open in Maps */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {!loading && (sessions.length > 0 || visits.length > 0) && (
            <p className="text-light-muted-foreground text-sm">
              <span className="text-light-foreground">{sessions.length + visits.length}</span> visit{(sessions.length + visits.length) !== 1 ? "s" : ""}
              {avgRating != null && (
                <>
                  {" · "}
                  <span className="text-light-foreground">{avgRating.toFixed(1)}</span> avg
                </>
              )}
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-full text-xs text-light-muted-foreground active:scale-95 transition-transform"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Open in Maps
          </a>
        </div>

        {/* "I've been here" — visit without logging a brew. opens a modal
            with a binary thumb rating (come back / won't return). */}
        <button
          type="button"
          onClick={() => setVisitModalOpen(true)}
          className="mt-3 w-full h-12 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] text-sm font-medium active:scale-[0.98] transition-transform"
        >
          I&apos;ve been here
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 && visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3">
            <p className="text-light-foreground font-medium">No sessions found</p>
            <p className="text-light-muted-foreground text-sm">Tap &ldquo;I&apos;ve been here&rdquo; above to log a visit, or log a brew with this café selected.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Visit-only cards first (compact), sessions next. Both
                sorted desc by recency within their own group. */}
            {visits.map(v => (
              <VisitCard key={v.id} visit={v} onDelete={() => deleteVisit(v.id)} />
            ))}
            {sessions.map(s => {
              const method = s.brew?.methodUsed || s.place?.methodServed;
              const coffeeKey = s.coffee?.name && s.coffee?.roaster
                ? toCoffeeKey(s.coffee.roaster, s.coffee.name)
                : null;
              const sub = s.coffee ? [s.coffee.origin, s.coffee.process].filter(Boolean).join(" · ") : "";
              const isEditing = editingId === s.id;

              return (
                <div key={s.id} className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {s.coffee?.name && (
                        <>
                          {s.coffee.roaster && (
                            <p className="text-light-muted-foreground text-xs truncate">{s.coffee.roaster}</p>
                          )}
                          <p className="text-light-foreground text-sm font-medium leading-snug truncate">{s.coffee.name}</p>
                          {sub && <p className="text-light-muted-foreground text-xs mt-0.5">{sub}</p>}
                        </>
                      )}
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

                  {/* Recipe summary chips — unified cream-glass style */}
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

                  {coffeeKey && (
                    <div className="mt-2">
                      <Link
                        href={`/cafes/coffee/${coffeeKey}`}
                        className="inline-flex items-center gap-1 text-xs text-light-foreground/70 border border-light-foreground/20 rounded-full px-2.5 py-0.5"
                      >
                        Coffee detail
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
                      <button
                        onClick={() => deleteSession(s.id)}
                        disabled={deletingId === s.id}
                        className="w-full py-2 rounded-xl bg-[hsl(12_70%_45%)] text-[hsl(36_55%_96%)] text-xs font-medium active:scale-[0.99] transition-transform disabled:opacity-40"
                      >
                        {deletingId === s.id ? "Deleting…" : "Delete session"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* "I've been here" rating modal — binary thumbs (come back / won't
          return). Saves to /api/cafe-visits and prepends to the list. */}
      {visitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-5"
          style={{ background: "rgba(28,22,19,0.45)" }}
          onClick={() => !visitSaving && setVisitModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[hsl(36_55%_96%)] rounded-3xl p-6 space-y-4 mb-6 sm:mb-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="font-fraunces text-2xl text-light-foreground leading-tight">How was it?</h2>
              <p className="text-light-muted-foreground text-sm">{cafeName}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => saveVisit("come-back")}
                className="w-full h-14 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <ThumbsUp className="w-5 h-5" strokeWidth={1.75} />
                Would come back
              </button>
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => saveVisit("wont-return")}
                className="w-full h-14 rounded-full border border-light-foreground/25 text-light-foreground font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150"
              >
                <ThumbsDown className="w-5 h-5" strokeWidth={1.75} />
                Won&apos;t see me again
              </button>
            </div>
            <button
              type="button"
              disabled={visitSaving}
              onClick={() => setVisitModalOpen(false)}
              className="w-full text-light-muted-foreground text-sm py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitCard({ visit, onDelete }: { visit: CafeVisit; onDelete: () => void }) {
  const isPositive = visit.rating === "come-back";
  const date = formatRelativeDate(visit.visitedAt);
  return (
    <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isPositive ? (
            <ThumbsUp className="w-4 h-4 shrink-0 text-light-foreground" strokeWidth={1.75} />
          ) : (
            <ThumbsDown className="w-4 h-4 shrink-0 text-light-muted-foreground" strokeWidth={1.75} />
          )}
          <span className="text-light-foreground text-sm font-medium truncate">
            {isPositive ? "Would come back" : "Won't see me again"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-light-muted-foreground text-xs">{date}</span>
          <button
            onClick={onDelete}
            aria-label="Delete visit"
            className="p-1 text-light-muted-foreground/70 active:text-light-foreground transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {visit.notes && (
        <p className="text-light-muted-foreground text-sm mt-2 leading-relaxed">{visit.notes}</p>
      )}
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
