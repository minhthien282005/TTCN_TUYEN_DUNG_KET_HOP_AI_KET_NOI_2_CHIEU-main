-- PostgreSQL reference schema for Sprint 6. The local prototype persists these records in data/db.json.
CREATE TABLE IF NOT EXISTS sprint6_invitations (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  message VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','accepted','declined','expired','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sprint6_invites_inbox_idx ON sprint6_invitations(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS sprint6_invites_sender_idx ON sprint6_invitations(employer_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sprint6_interests (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  message VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','accepted','declined','expired','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sprint6_interests_inbox_idx ON sprint6_interests(employer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS sprint6_interests_sender_idx ON sprint6_interests(student_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sprint6_matches (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES sprint6_invitations(id) ON DELETE SET NULL,
  interest_id UUID REFERENCES sprint6_interests(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(student_id, employer_id, job_id)
);

CREATE TABLE IF NOT EXISTS sprint6_conversations (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL UNIQUE REFERENCES sprint6_matches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ,
  student_read_at TIMESTAMPTZ,
  employer_read_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sprint6_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES sprint6_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(2000) NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sprint6_messages_history_idx ON sprint6_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS sprint6_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(blocker_id, blocked_id),
  CHECK(blocker_id <> blocked_id)
);
