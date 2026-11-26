-- PostgreSQL reference schema. Current local prototype persists these records in data/db.json.
BEGIN;
CREATE TABLE sprint8_coach_roadmaps (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  roadmap jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sprint8_roadmaps_user_idx ON sprint8_coach_roadmaps(user_id, updated_at DESC);

CREATE TABLE sprint8_practice_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  target text NOT NULL,
  questions jsonb NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('in_progress','completed')),
  score smallint CHECK (score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sprint8_sessions_user_idx ON sprint8_practice_sessions(user_id, updated_at DESC);
COMMIT;
