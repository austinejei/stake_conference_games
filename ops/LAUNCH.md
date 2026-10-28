# Gospel Explorers — launch runbook

Target: ready for organizer testing before Friday 30 October 2026; conference 31 October–1 November. All session times use Africa/Accra (GMT).

## Release contents

The player app, separate /admin interface, /privacy notice, six game engines, session scheduler, tests, Dockerfile, Compose configuration, and SQLite backup helper. No credentials or participant database belong in the release archive.

## Run locally

Node.js 24+ is required. Copy `.env.example` to `.env`, set a private random ADMIN_KEY of at least 32 characters, then `npm start`. Use http://localhost:3000 and http://localhost:3000/admin. Anyone with the player link can register. Save the recovery code shown after registration.

## Deploy when hosting is selected

1. Run `npm test` before packaging. Provision a single instance with either a durable local disk or Turso. This release is designed for one Node process; application state is cached in memory and must not be shared across multiple workers.
2. Set ADMIN_KEY, APP_ORIGIN (exact HTTPS origin), and either DATA_DIR to the writable persistent disk or both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Configure WARDS with approved ward names separated by `|`; Visitor is always available. Until configured, the app offers Visitor only.
3. Run Node directly under the host's process manager, or build the Dockerfile. `docker compose up -d --build` binds the service to localhost:3000 for a TLS reverse proxy. The Compose volume persists the SQLite database through restarts. Do not use an ephemeral filesystem or scale above one instance.
4. Put HTTPS in front of the service and forward the public Host header. The reverse proxy should limit request body size to 20KB, set connection timeouts, and apply per-client request limits. The application deliberately does not trust arbitrary X-Forwarded-For headers. Behind a proxy, its process-local rate limits group clients by the proxy address; tune edge/application limits after testing the selected host.
5. Check /api/health, registration, code recovery on a second browser, all six games, and /admin login/logout over HTTPS. Verify cookies are HttpOnly, SameSite=Strict, Secure. Test a restart and recovery afterward.
6. In /admin, preview each session. General Session must disable scored games and rankings, display quiet listening, and reject challenge/answer API requests with 423. Return the setting to Automatic. Do not leave a preview override enabled.
7. Have organizers try phones on the actual venue network. Test concurrent use at the expected attendance and inspect latency, error counts, disk space and event-loop load before publishing the link. Formal load testing remains pending because attendance/hosting is not selected.
8. Run `node ops/backup.js /secure/backup/directory` (or `docker compose exec gospel-explorers node ops/backup.js /data/backups`). With local SQLite, this uses SQLite's online backup API and includes current WAL data. With Turso environment variables set, it downloads the app state and sessions into a local SQLite snapshot. Automate backups on the selected host; keep them access-controlled and expire them within 30 days.
9. Rehearse restore on a separate test instance: stop that instance, point DATA_DIR at a fresh directory containing a backed-up file named `stake-quest.sqlite`, start it, and verify progress and /api/health. Never overwrite the live disk as a test. Inactive data will be pruned on startup. Backups can restore previously deleted data; operators must reconcile deletion requests following a restore.

## Friday launch gate

- Hosting, approved domain, HTTPS, durable disk, health monitoring and restart policy selected and verified.
- An organizer owns moderation during each session; the admin key is shared privately only with authorized moderators.
- The privacy notice, open registration and under-13 parent/guardian acknowledgement are reviewed by the organizing team. This is an acknowledgement, not verified parental consent or identity. Appropriate local governance review remains an organizer responsibility.
- Game wording and scripture references reviewed by the designated content reviewer. History includes 15 ordered scripture/history stories.
- Approved ward list supplied, or launch with Visitor only.
- Tests and phone/venue-network checks pass; load expectation confirmed and tested on the chosen host.
- Backup/restore and deletion behavior verified; public contact/support ownership confirmed.
- Session setting returned to Automatic, using the server's correct UTC clock.

## Schedule

- Saturday 31 October: Stake & Ward Leadership, 11:00–13:00; Adult Session, 13:30–15:30. Prompts and listening words adapt to the active session. Games remain available.
- Sunday 1 November: General Session, 10:00–12:00. Quiet activities only; scored games and rankings pause. At 12:00 games return.
- Before, between, and after sessions: games are open. Interface state refreshes every 20 seconds; API enforcement changes at the exact boundary.

## Current limits

One server, one persistent SQLite disk, aggregate local presence, and in-process rate limits. No verified identity or guardian verification. Recovery codes are bearer secrets, so possession grants account access. No claim of a completed public deployment, formal security audit, content approval, venue load test, or legal compliance review is made by this package.

## Announcement rehearsal

Before publishing, test an announcement against two different age/ward accounts. Confirm only the intended account is blocked; refresh and restart the test server to confirm persistence. Clear it in /admin and confirm the app resumes within the next successful three-second poll. Verify everyone messages also reach the registration page. Active messages remain until explicitly cleared. The displayed-account count is delivery feedback, not proof of reading. Connectivity and device visibility affect update latency; do not rely on this app as an emergency alert system.
