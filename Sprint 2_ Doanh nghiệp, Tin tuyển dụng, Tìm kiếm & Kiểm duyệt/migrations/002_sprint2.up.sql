-- PostgreSQL production target. Runtime prototype currently uses data/db.json.
BEGIN;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'employer', 'admin'));
ALTER TABLE users ADD COLUMN locked_at timestamptz;
ALTER TABLE users ADD COLUMN blocked_company_ids jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocked_company_ids) = 'array');

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) >= 2),
  slug text NOT NULL UNIQUE,
  website text,
  tax_id text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  branches jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(branches) = 'array'),
  culture text NOT NULL DEFAULT '',
  benefits jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(benefits) = 'array'),
  socials jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(socials) = 'array'),
  media_urls jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(media_urls) = 'array'),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected', 'needs_more')),
  verification_note text NOT NULL DEFAULT '',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_user_id)
);

CREATE TABLE company_documents (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  sha256 text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  scan_status text NOT NULL CHECK (scan_status IN ('clean', 'infected', 'failed')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_documents_company_time_idx ON company_documents (company_id, uploaded_at DESC);

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) >= 4),
  slug text NOT NULL,
  description text NOT NULL CHECK (length(btrim(description)) >= 30),
  requirements text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '',
  recruitment_process text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT '',
  experience text NOT NULL DEFAULT '',
  languages text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  headcount integer NOT NULL DEFAULT 1 CHECK (headcount BETWEEN 1 AND 1000),
  job_type text NOT NULL CHECK (job_type IN ('Thực tập', 'Toàn thời gian', 'Bán thời gian', 'Freelance', 'Hợp đồng')),
  work_mode text NOT NULL CHECK (work_mode IN ('Tại văn phòng', 'Kết hợp', 'Từ xa')),
  salary_min numeric(14, 0) CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max numeric(14, 0) CHECK (salary_max IS NULL OR salary_max >= 0),
  skills jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(skills) = 'array'),
  criteria_weights jsonb NOT NULL DEFAULT '{"skills":60,"education":15,"experience":15,"languages":5,"projects":5}' CHECK (jsonb_typeof(criteria_weights) = 'object'),
  status text NOT NULL CHECK (status IN ('draft', 'pending_review', 'published', 'paused', 'expired', 'closed', 'rejected', 'needs_changes', 'archived')),
  moderation_note text NOT NULL DEFAULT '',
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  expires_at timestamptz,
  FOREIGN KEY (company_id, owner_user_id) REFERENCES companies(id, owner_user_id) ON DELETE RESTRICT,
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
  CHECK (status IN ('draft', 'closed', 'archived') OR expires_at IS NOT NULL),
  UNIQUE (company_id, slug)
);

CREATE FUNCTION jobs_search_vector_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.industry, '') || ' ' || coalesce(NEW.location, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.description, '') || ' ' || coalesce(NEW.requirements, ''))), 'C');
  RETURN NEW;
END $$;
CREATE TRIGGER jobs_search_vector_update BEFORE INSERT OR UPDATE OF title, industry, location, description, requirements ON jobs FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();
CREATE INDEX jobs_search_vector_idx ON jobs USING gin (search_vector);
CREATE INDEX jobs_title_trgm_idx ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX jobs_public_search_idx ON jobs (status, published_at DESC) WHERE status = 'published';
CREATE INDEX jobs_expiry_idx ON jobs (expires_at) WHERE status = 'published' AND expires_at IS NOT NULL;
CREATE INDEX jobs_owner_updated_idx ON jobs (owner_user_id, updated_at DESC);
CREATE INDEX jobs_review_queue_idx ON jobs (created_at) WHERE status = 'pending_review';

CREATE TABLE job_saved (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  group_name text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX job_saved_user_time_idx ON job_saved (user_id, saved_at DESC);

CREATE TABLE job_views (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id, viewed_at)
);
CREATE INDEX job_views_user_time_idx ON job_views (user_id, viewed_at DESC);

CREATE TABLE job_reports (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  status text NOT NULL CHECK (status IN ('pending', 'dismissed', 'actioned')),
  resolution text NOT NULL DEFAULT '',
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX job_reports_queue_idx ON job_reports (created_at) WHERE status = 'pending';

CREATE TABLE job_moderation_events (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes', 'remove')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action = 'approve' OR length(btrim(note)) >= 5)
);
CREATE INDEX job_moderation_events_job_time_idx ON job_moderation_events (job_id, created_at DESC);

COMMIT;
