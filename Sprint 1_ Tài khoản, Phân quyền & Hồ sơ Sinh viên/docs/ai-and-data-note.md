# Sprint 1 AI and data note

## Scope decision

Do not put an LLM or embedding call in the Sprint 1 registration/profile critical path. Sprint 3 owns CV parsing and vector search; Sprint 5 owns matching. Sprint 1 ships deterministic skill cleanup using a small reviewed alias list in `../data/skills.json`.

## Candidate evaluation plan

Compare multilingual embedding models only after the team has a consented Vietnamese CV/job evaluation set. Use recall@10 for retrieval, nDCG@10 for ranking, and human review for explanation quality and harmful mismatches. Split by person and company to avoid leakage. Track model/version, latency, per-1k-document cost, retention terms, and fallback behavior. Do not upload real CVs to an external service without a documented purpose and user permission.

## Fallback

Keep exact canonical skill overlap and filters (location, job type, desired role) available without a model. Unknown skill strings are preserved for later taxonomy review. Do not present similarity scores as verified outcomes.

## Data plan

Use generated or irreversibly anonymized data in development. Obtain explicit purpose/version consent before using submitted profiles for evaluation or model development. Retain an audit trail and honor account deletion in derived datasets where feasible.
