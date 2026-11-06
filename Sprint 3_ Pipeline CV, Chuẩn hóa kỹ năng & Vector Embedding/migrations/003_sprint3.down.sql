BEGIN;
DROP TABLE IF EXISTS embedding_jobs;
DROP TABLE IF EXISTS entity_embeddings;
DROP TABLE IF EXISTS student_external_links;
DROP TABLE IF EXISTS student_activities;
DROP TABLE IF EXISTS student_certifications;
DROP TABLE IF EXISTS student_cvs;
-- Keep the shared `vector` extension installed; another application/schema may use it.
COMMIT;
