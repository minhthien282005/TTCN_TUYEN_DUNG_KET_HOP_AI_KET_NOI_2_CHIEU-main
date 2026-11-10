-- Target schema for PostgreSQL. The current prototype still persists runtime data in data/db.json.
BEGIN;
CREATE TABLE IF NOT EXISTS match_notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  pair_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pair_key)
);

CREATE INDEX IF NOT EXISTS idx_jobs_published_expiry ON jobs (status, expires_at) WHERE status = 'published';
COMMIT;
-- Note: Sprint 5 update date 10/11/2026.
