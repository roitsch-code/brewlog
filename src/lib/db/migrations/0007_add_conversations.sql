-- BTTS Home conversation persistence per specs/home.md §10.
--
-- Two tables: `conversations` for thread metadata + idle-window state,
-- `conversation_messages` for the per-turn content (text + optional
-- image URL + optional coffee reference + optional Action Pills).
--
-- Run once on the VPS after the next deploy:
--   cat src/lib/db/migrations/0007_add_conversations.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  first_user_message text
);

CREATE INDEX IF NOT EXISTS conversations_archived_at_idx
  ON conversations (archived_at);

CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx
  ON conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  coffee_ref_id text,
  coffee_ref_roaster text,
  coffee_ref_name text,
  actions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_id_idx
  ON conversation_messages (conversation_id);

CREATE INDEX IF NOT EXISTS conversation_messages_created_at_idx
  ON conversation_messages (created_at);
