"use client";

/**
 * /lessons — "What BTTS learned about you".
 *
 * The two-way memory page. Every row in the lessons table renders as a
 * card grouped by level (coffee / roaster / method-style / process-roast).
 *
 * The user can:
 *   - Dismiss a wrong lesson (status → 'dismissed', hidden from /recommend)
 *   - Restore a dismissed lesson
 *   - Confirm a lesson (source → 'user-confirmed')
 *   - Edit the directive in place (source → 'user-edited', locks it
 *     against future auto-overwrite)
 *
 * This is the surface that turns "BTTS guesses what you like" into "you
 * and BTTS share a written model you can both edit." Per the user's
 * direction: this IS the partnership.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";

type Level = "coffee" | "roaster" | "method-style" | "process-roast";
type Source = "auto" | "user-confirmed" | "user-edited" | "backfill";
type Status = "active" | "dismissed" | "pending";

interface CoffeeMeta {
  inRotation: boolean;
  roaster: string;
  name: string;
}

interface LessonQuestion {
  id: string;
  prompt: string;
  options: string[];
}

interface LessonAnswer {
  questionId: string;
  selected: string | null;
  freeText: string | null;
}

interface Lesson {
  id: string;
  level: Level;
  scope: string;
  content: string;
  confidenceN: number;
  evidenceSessionIds: string[];
  source: Source;
  status: Status;
  userNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only for level='coffee'; null when the coffees row is missing. */
  coffeeMeta?: CoffeeMeta | null;
  /** Populated when status='pending' — Haiku's clarifying questions. */
  questions?: LessonQuestion[] | null;
  /** Populated once finalised — preserved for audit. */
  answers?: LessonAnswer[] | null;
}

const LEVEL_TITLES: Record<Level, string> = {
  coffee: "Per coffee",
  roaster: "Per roaster",
  "method-style": "Per recipe family",
  "process-roast": "Per process × roast",
};

const LEVEL_BLURBS: Record<Level, string> = {
  coffee: "What BTTS has learned about specific bags. Survives even after the brew falls out of the recent history window.",
  roaster: "Patterns across multiple bags from the same roaster.",
  "method-style": "How recipe families (Hoffmann-style, Kasuya 4:6, etc.) tend to land for you.",
  "process-roast": "Cross-coffee directives by processing × roast level.",
};

const LEVEL_ORDER: Level[] = ["coffee", "roaster", "method-style", "process-roast"];

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/lessons", { cache: "no-store" });
        if (res.ok) setLessons(await res.json());
        else setLessons([]);
      } catch {
        setLessons([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateLocal = (id: string, patch: Partial<Lesson>) => {
    setLessons((prev) => prev?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? prev);
  };

  const handleDismiss = async (id: string) => {
    updateLocal(id, { status: "dismissed" });
    try {
      await fetch(`/api/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
    } catch {
      updateLocal(id, { status: "active" });
    }
  };

  const handleRestore = async (id: string) => {
    updateLocal(id, { status: "active" });
    try {
      await fetch(`/api/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
    } catch {
      updateLocal(id, { status: "dismissed" });
    }
  };

  const handleConfirm = async (id: string) => {
    updateLocal(id, { source: "user-confirmed" });
    try {
      await fetch(`/api/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
    } catch {
      // Silent — confirm is a soft promotion, not destructive.
    }
  };

  const handleSaveEdit = async (id: string, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    updateLocal(id, { content: trimmed, source: "user-edited" });
    try {
      await fetch(`/api/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
    } catch {
      // Optimistic save kept; the server retry happens on next edit.
    }
  };

  /**
   * Answer a pending lesson — POST to the finalisation endpoint which
   * runs a second Haiku turn folding the answers into the draft and
   * flipping status pending → active. The response is the finalised
   * row; we replace the local lesson with it so the card transitions
   * out of the Pending section into the relevant level section.
   *
   * Returns true on success so the card can clear its local state.
   */
  const handleAnswer = async (
    id: string,
    answers: LessonAnswer[],
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/lessons/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) return false;
      const updated: Lesson = await res.json();
      // The API returns the row without the coffeeMeta join; preserve
      // ours so coffee-level cards keep their friendly name + rotation
      // status after answering.
      setLessons((prev) =>
        prev?.map((l) =>
          l.id === id ? { ...updated, coffeeMeta: l.coffeeMeta } : l,
        ) ?? prev,
      );
      return true;
    } catch {
      return false;
    }
  };

  const pending = (lessons ?? []).filter((l) => l.status === "pending");
  const active = (lessons ?? []).filter(
    (l) => l.status !== "dismissed" && l.status !== "pending",
  );
  const dismissed = (lessons ?? []).filter((l) => l.status === "dismissed");
  const groupedActive: Record<Level, Lesson[]> = {
    coffee: [],
    roaster: [],
    "method-style": [],
    "process-roast": [],
  };
  for (const l of active) groupedActive[l.level].push(l);

  // Coffee level splits two ways: lessons for bags currently in rotation
  // (front-and-centre) vs lessons for archived bags (out-of-rotation,
  // collapsed into a drawer). Bags whose coffeeMeta couldn't be resolved
  // (legacy / deleted coffee row) sit in the archived bucket so they
  // don't crowd the main view — they can still be inspected.
  const coffeeInRotation = groupedActive.coffee.filter(
    (l) => l.coffeeMeta?.inRotation === true,
  );
  const coffeeArchived = groupedActive.coffee.filter(
    (l) => l.coffeeMeta?.inRotation !== true,
  );

  return (
    <div className="min-h-svh bg-transparent flex flex-col">
      {/* Header */}
      <div
        className="relative px-5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
          paddingBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back to home"
          className="text-light-muted-foreground text-sm"
        >
          ← Home
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="absolute right-5 flex h-10 w-10 items-center justify-center rounded-full bg-light-card-default/85 backdrop-blur-light-card text-light-foreground active:scale-95 transition-transform"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Hero */}
      <div className="px-5 pb-6">
        <p className="text-light-muted-foreground text-xs tracking-widest uppercase mb-2">
          Lessons
        </p>
        <h1 className="font-fraunces text-[40px] leading-[1.05] tracking-[-0.01em] text-light-foreground">
          What we&rsquo;ve learned.
        </h1>
        <p className="text-light-muted-foreground text-sm mt-3 leading-relaxed">
          Every brew adds to this. Dismiss what&rsquo;s wrong, edit what&rsquo;s
          close, confirm what BTTS got right. /recommend reads from here.
        </p>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center pb-20">
          <CoffeeBeanGlow size={64} />
        </div>
      ) : lessons!.length === 0 ? (
        <div className="px-5 py-12 text-center text-light-muted-foreground text-sm">
          No lessons yet. After your next strong-signal brew (1–2★, 4–5★, or
          one with written notes), BTTS will write the first one here.
        </div>
      ) : (
        <div className="flex-1 px-5 pb-20 space-y-10">
          {/* Pending section — pinned to the top. Visually distinct
              (dashed border on the cards) so the user knows BTTS is
              waiting on their input. Skipped entirely when empty so
              the page doesn't show a hollow "Awaiting your input (0)"
              header. */}
          {pending.length > 0 && (
            <PendingSection
              lessons={pending}
              onAnswer={handleAnswer}
              onDismiss={handleDismiss}
            />
          )}

          {LEVEL_ORDER.map((lvl) => {
            if (lvl === "coffee") {
              return (
                <CoffeeLevelSection
                  key={lvl}
                  inRotation={coffeeInRotation}
                  archived={coffeeArchived}
                  onDismiss={handleDismiss}
                  onConfirm={handleConfirm}
                  onSaveEdit={handleSaveEdit}
                />
              );
            }
            return (
              <LevelSection
                key={lvl}
                level={lvl}
                lessons={groupedActive[lvl]}
                onDismiss={handleDismiss}
                onConfirm={handleConfirm}
                onSaveEdit={handleSaveEdit}
              />
            );
          })}

          {/* Dismissed drawer */}
          {dismissed.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowDismissed((v) => !v)}
                className="text-light-muted-foreground text-xs tracking-widest uppercase mb-3 px-1"
              >
                Dismissed ({dismissed.length}) {showDismissed ? "▾" : "▸"}
              </button>
              {showDismissed && (
                <div className="space-y-3">
                  {dismissed.map((l) => (
                    <LessonCard
                      key={l.id}
                      lesson={l}
                      onDismiss={handleDismiss}
                      onRestore={handleRestore}
                      onConfirm={handleConfirm}
                      onSaveEdit={handleSaveEdit}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function CoffeeLevelSection({
  inRotation,
  archived,
  onDismiss,
  onConfirm,
  onSaveEdit,
}: {
  inRotation: Lesson[];
  archived: Lesson[];
  onDismiss: (id: string) => void;
  onConfirm: (id: string) => void;
  onSaveEdit: (id: string, content: string) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-light-muted-foreground text-xs tracking-widest uppercase">
          {LEVEL_TITLES.coffee}
        </p>
        <span className="text-light-muted-foreground/70 text-xs">
          {inRotation.length}
          {archived.length > 0 ? ` · ${archived.length} archived` : ""}
        </span>
      </div>
      <p className="text-light-muted-foreground text-xs leading-relaxed mb-3 px-1">
        {LEVEL_BLURBS.coffee} Only bags in rotation are shown by default —
        archived bags sit in the drawer below.
      </p>
      {inRotation.length === 0 ? (
        <p className="text-light-muted-foreground/70 text-sm italic px-1">
          No lessons for bags currently in rotation.
        </p>
      ) : (
        <div className="space-y-3">
          {inRotation.map((l) => (
            <LessonCard
              key={l.id}
              lesson={l}
              onDismiss={onDismiss}
              onConfirm={onConfirm}
              onSaveEdit={onSaveEdit}
            />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-light-muted-foreground text-xs tracking-widest uppercase px-1"
          >
            Archived bags ({archived.length}) {showArchived ? "▾" : "▸"}
          </button>
          {showArchived && (
            <div className="space-y-3 mt-3">
              {archived.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  onDismiss={onDismiss}
                  onConfirm={onConfirm}
                  onSaveEdit={onSaveEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LevelSection({
  level,
  lessons,
  onDismiss,
  onConfirm,
  onSaveEdit,
}: {
  level: Level;
  lessons: Lesson[];
  onDismiss: (id: string) => void;
  onConfirm: (id: string) => void;
  onSaveEdit: (id: string, content: string) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-light-muted-foreground text-xs tracking-widest uppercase">
          {LEVEL_TITLES[level]}
        </p>
        <span className="text-light-muted-foreground/70 text-xs">
          {lessons.length}
        </span>
      </div>
      <p className="text-light-muted-foreground text-xs leading-relaxed mb-3 px-1">
        {LEVEL_BLURBS[level]}
      </p>
      {lessons.length === 0 ? (
        <p className="text-light-muted-foreground/70 text-sm italic px-1">
          Nothing learned here yet.
        </p>
      ) : (
        <div className="space-y-3">
          {lessons.map((l) => (
            <LessonCard
              key={l.id}
              lesson={l}
              onDismiss={onDismiss}
              onConfirm={onConfirm}
              onSaveEdit={onSaveEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LessonCard({
  lesson,
  onDismiss,
  onRestore,
  onConfirm,
  onSaveEdit,
}: {
  lesson: Lesson;
  onDismiss: (id: string) => void;
  onRestore?: (id: string) => void;
  onConfirm: (id: string) => void;
  onSaveEdit: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.content);
  const isDismissed = lesson.status === "dismissed";

  const submitEdit = () => {
    onSaveEdit(lesson.id, draft);
    setEditing(false);
  };

  return (
    <div
      className={`rounded-2xl border border-light-foreground/15 backdrop-blur-light-card backdrop-saturate-150 px-4 py-3.5 transition-opacity ${
        isDismissed ? "bg-light-card-default/40 opacity-60" : "bg-light-card-default"
      }`}
    >
      <p className="text-light-muted-foreground text-xs mb-1.5 leading-tight">
        {/* Friendly display name for coffee-level rows when available;
            falls back to the raw scope id (e.g. "ineffable_coffee_roasters__la_coipa"
            for rows whose coffees-table join missed). */}
        {lesson.coffeeMeta
          ? `${lesson.coffeeMeta.roaster} — ${lesson.coffeeMeta.name}${lesson.coffeeMeta.inRotation ? "" : " · archived"}`
          : lesson.scope}
      </p>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-light-foreground/20 bg-transparent text-light-foreground text-sm p-2 leading-relaxed focus:outline-none focus:border-light-foreground/50"
          autoFocus
        />
      ) : (
        <p className="text-light-foreground text-sm leading-relaxed">
          {lesson.content}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-light-muted-foreground">
          <span>n={lesson.confidenceN}</span>
          <span aria-hidden>·</span>
          <SourcePill source={lesson.source} />
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(lesson.content);
                  setEditing(false);
                }}
                className="text-light-muted-foreground text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                className="rounded-full bg-light-foreground text-[hsl(36_55%_96%)] text-xs font-medium px-3 py-1.5 active:scale-[0.98] transition-transform"
              >
                Save
              </button>
            </>
          ) : isDismissed ? (
            <button
              type="button"
              onClick={() => onRestore?.(lesson.id)}
              className="text-light-foreground text-xs underline"
            >
              Restore
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onDismiss(lesson.id)}
                className="text-light-muted-foreground text-xs hover:text-[hsl(12_70%_45%)] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-light-muted-foreground text-xs hover:text-light-foreground transition-colors"
              >
                Edit
              </button>
              {lesson.source !== "user-confirmed" && lesson.source !== "user-edited" && (
                <button
                  type="button"
                  onClick={() => onConfirm(lesson.id)}
                  className="rounded-full border border-light-foreground/30 text-light-foreground text-xs px-3 py-1 active:scale-[0.98] transition-transform"
                >
                  Confirm
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: Source }) {
  const label =
    source === "user-edited"
      ? "you wrote this"
      : source === "user-confirmed"
        ? "you confirmed"
        : source === "backfill"
          ? "from history"
          : "auto";
  return <span className="text-[11px] text-light-muted-foreground">{label}</span>;
}

function PendingSection({
  lessons,
  onAnswer,
  onDismiss,
}: {
  lessons: Lesson[];
  onAnswer: (id: string, answers: LessonAnswer[]) => Promise<boolean>;
  onDismiss: (id: string) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-light-muted-foreground text-xs tracking-widest uppercase">
          Awaiting your input
        </p>
        <span className="text-light-muted-foreground/70 text-xs">
          {lessons.length}
        </span>
      </div>
      <p className="text-light-muted-foreground text-xs leading-relaxed mb-3 px-1">
        BTTS drafted these but couldn&rsquo;t commit them on its own. Your
        answer becomes the lesson and ships into /recommend.
      </p>
      <div className="space-y-3">
        {lessons.map((l) => (
          <PendingLessonCard
            key={l.id}
            lesson={l}
            onAnswer={onAnswer}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </section>
  );
}

/** A single picked answer in the card's local state. selected holds the
 * chosen prefab option; useFreeText flips to true when the user taps
 * "Other…" and starts typing. On submit one of the two is converted to
 * the API's selected / freeText fields. */
interface LocalPick {
  selected: string | null;
  freeText: string;
  useFreeText: boolean;
}

function PendingLessonCard({
  lesson,
  onAnswer,
  onDismiss,
}: {
  lesson: Lesson;
  onAnswer: (id: string, answers: LessonAnswer[]) => Promise<boolean>;
  onDismiss: (id: string) => void;
}) {
  const questions = lesson.questions ?? [];
  const [picks, setPicks] = useState<Record<string, LocalPick>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        { selected: null, freeText: "", useFreeText: false },
      ]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const setPick = (qid: string, patch: Partial<LocalPick>) =>
    setPicks((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));

  const allAnswered = questions.every((q) => {
    const p = picks[q.id];
    if (!p) return false;
    return p.useFreeText ? p.freeText.trim().length > 0 : p.selected != null;
  });

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(false);
    const answers: LessonAnswer[] = questions.map((q) => {
      const p = picks[q.id];
      return {
        questionId: q.id,
        selected: p.useFreeText ? null : p.selected,
        freeText: p.useFreeText ? p.freeText.trim() : null,
      };
    });
    const ok = await onAnswer(lesson.id, answers);
    if (!ok) {
      setSubmitting(false);
      setError(true);
    }
    // On success the parent replaces this lesson in state, so this
    // component unmounts — no need to clear submitting locally.
  };

  return (
    <div className="rounded-2xl border border-dashed border-light-foreground/40 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3.5">
      <p className="text-light-muted-foreground text-xs mb-1.5 leading-tight">
        {lesson.coffeeMeta
          ? `${lesson.coffeeMeta.roaster} — ${lesson.coffeeMeta.name}${lesson.coffeeMeta.inRotation ? "" : " · archived"}`
          : lesson.scope}
      </p>

      {/* Draft — italic + muted so it reads as provisional. */}
      <p className="text-light-foreground/75 text-sm leading-relaxed italic mb-3">
        Draft: {lesson.content}
      </p>

      {/* Questions stack. Each renders prompt + prefab buttons + Other
          affordance. Submit enables when every question has an answer. */}
      <div className="space-y-4">
        {questions.map((q) => {
          const p = picks[q.id];
          return (
            <div key={q.id}>
              <p className="text-light-foreground text-sm leading-snug mb-2">
                {q.prompt}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSelected = !p?.useFreeText && p?.selected === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setPick(q.id, {
                          selected: opt,
                          useFreeText: false,
                          freeText: "",
                        })
                      }
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 border transition-all ${
                        isSelected
                          ? "bg-light-foreground text-[hsl(36_55%_96%)] border-light-foreground"
                          : "bg-light-card-default text-light-foreground border-light-foreground/15"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                {p?.useFreeText ? (
                  <input
                    type="text"
                    value={p.freeText}
                    onChange={(e) =>
                      setPick(q.id, { freeText: e.target.value })
                    }
                    onBlur={() => {
                      // Treat an empty Other field as "I changed my mind" —
                      // collapse back to button row so allAnswered re-checks.
                      if (p.freeText.trim() === "") {
                        setPick(q.id, { useFreeText: false });
                      }
                    }}
                    placeholder="Tell BTTS in your own words…"
                    autoFocus
                    className="flex-1 min-w-[180px] rounded-full border border-light-foreground/30 bg-transparent text-light-foreground text-[12px] px-3 py-1.5 focus:outline-none focus:border-light-foreground/60"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPick(q.id, { useFreeText: true, selected: null })
                    }
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight border border-dashed border-light-foreground/40 text-light-muted-foreground"
                  >
                    Other…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-light-muted-foreground">
          <span>n={lesson.confidenceN}</span>
          <span aria-hidden>·</span>
          <span>awaiting answer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDismiss(lesson.id)}
            disabled={submitting}
            className="text-light-muted-foreground text-xs hover:text-[hsl(12_70%_45%)] transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="rounded-full bg-light-foreground text-[hsl(36_55%_96%)] text-xs font-medium px-3 py-1.5 active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {submitting ? "Working…" : "Submit"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-[hsl(12_70%_45%)] mt-2">
          Couldn&rsquo;t finalise. Tap Submit to retry.
        </p>
      )}
    </div>
  );
}
