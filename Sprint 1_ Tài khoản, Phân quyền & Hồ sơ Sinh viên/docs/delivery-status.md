# Sprint 1 delivery status

Snapshot after the local implementation work. “Implemented” means code/document exists in this repository; it does not mean QA or staging acceptance has passed.

| Item | Status | Evidence / remaining acceptance |
|---|---|---|
| S1-01 backlog and acceptance | Implemented as plan | Plan and this status register exist; named owners are not available in repo |
| S1-02 review/retro/refinement | Pending team event | Add actual progress, decisions, retro actions and Sprint 2 refinement after team review |
| S1-03 ERD/migration/rollback | Draft implemented | ERD plus PostgreSQL up/down migrations; not applied to a DB |
| S1-04 account API/OpenAPI | Implemented in prototype | Registration, verification, login/logout/refresh, reset/change email/password; OpenAPI added |
| S1-05 password/tokens/lockout/rate limit | Partial | scrypt instead of requested Argon2/bcrypt; lockout/rate maps are process-local; token digests and expiry are implemented |
| S1-06 role and profile ownership | Implemented in prototype | Self-only profile routes and student role check; no arbitrary user ID is accepted |
| S1-07 student profile | Partial | All requested sections persist through profile API; local JSON representation is not normalized CRUD storage |
| S1-08 categories | Partial | Read-only static sample categories and skill taxonomy; category create/update/delete admin API is not in Sprint 1 prototype |
| S1-09 consent, soft delete, audit | Implemented in prototype | Purpose/version consent history, soft delete and bounded audit records |
| S1-10 account UI | Implemented in prototype | Registration, login, verification, reset and feedback are present |
| S1-11 onboarding | Implemented in prototype | Three-step saveable flow for industry/school, role/job type and location; skip and resume |
| S1-12 profile UI | Implemented in prototype | Expandable sections for personal/education, preferences, capabilities and privacy |
| S1-13 i18n/loading/session states | Partial | Vietnamese UI and API error/success feedback; translation framework and comprehensive loading/empty states remain |
| S1-14 skill taxonomy | Implemented v1 | Canonical labels, aliases, groups and deterministic normalization; taxonomy is deliberately small |
| S1-15 AI/embedding evaluation | Implemented as scope note | Evaluation plan and deterministic fallback documented; no model benchmark run |
| S1-16 UX handoff | Draft implemented | Flows and responsive states documented; no separate Figma/wireframe artifact supplied |
| S1-17 email/staging | Partial | Resend adapter and environment template; no provider credentials/sender domain supplied, no staging deployment |
| S1-18 CI/log/backup | Partial | CI syntax workflow, structured logs and local JSON backup/restore instructions; no CI run and no production DB backup |
| S1-19 AUTH QA | Planned, not executed | Manual test cases in QA checklist |
| S1-20 RBAC/profile QA | Planned, not executed | Manual test cases in QA checklist |
| S1-21 staging smoke/demo | Blocked on infrastructure | Demo sequence documented; staging host, DB, sender, and secrets are not in repository |

## Acceptance gate

Sprint 1 is not ready to be called accepted until the named external dependencies are supplied, persistence/security gaps are addressed, the QA cases are executed with recorded results, and the staging demo passes. Local code should be treated as a reviewable prototype.

## Planning/retro prompts

- Which acceptance criteria can be cut from this overloaded sprint without lowering security requirements?
- Who owns email sender verification, database selection, staging and QA sign-off?
- Record actual velocity, defects, review decisions, and one retro action per owner after the demo; do not invent these values in the repository.
