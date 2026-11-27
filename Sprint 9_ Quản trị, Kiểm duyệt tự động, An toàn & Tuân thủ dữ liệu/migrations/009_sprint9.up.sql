-- Reference schema. Runtime prototype data is currently persisted in data/db.json.
BEGIN;
CREATE TABLE job_moderation_assessments (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  engine_version text NOT NULL,
  source_hash char(64) NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'review', 'high')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  human_review_required boolean NOT NULL DEFAULT false,
  assessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_moderation_risk_queue_idx ON job_moderation_assessments(risk_level, score DESC, assessed_at DESC) WHERE human_review_required = true;
CREATE INDEX job_moderation_job_history_idx ON job_moderation_assessments(job_id, assessed_at DESC);
COMMIT;
