import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees } from "@/lib/db/schema";

export interface CompactCoffee {
  id: string;
  roaster: string;
  name: string;
  origin: string;
  process: string;
  latestRoastDate?: string;
  firstSeenAt: string;
  sessionCount: number;
  avgRating?: number;
  /** Top tasted notes across this user's sessions for this coffee (refreshed weekly by /api/coffees/compact). */
  commonNotes?: string[];
  /** 2–4 sentence AI brew memory generated weekly by /api/coffees/compact. */
  writtenSummary?: string;
  /** User-marked "currently in rotation". /api/greeting prioritises
   * rotation bags in the library snapshot. */
  inRotation?: boolean;
}

type CoffeeRow = typeof coffees.$inferSelect;

function rowToCompact(r: CoffeeRow): CompactCoffee {
  return {
    id: r.id,
    roaster: r.roaster,
    name: r.name,
    origin: r.origin,
    process: r.process,
    latestRoastDate: r.latestRoastDate ?? undefined,
    firstSeenAt: r.firstSeenAt,
    sessionCount: r.sessionCount,
    avgRating: r.avgRating != null ? Number(r.avgRating) : undefined,
    commonNotes:
      Array.isArray(r.commonNotes) && r.commonNotes.length > 0
        ? r.commonNotes
        : undefined,
    writtenSummary: r.writtenSummary ?? undefined,
    inRotation: r.inRotation ?? false,
  };
}

export async function loadCoffeeLibraryCompact(limit = 30): Promise<CompactCoffee[]> {
  try {
    const rows = await db
      .select()
      .from(coffees)
      .orderBy(desc(coffees.firstSeenAt))
      .limit(limit);
    return rows.map(rowToCompact);
  } catch (err) {
    console.error("loadCoffeeLibraryCompact error:", err);
    return [];
  }
}

/**
 * The bags the user has explicitly marked ★ in rotation (in_rotation = true).
 * This is the real "what's on the counter right now" set — NOT a recency proxy.
 * The greeting + home chat must use this so an older-but-still-open bag (e.g. a
 * coffee roasted weeks ago with many brews) is never dropped just because newer
 * bags were added after it. Returns [] if nothing is marked.
 */
export async function loadRotationCoffees(limit = 12): Promise<CompactCoffee[]> {
  try {
    const rows = await db
      .select()
      .from(coffees)
      .where(eq(coffees.inRotation, true))
      .orderBy(desc(coffees.firstSeenAt))
      .limit(limit);
    return rows.map(rowToCompact);
  } catch (err) {
    console.error("loadRotationCoffees error:", err);
    return [];
  }
}

function relativeRoastDate(iso: string | undefined): string {
  if (!iso) return "roast date unknown";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "roast date unknown";
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "roasted today";
  if (days === 1) return "roasted 1d ago";
  if (days < 14) return `roasted ${days}d ago`;
  if (days < 60) return `roasted ${Math.round(days / 7)}w ago`;
  return `roasted ${Math.round(days / 30)}mo ago`;
}

export function formatLibraryForPrompt(library: CompactCoffee[]): string {
  if (library.length === 0) return "";
  return library
    .map((c) => {
      const usage =
        c.avgRating != null && c.sessionCount > 0
          ? `${c.avgRating.toFixed(1)}★ over ${c.sessionCount}`
          : c.sessionCount > 0
            ? `${c.sessionCount} sessions`
            : "unbrewed";
      const rotationMark = c.inRotation ? "★ IN ROTATION | " : "";
      const headline = `- ${rotationMark}${c.roaster} — ${c.name} | ${c.origin} ${c.process} | ${relativeRoastDate(c.latestRoastDate)} | ${usage}`;
      // Tasting history (only present after the weekly cron has summarised
      // at least 2 sessions of this coffee — see /api/coffees/compact).
      const tastingLine =
        c.commonNotes && c.commonNotes.length > 0
          ? `\n    Notes you taste: ${c.commonNotes.join(", ")}`
          : "";
      const summaryLine = c.writtenSummary
        ? `\n    Brew memory: ${c.writtenSummary}`
        : "";
      return `${headline}${tastingLine}${summaryLine}`;
    })
    .join("\n");
}
