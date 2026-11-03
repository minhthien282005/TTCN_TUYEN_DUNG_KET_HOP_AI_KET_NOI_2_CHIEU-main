# Sprint 1 QA checklist

Run against a disposable local data directory (`DATA_DIR=...`) and a fresh browser profile. Never use real personal data. Record build/revision, environment, tester, date, actual result, and defect link for every case before calling QA accepted.

| ID | Scenario | Expected result |
|---|---|---|
| AUTH-01 | Register valid student and employer accounts | 201; correct role and consent record; password absent from persisted JSON |
| AUTH-02 | Register invalid email, short/long password, missing consent | 400 with a useful message; no account created |
| AUTH-03 | Register duplicate email with different casing | 409; one active account |
| AUTH-04 | Verify valid email token twice | First succeeds; second fails; token expires after 15 minutes |
| AUTH-05 | Login before verification | 403; no session cookie |
| AUTH-06 | Login with wrong password five times | Attempts 1–4 return 401; attempt 5 locks for 15 minutes; correct password remains blocked until unlock |
| AUTH-07 | Login, inspect cookie, logout, reuse cookie | HttpOnly/SameSite cookie; logout invalidates session; reuse denied |
| AUTH-08 | Request password reset for known and unknown emails | Same public message; valid token is single use and expires after 15 minutes |
| AUTH-09 | Change password/email using wrong current password | 400; account and sessions unchanged |
| AUTH-10 | Successful reset or password/email change | Existing sessions revoked; changed email requires verification |
| AUTH-11 | Request rate limit on write endpoint | 121st request within 60 seconds returns 429; bucket recovers after window |
| AUTH-12 | Delete account | Soft delete timestamp recorded, profile cleared, sessions revoked; deleted account cannot sign in |
| PROF-01 | Student reads/updates own profile | 200 and saved values are returned consistently |
| PROF-02 | Employer reads or updates student profile | 403 |
| PROF-03 | Update education, skills, experience, projects, language and preferences separately | Each submitted section persists after reload; unrelated sections remain unchanged |
| PROF-04 | Submit invalid phone, oversized arrays, unknown visibility | Validation rejects invalid data; list sizes and text lengths are bounded |
| PROF-05 | Submit aliases (e.g. `js`, `reactjs`) | Stored/returned skills use canonical names |
| PROF-06 | Complete, skip and resume onboarding | Each step saves; skip is allowed; completed onboarding is not repeated |
| REF-01 | Read categories and normalize known/unknown skills | Taxonomy available; known aliases map to canonical names; unknown labels are preserved |
| PRIV-01 | Change visibility and inspect public unauthenticated endpoints | No public profile endpoint exists in Sprint 1; private remains default |
| UX-01 | Keyboard-only modal and mobile navigation | Focus remains usable, dialog close works, menu exposes expanded state and links close it |
| UX-02 | Slow/failing API and expired session | Loading/empty/error/success feedback is understandable; 401 prompts sign-in |
| DEP-01 | Fresh staging deployment and backup restore | Deployment smoke flow passes; backup can be restored in isolated environment |

## Demo sequence

1. Register a student, follow the local verification link, and sign in.
2. Complete onboarding; set a private profile with skills, education, experience, project, language, location and desired roles.
3. Edit each section and reload to confirm values persist.
4. Change password, verify old sessions no longer work, then sign in again.
5. Register an employer and confirm that the student profile API is forbidden.
6. Delete the disposable student account and confirm that it can no longer sign in.

Status: **not executed**. This checklist is a test plan, not evidence of a passing QA run.
