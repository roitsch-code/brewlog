import {
  pgTable,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  numeric,
  serial,
  boolean,
  doublePrecision,
  index,
  uuid,
} from "drizzle-orm/pg-core";
// NavAction shape is mirrored here as a structural type so this schema
// module stays free of API-route imports. Keep in sync with
// src/app/api/explore-agent/route.ts.
interface NavAction {
  destination: string;
  label: string;
  reason?: string;
  id?: string;
}
import type {
  CoffeeIdentity,
  SessionContext,
  Recommendation,
  BrewLog,
  TasteResult,
  ExternalPlace,
  SessionMode,
  SessionType,
} from "@/lib/types/session";

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    type: text("type").$type<SessionType>().notNull(),
    mode: text("mode").$type<SessionMode>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    coffee: jsonb("coffee").$type<CoffeeIdentity>().notNull(),
    place: jsonb("place").$type<ExternalPlace>(),
    context: jsonb("context").$type<SessionContext>(),
    recommendation: jsonb("recommendation").$type<Recommendation>(),
    brew: jsonb("brew").$type<BrewLog>(),
    result: jsonb("result").$type<TasteResult>(),
  },
  (t) => ({
    createdAtMsIdx: index("sessions_created_at_ms_idx").on(t.createdAtMs.desc()),
  })
);

export const coffees = pgTable("coffees", {
  id: text("id").primaryKey(),
  roaster: text("roaster").notNull(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  process: text("process").notNull(),
  fermentationStyle: text("fermentation_style"),
  cuppingScore: numeric("cupping_score"),
  firstSeenAt: text("first_seen_at").notNull(),
  sessionCount: integer("session_count").notNull().default(0),
  sessionIds: jsonb("session_ids").$type<string[]>().notNull().default([]),
  bestMethod: text("best_method"),
  avgRating: numeric("avg_rating"),
  ratingSum: numeric("rating_sum"),
  ratingCount: integer("rating_count"),
  bagPhotoUrl: text("bag_photo_url"),
  latestRoastDate: text("latest_roast_date"),
  writtenSummary: text("written_summary"),
  lastSummarizedAt: text("last_summarized_at"),
  commonNotes: jsonb("common_notes").$type<string[]>(),
  whatToExplore: text("what_to_explore"),
  personalNotes: text("personal_notes"),
  // Generative Field v1.1 — perceptual Field composition for this coffee
  // (see specs/design-system-v1.1-generative-field.md §10). Computed once
  // per coffee from tasting notes by Haiku; null until first mapped.
  // Shape: src/lib/field/types.ts FieldZones.
  fieldZones: jsonb("field_zones"),
  // User-marked "currently in rotation" flag. Surfaced in the
  // /api/greeting library snapshot so the daily Haiku starter
  // prioritises rotation bags. Toggled from /coffees/[id].
  inRotation: boolean("in_rotation").notNull().default(false),
});

// "I've been here" — visit-only café record without a brew session.
// rating is intentionally binary ('come-back' | 'wont-return') since
// there's no brew context for a star rating. See migration 0011.
export const cafeVisits = pgTable("cafe_visits", {
  id: text("id").primaryKey(),
  cafeName: text("cafe_name").notNull(),
  location: text("location"),
  rating: text("rating").$type<"come-back" | "wont-return">().notNull(),
  notes: text("notes"),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
  visitedAtMs: bigint("visited_at_ms", { mode: "number" }).notNull(),
});

export const preferences = pgTable("preferences", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
});

export const authCredentials = pgTable("auth_credentials", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authChallenges = pgTable("auth_challenges", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roasters = pgTable(
  "roasters",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    region: text("region"),
    styleSummary: text("style_summary"),
    confidence: text("confidence"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    data: jsonb("data").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    aliasesIdx: index("roasters_aliases_gin_idx").using("gin", t.aliases),
  })
);

export const knowledge = pgTable("knowledge", {
  kind: text("kind").primaryKey(),
  data: jsonb("data").notNull(),
});

export const coffeeAlerts = pgTable("coffee_alerts", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const places = pgTable("places", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  address:   text("address"),
  city:      text("city").notNull(),
  lat:       doublePrecision("lat"),
  lng:       doublePrecision("lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// BTTS Home conversation persistence — specs/home.md §10.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    firstUserMessage: text("first_user_message"),
  },
  (t) => ({
    archivedAtIdx: index("conversations_archived_at_idx").on(t.archivedAt),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(t.lastMessageAt.desc()),
  })
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    imageUrl: text("image_url"),
    coffeeRefId: text("coffee_ref_id"),
    coffeeRefRoaster: text("coffee_ref_roaster"),
    coffeeRefName: text("coffee_ref_name"),
    actions: jsonb("actions").$type<NavAction[] | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convIdIdx: index("conversation_messages_conversation_id_idx").on(t.conversationId),
    createdAtIdx: index("conversation_messages_created_at_idx").on(t.createdAt),
  })
);

// The legacy `lessons` table (migrations 0012 + 0013) remains in the
// production database for archival purposes (non-destructive removal)
// but no code reads or writes it any more — the multivariate coach
// (insights table below) replaced it.

// Multivariate coach memory — replaces the lessons table for the
// surfaces that need cross-axis observations. See migration 0013.
export type InsightSource = "opus" | "user-confirmed";

export const insights = pgTable(
  "insights",
  {
    id: text("id").primaryKey(),
    observation: text("observation").notNull(),
    suggestion: text("suggestion").notNull(),
    citationFields: jsonb("citation_fields").$type<string[]>().notNull().default([]),
    latestSessionMs: bigint("latest_session_ms", { mode: "number" }).notNull(),
    source: text("source").$type<InsightSource>().notNull().default("opus"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    userNote: text("user_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    latestSessionMsIdx: index("insights_latest_session_ms_idx").on(t.latestSessionMs.desc()),
    dismissedAtIdx: index("insights_dismissed_at_idx").on(t.dismissedAt),
    createdAtIdx: index("insights_created_at_idx").on(t.createdAt.desc()),
  })
);

export type InsightRow = typeof insights.$inferSelect;
export type NewInsightRow = typeof insights.$inferInsert;

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type CoffeeRow = typeof coffees.$inferSelect;
export type NewCoffeeRow = typeof coffees.$inferInsert;
export type PlaceRow = typeof places.$inferSelect;
