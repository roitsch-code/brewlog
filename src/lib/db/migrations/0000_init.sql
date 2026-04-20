CREATE TABLE IF NOT EXISTS "auth_challenges" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffees" (
	"id" text PRIMARY KEY NOT NULL,
	"roaster" text NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"process" text NOT NULL,
	"fermentation_style" text,
	"cupping_score" numeric,
	"first_seen_at" text NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"session_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"best_method" text,
	"avg_rating" numeric,
	"rating_sum" numeric,
	"rating_count" integer,
	"bag_photo_url" text,
	"latest_roast_date" text,
	"written_summary" text,
	"last_summarized_at" text,
	"common_notes" jsonb,
	"personal_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge" (
	"kind" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preferences" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roasters" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"style_summary" text,
	"confidence" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_at_ms" bigint NOT NULL,
	"coffee" jsonb NOT NULL,
	"place" jsonb,
	"context" jsonb,
	"recommendation" jsonb,
	"brew" jsonb,
	"result" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roasters_aliases_gin_idx" ON "roasters" USING gin ("aliases");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_created_at_ms_idx" ON "sessions" USING btree ("created_at_ms" DESC NULLS LAST);