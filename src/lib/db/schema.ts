import {
  pgTable,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  numeric,
  serial,
  index,
} from "drizzle-orm/pg-core";
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
  personalNotes: text("personal_notes"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type CoffeeRow = typeof coffees.$inferSelect;
export type NewCoffeeRow = typeof coffees.$inferInsert;
export type PlaceRow = typeof places.$inferSelect;
