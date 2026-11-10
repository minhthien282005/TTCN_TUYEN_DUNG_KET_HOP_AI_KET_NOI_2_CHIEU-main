# Sprint 5 API

All routes are same-origin JSON; account-specific routes use the existing HttpOnly session cookie.

## `GET /api/sprint5/matches`

- Student: ranked public jobs, score, matched/missing skills, explanation and job URL.
- Employer: candidates with public profiles matched against that employer's published jobs. Contact details and CV files are omitted.
- Returns 401 if signed out and 403 for unsupported roles.

## `POST /api/sprint5/chat`

Body: `{ "message": "...", "externalConsent": false }`. Works for guests and signed-in accounts. Without provider configuration or consent, uses the internal contextual assistant. The request body is not written to a chat history.

## `POST /api/sprint5/assist`

Requires a student/employer session. Employer task: `job_description`; student tasks: `cv_bullet` or `cv_summary`. Accepts bounded form details and returns `{ "suggestion": "...", "mode": "contextual|generative" }`. Suggestions are not saved to the profile/job.

## `GET /api/sprint5/status`

Reports whether matching and optional generative assistance are configured and whether the current account consented to external processing.

## `POST /api/sprint5/consent`

Account session required. Body: `{ "granted": true|false }`. Records the latest user choice for external AI processing; account deletion removes these consent records.
