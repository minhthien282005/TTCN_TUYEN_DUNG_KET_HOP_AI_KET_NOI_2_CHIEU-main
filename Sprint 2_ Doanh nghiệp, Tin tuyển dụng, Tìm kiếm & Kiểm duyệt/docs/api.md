# Sprint 2 API

Requests and responses use JSON unless noted otherwise. Errors use `{ "error": "..." }`. Employer endpoints require a verified session with role `employer`; student endpoints require role `student`; admin endpoints require role `admin`.

## Public job search

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/companies` | List verified companies with public fields only. |
| GET | `/api/jobs` | Search published, unexpired jobs at verified companies. |
| GET | `/api/jobs/:id` | Read a public job detail; records view history for students. |
| POST | `/api/jobs/:id/report` | Submit a report as a signed-in student. |

`GET /api/jobs` accepts `q`, `location`, `type`, `industry`, `skill`, `salaryMin`, `salaryMax`, `postedWithin`, `workMode`, `level`, `experience`, `language`, `companySize`, `sort`, `page`, and `pageSize`. Sort values are `newest`, `salary`, `deadline`, and `relevance`. Page size is capped at 30. Search ignores Vietnamese diacritics and supports a small set of synonyms. Responses include `jobs`, `total`, `page`, `pageSize`, and `pages`.

## Employer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employer/company` | Read own company profile and verification state. |
| PUT/PATCH | `/api/employer/company` | Create or update own company profile. |
| POST | `/api/employer/company/documents` | Upload a PDF/PNG/JPEG document (max 5 MB); requires ClamAV scan to pass. |
| GET | `/api/employer/jobs` | List own jobs and company profile. |
| POST | `/api/employer/jobs` | Create a draft (`status: "draft"`) or submit for review. |
| PATCH | `/api/employer/jobs/:id` | Update own job and submit it for review again. |
| DELETE | `/api/employer/jobs/:id` | Archive own job. |
| POST | `/api/employer/jobs/:id/clone` | Clone an own job into a draft. |
| POST | `/api/employer/jobs/:id/renew` | Renew an eligible job with a new expiry date. |
| POST | `/api/employer/jobs/:id/status` | Pause, resume, or close own job. |

Company updates accept a `company` object with `name`, `website`, `description`, `taxId`, `industry`, `location`, `size`, `branches`, `culture`, `benefits`, `socials`, and `mediaUrls`. Job create/update accepts title and description, requirements, benefits, recruitment process, industry/location/type, work mode, level, experience, languages, target, headcount, salary range, skill criteria, criteria weights, expiry and status. A non-draft submission needs a verified company and an expiry date within 90 days. Criteria weights must total 100. A skill can be marked `required` or `preferred` with a weight from 1 to 100.

## Student

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/student/saved-jobs` | List saved jobs or save a job with group/note. |
| DELETE | `/api/student/saved-jobs/:jobId` | Remove a saved job. |
| GET | `/api/student/job-history` | List recent viewed jobs (up to 50). |
| GET/PATCH | `/api/student/privacy` | Read/update profile visibility and blocked company IDs. |

## Admin and moderation

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/metrics` | Read dashboard counts and activity summaries. |
| GET | `/api/admin/users?q=` | Search and list user accounts. |
| PATCH | `/api/admin/users/:id` | Lock/unlock an account or update its role (last-admin guard applies). |
| POST | `/api/admin/users/:id/reset-password` | Create a password reset flow; dev mode returns a local reset URL. |
| GET/POST | `/api/moderation/companies` | List review queue or approve/reject/request more information. |
| GET | `/api/moderation/companies/:id/documents/:documentId` | Download a clean document as an authenticated admin. |
| GET | `/api/moderation/jobs` | List jobs pending review. |
| POST | `/api/moderation/jobs/:id` | Approve, reject, request changes, or remove a pending job. |
| GET | `/api/moderation/reports` | List pending user reports. |
| POST | `/api/moderation/reports/:id` | Dismiss a report or remove the reported job. |

## States, validation, and privacy

Job flow: `draft` → `pending_review` → `published`, `rejected`, or `needs_changes`; published jobs can be paused, closed, or automatically marked `expired`. Archived records are retained. Only verified companies can submit jobs for publication, and public endpoints return only published, unexpired jobs from verified companies.

The API validates job title/description, supported job types, nonnegative salary ranges, expiry dates, skill criteria, and total criterion weights. JSON bodies are limited to 100 KB; uploads are separately capped and validated. Malformed JSON returns 400 and oversized bodies return 413. Public responses omit owner IDs, tax IDs, moderation notes, and company documents. ClamAV is required before an uploaded document can be persisted as clean.

## Runtime storage note

The current demo server stores records in local JSON. The PostgreSQL migration under `migrations/` is a target schema only and has not been applied; these routes do not yet run on PostgreSQL.
