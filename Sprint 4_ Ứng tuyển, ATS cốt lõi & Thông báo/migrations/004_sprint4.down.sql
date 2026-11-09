BEGIN;
DROP TABLE IF EXISTS email_outbox;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS application_stage_logs;
DROP TABLE IF EXISTS application_idempotency;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS application_screening_questions;
ALTER TABLE companies DROP COLUMN IF EXISTS application_stages;
COMMIT;
