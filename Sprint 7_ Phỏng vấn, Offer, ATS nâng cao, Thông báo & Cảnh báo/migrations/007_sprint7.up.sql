-- PostgreSQL reference schema. The current local prototype stores Sprint 7 records in data/db.json.
BEGIN;

CREATE TABLE sprint7_interviews (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  organizer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  duration_minutes smallint NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  mode text NOT NULL CHECK (mode IN ('online','onsite','phone')),
  location text NOT NULL DEFAULT '',
  meeting_url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('proposed','confirmed','declined','cancelled','completed')),
  response_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sprint7_interviews_application_idx ON sprint7_interviews(application_id, starts_at DESC);
CREATE INDEX sprint7_interviews_reminder_idx ON sprint7_interviews(starts_at) WHERE status = 'confirmed';

CREATE TABLE sprint7_offers (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  salary_min numeric(14,2) NOT NULL CHECK (salary_min >= 0),
  salary_max numeric(14,2) NOT NULL CHECK (salary_max >= salary_min),
  currency char(3) NOT NULL DEFAULT 'VND',
  employment_type text NOT NULL DEFAULT '',
  start_date date,
  terms text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','expired','withdrawn')),
  response_note text NOT NULL DEFAULT '',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sprint7_offers_application_idx ON sprint7_offers(application_id, created_at DESC);
CREATE UNIQUE INDEX sprint7_one_pending_offer_per_application ON sprint7_offers(application_id) WHERE status = 'pending';

CREATE TABLE sprint7_application_timeline (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sprint7_timeline_history_idx ON sprint7_application_timeline(application_id, created_at DESC);
COMMIT;
