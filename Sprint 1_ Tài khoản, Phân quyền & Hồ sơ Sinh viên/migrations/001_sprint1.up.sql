-- PostgreSQL target schema for production/staging. Local prototype uses data/db.json.
BEGIN;
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'employer')),
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_active_uq ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_expiry_idx ON sessions (user_id, expires_at);
CREATE TABLE account_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user_purpose_idx ON account_tokens (user_id, purpose, expires_at);
CREATE TABLE consents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  version text NOT NULL,
  granted boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_user_time_idx ON consents (user_id, recorded_at DESC);
CREATE TABLE reference_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_type text NOT NULL CHECK (category_type IN ('industry', 'school', 'location')),
  canonical_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (category_type, canonical_name)
);
INSERT INTO reference_categories (category_type, canonical_name) VALUES
  ('industry', 'Công nghệ thông tin'), ('industry', 'Tài chính - Ngân hàng'), ('industry', 'Marketing'), ('industry', 'Thiết kế'), ('industry', 'Kinh doanh'), ('industry', 'Giáo dục'), ('industry', 'Kỹ thuật'),
  ('school', 'Đại học Bách khoa Hà Nội'), ('school', 'Đại học Công nghệ - ĐHQGHN'), ('school', 'Đại học Kinh tế Quốc dân'), ('school', 'Đại học Bách khoa TP.HCM'), ('school', 'Đại học FPT'), ('school', 'Khác'),
  ('location', 'Hà Nội'), ('location', 'TP. Hồ Chí Minh'), ('location', 'Đà Nẵng'), ('location', 'Cần Thơ'), ('location', 'Remote');
CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  industry text,
  school text,
  major text,
  grad_year smallint CHECK (grad_year IS NULL OR grad_year BETWEEN 1950 AND 2200),
  gpa numeric(4,2) CHECK (gpa IS NULL OR gpa BETWEEN 0 AND 4),
  location text,
  bio text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'invited', 'public')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE student_preferences (
  student_id uuid PRIMARY KEY REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  desired_roles jsonb NOT NULL DEFAULT '[]',
  job_types jsonb NOT NULL DEFAULT '[]',
  locations jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE student_education (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  details jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_education_owner_idx ON student_education (student_id, position);
CREATE TABLE student_experiences (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  details jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_experiences_owner_idx ON student_experiences (student_id, position);
CREATE TABLE student_projects (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  details jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_projects_owner_idx ON student_projects (student_id, position);
CREATE TABLE student_languages (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  details jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX student_languages_owner_idx ON student_languages (student_id, position);
CREATE TABLE skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_name text NOT NULL UNIQUE,
  aliases jsonb NOT NULL DEFAULT '[]',
  skill_group text NOT NULL
);
CREATE TABLE student_skills (
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (student_id, skill_id)
);
INSERT INTO skills (canonical_name, aliases, skill_group) VALUES
  ('JavaScript', '["js", "ecmascript"]', 'Programming'),
  ('TypeScript', '["ts"]', 'Programming'),
  ('React', '["react.js", "reactjs"]', 'Frontend'),
  ('Node.js', '["node", "nodejs"]', 'Backend'),
  ('Python', '["py"]', 'Programming'),
  ('Java', '[]', 'Programming'),
  ('SQL', '["structured query language"]', 'Data'),
  ('Figma', '[]', 'Design'),
  ('Giao tiếp', '["communication", "kỹ năng giao tiếp"]', 'Soft skills'),
  ('Phân tích dữ liệu', '["data analysis", "data analytics"]', 'Data'),
  ('Git', '["git version control"]', 'Tools');
CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_time_idx ON audit_events (actor_user_id, created_at DESC);
COMMIT;
