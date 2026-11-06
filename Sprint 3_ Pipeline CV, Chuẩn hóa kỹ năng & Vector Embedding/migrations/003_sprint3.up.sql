-- PostgreSQL/pgvector target schema. The current app runtime uses data/db.json.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE student_cvs (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  storage_key text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL,
  scan_status text NOT NULL CHECK (scan_status IN ('clean', 'infected', 'failed')),
  parse_status text NOT NULL CHECK (parse_status IN ('queued', 'processing', 'retry_wait', 'review', 'confirmed', 'failed')),
  parse_attempts smallint NOT NULL DEFAULT 0 CHECK (parse_attempts BETWEEN 0 AND 3),
  next_attempt_at timestamptz,
  parse_result jsonb,
  parse_error text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE UNIQUE INDEX student_cvs_one_default_uq ON student_cvs (student_id) WHERE is_default;
CREATE INDEX student_cvs_queue_idx ON student_cvs (parse_status, next_attempt_at, created_at) WHERE parse_status IN ('queued', 'retry_wait');
CREATE INDEX student_cvs_owner_idx ON student_cvs (student_id, created_at DESC);

CREATE TABLE student_certifications (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  issuing_organization text NOT NULL DEFAULT '',
  issued_on date,
  expires_on date,
  credential_id text NOT NULL DEFAULT '',
  verification_url text,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_certifications_owner_idx ON student_certifications (student_id, position);

CREATE TABLE student_activities (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  started_on date,
  ended_on date,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_activities_owner_idx ON student_activities (student_id, position);

CREATE TABLE student_external_links (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL CHECK (url ~ '^https://'),
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_external_links_owner_idx ON student_external_links (student_id, position);

CREATE TABLE entity_embeddings (
  entity_kind text NOT NULL CHECK (entity_kind IN ('student_profile', 'job')),
  entity_id uuid NOT NULL,
  model text NOT NULL,
  dimensions smallint NOT NULL CHECK (dimensions = 128),
  source_hash char(64) NOT NULL,
  embedding vector(128) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_kind, entity_id, model)
);
CREATE INDEX entity_embeddings_student_hnsw_idx ON entity_embeddings USING hnsw (embedding vector_cosine_ops) WHERE entity_kind = 'student_profile';
CREATE INDEX entity_embeddings_job_hnsw_idx ON entity_embeddings USING hnsw (embedding vector_cosine_ops) WHERE entity_kind = 'job';

-- Durable queue schema for the future PostgreSQL worker; local prototype uses db.json.
CREATE TABLE embedding_jobs (
  id uuid PRIMARY KEY,
  entity_kind text NOT NULL CHECK (entity_kind IN ('student_profile', 'job')),
  entity_id uuid NOT NULL,
  model text NOT NULL,
  source_hash char(64) NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'retry_wait', 'completed', 'failed', 'superseded')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  next_attempt_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_kind, entity_id, model, source_hash)
);
CREATE INDEX embedding_jobs_queue_idx ON embedding_jobs (status, next_attempt_at, created_at) WHERE status IN ('queued', 'retry_wait');
COMMIT;
