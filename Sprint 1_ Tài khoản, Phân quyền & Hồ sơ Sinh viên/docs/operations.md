# Sprint 1 operations and staging handoff

## Local setup

- Node.js 20 or newer; no dependencies to install.
- `Copy-Item "Sprint 1_ Tài khoản, Phân quyền & Hồ sơ Sinh viên/.env.example" .env` is a template only. The application does not auto-load `.env`; set variables in the shell or your process manager.
- `npm.cmd start`, then open `http://localhost:3000`.
- Development mode prints verification/reset links in the browser. Never enable this in production.

## Staging configuration

Set `NODE_ENV=production`, `PORT`, a persistent `DATA_DIR`, `APP_BASE_URL` (public HTTPS URL), `TOKEN_PEPPER` (unique random secret), `RESEND_API_KEY`, and `MAIL_FROM` (verified sender). The app enables Secure session cookies and does not return raw verification/reset links in production. Restrict the sender domain and rotate secrets through the deployment secret manager.

**Staging is not deployed by this repository.** The service still uses a JSON file and in-memory lock/rate-limit maps; do not run this prototype with production settings or multiple replicas. Before a real staging deployment, replace JSON persistence and the process-local controls with PostgreSQL and shared rate/session storage, run the SQL migration, provision HTTPS, and perform the smoke checklist in `qa-checklist.md`. No credentials or hosting target were present in the project.

## Logs and correlation

Request logs are JSON on stdout with request ID, method, path, response status, and duration. Errors are structured logs. Do not log request bodies, passwords, cookies, tokens, or CV/profile contents. Route logs can contain IP addresses at the hosting proxy; define retention and access controls there.

## Local backup / restore drill

1. Stop the local server so the JSON snapshot is stable.
2. Run `node "Sprint 1_ Tài khoản, Phân quyền & Hồ sơ Sinh viên/scripts/backup.js"` (optional destination directory as first argument).
3. Copy a backup to a disposable `DATA_DIR` as `db.json` and start the app against that directory to verify recovery.
4. Delete the disposable restore after the drill. Keep backups outside source control; `.gitignore` excludes `backups/`.

This file-copy process is a development drill only. A deployed database requires encrypted, scheduled provider backups and a tested restore procedure.

## CI

`.github/workflows/ci.yml` checks JavaScript syntax and taxonomy JSON on push and pull request. It is not a substitute for the manual API/UI QA plan. The workflow has not been run in this local review.
