# My Stake Conference Adventure — complete demonstration source

For the Accra Ghana Christiansborg Stake, 31 October–1 November 2026. **Unofficial prototype**, not a Church product.

## Start in two minutes

Requires **Node.js 20+**. No `npm install` or database service needed.

```bash
cd christiansborg-adventure
ADMIN_KEY='replace-with-a-long-random-private-key' npm start
```

On Windows PowerShell:

```powershell
$env:ADMIN_KEY='replace-with-a-long-random-private-key'
npm start
```

Visit **http://localhost:3000**. Create a nickname (for example Roland), select age 6–8 and Visitor, then play. The moderator area is at the bottom of the same page; enter your private admin key there.

## Features

- Player registration: nickname, age range, optional ward/Visitor.
- Six scored game categories plus one unscored listening mission (seven total).
- Fifteen age-adjusted sample question levels per scored game, saved server-side.
- Shared age-group leaderboard and ward-average rankings (ward shown only after three participants).
- Word cloud: player-submitted words enter a **pending** moderation queue; moderator approves them.
- Appreciation: one per player per word; reporting: one per player per word.
- Three distinct reports move a word to **review** and hide it pending human decision.
- No public full names, exact ages, comments, or chat.

## Source layout

- `server.js` — dependency-free Node HTTP API, scoring, word moderation and JSON persistence.
- `public/index.html` — responsive app structure.
- `public/styles.css` — visual design.
- `public/app.js` — player interactions.
- `data/store.json` — created automatically; contains player and moderation data. **Do not publish or commit.**

## Important prototype limitations

1. **Not safe for an open public launch with children.** No verified guardian consent, no secure identity, no verified ward membership, no recovery mechanism, and no moderation of nicknames beyond basic character validation.
2. **Sessions are held in memory** and expire after 12 hours; restarting the server invalidates sessions. Player progress remains on disk, but players cannot securely recover accounts. Add guardian-mediated sign-in before launch.
3. **Leaderboard is demonstrative**; players can register repeatedly and self-select wards. Implement verified identity, anti-abuse protections, and a clear consent/privacy policy.
4. **Games are simplified playable question challenges**, not complete interlocking crossword grids, jigsaw puzzles, or fully authored 90-minute curricula. Replace with real engines and reviewed question banks.
5. Word screening uses a tiny example denylist and is **not sufficient** for a public child-facing site. All new submissions require human approval. Review nicknames and text for personal data as well.
6. **No real-time websocket updates**; reload word cloud or rankings to see new results.
7. Server uses a local JSON file and in-memory rate limiting; use a transactional database, authentication, logging, and distributed rate limiting for production.
8. The listening mission is intentionally not scored. During the Sunday session, encourage printed booklets and listening with families; do not promote competitive gameplay.
9. Set a strong ADMIN_KEY (minimum 16 characters); never commit it. Use HTTPS and a private moderator-only interface in production.
10. Decide on data retention, deletion requests, parental consent, and Church/local privacy review before launching at a public domain.

## Suggested production handoff to the stake technology specialist

- Host a static frontend and secure API behind HTTPS at the approved domain/path.
- Replace demo registration with guardian-approved pseudonymous accounts and recovery codes.
- Implement proper crosswords, word search, scripture quiz, matching, picture puzzles and Church history trail.
- Build a curated, age-specific content management workflow with doctrinal review.
- Implement audit trails, approval queues, automatic screening plus human moderation, abuse monitoring, and report appeals.
- Publish a simple parent-facing privacy notice and data-retention policy.
- Ensure accessibility, mobile performance and low-bandwidth operation.

The proposed `/dontsleep` path can redirect to `/adventure` if approved. Do not assume either is deployed.
