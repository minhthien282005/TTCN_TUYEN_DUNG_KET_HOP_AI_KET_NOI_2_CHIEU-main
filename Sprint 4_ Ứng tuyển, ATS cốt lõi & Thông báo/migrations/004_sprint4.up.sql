-- PostgreSQL target schema. The current local prototype uses data/db.json.
BEGIN;

ALTER TABLE companies ADD COLUMN application_stages jsonb NOT NULL DEFAULT '[{"key":"submitted","label":"Mới nộp"},{"key":"viewed","label":"Đã xem"},{"key":"screening","label":"Sàng lọc"},{"key":"interview","label":"Phỏng vấn"},{"key":"offered","label":"Đề nghị"},{"key":"hired","label":"Tuyển dụng"}]'::jsonb CHECK (jsonb_typeof(application_stages) = 'array');

CREATE TABLE application_screening_questions (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 5 AND 300),
  question_type text NOT NULL CHECK (question_type IN ('text', 'single_choice', 'boolean')),
  options jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(options) = 'array'),
  is_required boolean NOT NULL DEFAULT true,
  is_knockout boolean NOT NULL DEFAULT false,
  expected_answer text,
  position smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 9),
  CHECK (NOT is_knockout OR (question_type <> 'text' AND expected_answer IS NOT NULL))
);
CREATE INDEX application_questions_job_idx ON application_screening_questions(job_id, position);

CREATE TABLE applications (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_id uuid REFERENCES student_cvs(id) ON DELETE SET NULL,
  cover_letter text NOT NULL DEFAULT '' CHECK (length(cover_letter) <= 3000),
  portfolio_links jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(portfolio_links) = 'array'),
  screening_answers jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(screening_answers) = 'array'),
  status text NOT NULL CHECK (status IN ('submitted', 'viewed', 'screening', 'interview', 'offered', 'hired', 'rejected', 'withdrawn')),
  score smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  matched_skills jsonb NOT NULL DEFAULT '[]',
  missing_skills jsonb NOT NULL DEFAULT '[]',
  rejection_reason text NOT NULL DEFAULT '',
  rejection_note text NOT NULL DEFAULT '',
  withdraw_reason text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  UNIQUE (job_id, student_id)
);
CREATE INDEX applications_student_time_idx ON applications(student_id, created_at DESC);
CREATE INDEX applications_company_job_stage_idx ON applications(company_id, job_id, status, created_at DESC);
CREATE INDEX applications_score_idx ON applications(job_id, score DESC, created_at DESC);

CREATE TABLE application_idempotency (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  request_hash char(64) NOT NULL,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, idempotency_key)
);

CREATE TABLE application_stage_logs (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_stage text,
  to_stage text NOT NULL,
  action text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_stage_logs_history_idx ON application_stage_logs(application_id, created_at);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL CHECK (length(title) <= 140),
  message text NOT NULL CHECK (length(message) <= 500),
  href text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'retry_wait', 'sent', 'skipped', 'failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_queue_idx ON email_outbox(status, next_attempt_at, created_at) WHERE status IN ('queued', 'retry_wait');

COMMIT;
