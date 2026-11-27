-- Reference schema. Runtime prototype currently persists data in data/db.json.
BEGIN;
CREATE TABLE recommendation_feedback (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_role text NOT NULL CHECK (actor_role IN ('student', 'employer')),
  recommendation_key text NOT NULL,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  value text NOT NULL CHECK (value IN ('relevant', 'not_relevant')),
  feature_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, actor_role, recommendation_key)
);
CREATE INDEX recommendation_feedback_actor_time_idx ON recommendation_feedback(actor_user_id, updated_at DESC);
CREATE INDEX recommendation_feedback_job_idx ON recommendation_feedback(job_id, value, updated_at DESC);
COMMIT;
