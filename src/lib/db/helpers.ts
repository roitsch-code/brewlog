import type { Coffee } from "@/lib/types/coffee";
import type { Session } from "@/lib/types/session";
import { coffees, sessions } from "@/lib/db/schema";

export function rowToCoffee(r: typeof coffees.$inferSelect): Coffee {
  return {
    id: r.id,
    roaster: r.roaster,
    name: r.name,
    origin: r.origin,
    process: r.process,
    firstSeenAt: r.firstSeenAt,
    sessionCount: r.sessionCount,
    sessionIds: r.sessionIds ?? [],
    bestMethod: r.bestMethod ?? undefined,
    avgRating: r.avgRating != null ? Number(r.avgRating) : undefined,
    ratingSum: r.ratingSum != null ? Number(r.ratingSum) : undefined,
    ratingCount: r.ratingCount ?? undefined,
    bagPhotoUrl: r.bagPhotoUrl ?? undefined,
    latestRoastDate: r.latestRoastDate ?? undefined,
    writtenSummary: r.writtenSummary ?? undefined,
    lastSummarizedAt: r.lastSummarizedAt ?? undefined,
    commonNotes: r.commonNotes ?? undefined,
    personalNotes: r.personalNotes ?? undefined,
  };
}

export function rowToSession(row: typeof sessions.$inferSelect): Session {
  return {
    id: row.id,
    type: row.type,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
    coffee: row.coffee,
    place: row.place ?? undefined,
    context: row.context ?? undefined,
    recommendation: row.recommendation ?? undefined,
    brew: row.brew ?? undefined,
    result: row.result ?? undefined,
  };
}
