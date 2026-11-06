BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Remove or reassign admin users before rolling back Sprint 2 role support.';
  END IF;
END $$;

DROP TABLE IF EXISTS job_moderation_events;
DROP TABLE IF EXISTS job_reports;
DROP TABLE IF EXISTS job_views;
DROP TABLE IF EXISTS job_saved;
DROP TABLE IF EXISTS jobs;
DROP FUNCTION IF EXISTS jobs_search_vector_update();
DROP TABLE IF EXISTS company_documents;
DROP TABLE IF EXISTS companies;
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'employer'));
ALTER TABLE users DROP COLUMN IF EXISTS locked_at;
ALTER TABLE users DROP COLUMN IF EXISTS blocked_company_ids;

COMMIT;
