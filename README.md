# Gospel Explorers

Conference activities for the Accra Ghana Christiansborg Stake, 31 October–1 November 2026. An unofficial community activity.

## Start

Requires Node.js 24+. No dependencies to install. Copy `.env.example` to `.env`, set a private random ADMIN_KEY of at least 32 characters, then run:

```powershell
npm start
```

- Player app: http://localhost:3000
- Moderation and session controls: http://localhost:3000/admin
- Participation notice: http://localhost:3000/privacy
- Health check: http://localhost:3000/api/health

## Activities

Six scored trails, 15 levels each: interlocking crossword grids, selectable word searches, scripture quizzes, meaning matching, gospel picture-tile puzzles with 15 different original illustrations, and ordered scripture/history trails. Seven age groups cover children (3–5, 6–8, 9–11), youth (12–17), YSA (18–35), others (36–55), and seniors (56+). Ages 3–5 have two- or three-word crosswords with starter letters and a visible word bank, plus four-piece pictures with only two pieces to swap. Ages 6–8 have three- or four-word crosswords with an optional word bank and four-piece pictures. Ages 9–11 have five- or six-word crosswords and nine-piece pictures. All 15 crossword word sets are different within each age group; familiar words can reappear in new combinations for practice. Youth and adult groups currently share the advanced puzzle difficulty. Existing 12+ accounts retain their progress and previous difficulty. The history trail has 15 authored sequences; other puzzles vary word selection, layout, or image arrangement. Scripture questions include references shown after completion. Content still requires organizer review.

The interface follows Ghana time automatically. Saturday leadership (11am–1pm) and adult (1:30–3:30pm) sessions show tailored listening prompts. Sunday general session (10am–noon) pauses scored games and rankings and opens a private listening notebook: stories, ideas, scriptures, drawing, or word spotting. Optional notes and actions are saved only in the current tab. API checks enforce the Sunday pause. Moderators can override the session in /admin and return it to Automatic after previews.

## Accounts and data

Open registration requires a family participation acknowledgement. Under-13 participation is guardian-assisted by acknowledgement, not verified consent. Public leaderboards use generated aliases. Ward choices come only from the configured WARDS list (`|` separated); Visitor is always available. Seven-day HttpOnly sessions survive restarts, and private recovery codes restore progress on other devices. Codes are hashed at rest and can be replaced. Players can sign out or delete their accounts and contributions. Inactive accounts are pruned after 30 days, checked once per minute and on startup.

New words require human approval. Three participants’ reports hide a word for review. Moderators sign in at /admin for one hour and can approve/hide/review words or inspect the complete word list in a searchable table with 20 rows per page. Sender nickname, age range and optional ward are shown only to authenticated moderators. Submission receipts tell players when a word has been sent for review. The admin key is never embedded in public pages.

By default, local SQLite persists application state and hashed sessions. To use Turso instead, set both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; the app creates its `state` and `sessions` tables on startup. If only one variable is set, startup stops with an error. Existing `data/store.json` is imported only for local SQLite. To copy an existing SQLite database into an empty Turso database, back up first, stop the app, and run `node ops/migrate-to-turso.js`; set `LOCAL_DB_PATH` if the source is not `data/stake-quest.sqlite`. Keep the database URL, token, `.env`, backups and recovery codes private. Retention and account deletion are logical application operations; operators must also manage backup retention and deletion reconciliation after restore.

## Validation and deployment

```powershell
npm test
```

Tests cover all 630 age/level/game combinations, crossword connectivity, word-search solvability, schedule boundaries, scoring, recovery, deletion, moderation, session persistence, origin rejection and production cookies.

See [the launch runbook](ops/LAUNCH.md) for the portable Docker/Compose package, HTTPS configuration, persistent disk, backups, restore rehearsal, current limits, and the Friday launch gate. No hosting has been selected or deployed yet. Run one Node process only; multi-instance hosting requires a shared normalized database, distributed rate limits and presence. Production refuses weak admin credentials and requires an HTTPS APP_ORIGIN.

Matching supports mouse/touch line drawing and keyboard/tap connections, with server-checked blue/red feedback. Pair checks do not award points; submitting a completed level does. Correct pairs and completed levels celebrate with silent confetti unless reduced motion is enabled. Recovery codes can be copied directly; the private sketch supports preset and custom colors, preserving existing strokes.

The player interface uses self-hosted Nunito (SIL Open Font License), a pastel backdrop, and CSS-animated gospel names and original vector symbols. Background motion can be paused, follows reduced-motion preferences, stops in hidden tabs, and pauses during Sunday quiet mode. Phone/tablet layouts use larger touch controls and contained puzzle-grid scrolling; no external font service is contacted. Decorative living-leader names were checked against the October 2026 sustaining presentation (linked in ops/CONTENT_REVIEW.md).

Progress and leaderboard share buttons create an original Gospel Explorers PNG badge locally in the browser. The server supplies only the player’s public alias, points, completed level count, milestone title, and optional rank in their group. No private nickname, age, ward, account ID or recovery secret appears in the badge. A preview precedes the user-initiated native share sheet; saving the image and copying the message are fallbacks. Group rank is a current snapshot, uses tied ranks, and is omitted at zero points. Localhost links are omitted from outgoing shares. No image-generation API, external upload or automatic social posting is used.

## Conference announcements

/admin includes a preview-before-send composer for everyone (including anonymous visitors), selected accounts, selected age groups, or selected configured wards/Visitor. Active messages take over recipients’ screens, make the player interface inert, and block challenge/answer/matching APIs until an organizer clears them. Matching multiple announcements displays them together. The SQLite-backed state survives refreshes and server restarts; active messages have no automatic expiry. Online visible pages poll every three seconds and on reconnect; a cached active message remains while clearance cannot be confirmed. Closed/offline devices cannot receive a new message until they reconnect. Admins see active messages, individual clear controls, 30-day cleared history, and distinct-account display receipts (not read receipts). Public message responses omit targeting lists and recipient details. Account deletion removes its targeting/display identifiers.
