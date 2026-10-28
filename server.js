// Gospel Explorers server. Node.js 24+.
"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const PORT = Number(process.env.PORT || 3000),
  ADMIN_KEY = process.env.ADMIN_KEY || "";
const production = process.env.NODE_ENV === "production";
if (production && ADMIN_KEY.length < 32)
  throw Error("Set ADMIN_KEY to at least 32 characters for production");
// if (
//   production &&
//   (!process.env.APP_ORIGIN ||
//     new URL(process.env.APP_ORIGIN).protocol !== "https:")
// )
//   throw Error("Set APP_ORIGIN to your public HTTPS origin for production");
const root = path.join(__dirname, "public"),
  store = path.join(
    process.env.DATA_DIR || path.join(__dirname, "data"),
    "store.json",
  );
fs.mkdirSync(path.dirname(store), { recursive: true });
const seed = [
  "Jesus Christ",
  "Faith",
  "Prayer",
  "Love",
  "Hope",
  "Family",
  "Service",
  "Temple",
  "Repentance",
  "Covenants",
].map((text, i) => ({
  id: i + 1,
  text,
  likes: 0,
  reports: [],
  likedBy: [],
  status: "approved",
  createdAt: Date.now(),
}));
async function start() {
  const { DatabaseSync } = require("node:sqlite"),
    { createClient } = require("@libsql/client"),
    hasTursoUrl = Boolean(process.env.TURSO_DATABASE_URL),
    hasTursoToken = Boolean(process.env.TURSO_AUTH_TOKEN);
  if (hasTursoUrl !== hasTursoToken)
    throw Error("Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  const isTurso = hasTursoUrl,
    database = isTurso
      ? createClient({
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        })
      : new DatabaseSync(path.join(path.dirname(store), "stake-quest.sqlite"));
  function run(sql, args = []) {
    return isTurso
      ? database.execute({ sql, args })
      : Promise.resolve(database.prepare(sql).run(...args));
  }
  async function all(sql, args = []) {
    if (isTurso) {
      const result = await database.execute({ sql, args });
      return Array.from(result.rows);
    }
    return database.prepare(sql).all(...args);
  }
  async function first(sql, args = []) {
    if (isTurso) {
      const result = await database.execute({ sql, args });
      return result.rows[0] || null;
    }
    return database.prepare(sql).get(...args) || null;
  }
  if (!isTurso) database.exec("PRAGMA journal_mode=WAL");
  await run(
    "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)",
  );
  await run(
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL, kind TEXT NOT NULL)",
  );
  const saved = await first("SELECT body FROM state WHERE id=1");
  let db;
  if (saved) {
    db = JSON.parse(saved.body);
  } else if (!isTurso) {
    try {
      db = JSON.parse(fs.readFileSync(store, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      db = { players: [], words: seed, events: [] };
    }
  } else {
    db = { players: [], words: seed, events: [] };
  }
  db.announcements ||= [];
  let pendingSave = Promise.resolve();
  function save() {
    const body = JSON.stringify(db);
    pendingSave = pendingSave.then(() =>
      run(
        "INSERT INTO state(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
        [body],
      ),
    );
    return pendingSave;
  }
  await save();
const hits = new Map();
function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function cookie(req, name) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
async function session(req, kind) {
  const value = cookie(req, kind === "admin" ? "sq_admin" : "sq_player");
  return value
    ? await first(
        "SELECT * FROM sessions WHERE token=? AND kind=? AND expires>?",
        [hash(value), kind, Date.now()],
      )
    : null;
}
async function issueSession(res, id, kind) {
  const value = crypto.randomBytes(32).toString("hex"),
    seconds = kind === "admin" ? 3600 : 604800;
  await run("INSERT INTO sessions VALUES(?,?,?,?)", [
    hash(value),
    id,
    Date.now() + seconds * 1000,
    kind,
  ]);
  res.setHeader(
    "Set-Cookie",
    `sq_${kind}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${production ? "; Secure" : ""}`,
  );
}
setInterval(() => {
  const now = Date.now();
  run("DELETE FROM sessions WHERE expires<=?", [now]).catch((error) =>
    console.error("Session cleanup failed:", error),
  );
  for (const [key, times] of hits) {
    const live = times.filter((t) => now - t < 60000);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
  }
}, 60000).unref();
const onlinePlayers = new Map(),
  ONLINE_WINDOW_MS = 90000;
function onlineCount() {
  const now = Date.now();
  for (const [id, lastSeen] of onlinePlayers) {
    if (now - lastSeen >= ONLINE_WINDOW_MS) onlinePlayers.delete(id);
  }
  return onlinePlayers.size;
}
async function loggedInCount() {
  const now = Date.now(),
    valid = new Set(db.players.map((p) => p.id));
  return (await all(
    "SELECT DISTINCT player_id FROM sessions WHERE kind='player' AND expires>?",
    [now],
  ))
    .filter((r) => valid.has(r.player_id)).length;
}
async function adminStats() {
  return {
    loggedIn: await loggedInCount(),
    online: onlineCount(),
    registered: db.players.length,
  };
}
function json(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(obj));
}
function read(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > 20000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(b || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}
function clean(s, max = 32) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}
async function auth(req) {
  const s = await session(req, "player");
  const p = s ? db.players.find((p) => p.id === s.player_id) : null;
  if (p) p.lastActiveAt = Date.now();
  return p;
}
async function admin(req) {
  return !!(await session(req, "admin"));
}
function rate(req, key, limit = 20) {
  const ip = req.socket.remoteAddress || "unknown",
    id = ip + ":" + key,
    now = Date.now();
  let x = hits.get(id) || [];
  x = x.filter((t) => now - t < 60000);
  if (x.length >= limit) return false;
  x.push(now);
  hits.set(id, x);
  return true;
}
function publicWord(w) {
  return { id: w.id, text: w.text, likes: w.likes, status: w.status };
}
function viewerWord(w, p) {
  return {
    ...publicWord(w),
    appreciated: !!p && w.likedBy.includes(p.id),
    reported: !!p && w.reports.includes(p.id),
  };
}
function playerOut(p) {
  return {
    id: p.id,
    nickname: p.nickname,
    publicName: publicName(p),
    age: p.age,
    ward: p.ward,
    points: p.points,
    progress: p.progress,
  };
}
function validWord(w) {
  return (
    /^[a-zA-Z][a-zA-Z '\-]{1,29}$/.test(w) && !/(https?|www|@|\d)/i.test(w)
  );
}
const blocked = ["fuck", "shit", "bitch", "idiot", "stupid", "sex", "porn"];
function unsafe(w) {
  return blocked.some((x) => w.toLowerCase().includes(x));
}
const {
  makeChallenge,
  publicPuzzle,
  checkAnswer,
  crosswordHint,
} = require("./lib/games");
const { conferenceState } = require("./lib/conference");
const {
  matchesAnnouncement,
  visibleAnnouncements,
  validateAnnouncement,
} = require("./lib/announcements");
function hasAnnouncement(p) {
  return db.announcements.some((m) => matchesAnnouncement(m, p));
}
const ages = ["3-5", "6-8", "9-11", "12-17", "18-35", "36-55", "56+"];
const gameIds = [
  "crossword",
  "wordhunt",
  "heroes",
  "matching",
  "temple",
  "history",
];
const wards = (process.env.WARDS || "")
  .split("|")
  .map((w) => w.trim())
  .filter(Boolean);
async function removeAccount(id) {
  for (const m of db.announcements) {
    m.displayedTo = m.displayedTo.filter((v) => v !== id);
    if (m.target.type === "accounts")
      m.target.values = m.target.values.filter((v) => v !== id);
  }
  db.players = db.players.filter((p) => p.id !== id);
  db.words = db.words.filter((w) => w.submittedBy !== id);
  for (const w of db.words) {
    if (w.likedBy.includes(id)) {
      w.likedBy = w.likedBy.filter((v) => v !== id);
      w.likes = Math.max(0, w.likes - 1);
    }
    w.reports = w.reports.filter((v) => v !== id);
  }
  await run("DELETE FROM sessions WHERE player_id=?", [id]);
  onlinePlayers.delete(id);
}
async function maintainData() {
  const cutoff = Date.now() - 30 * 86400000;
  for (const p of [...db.players])
    if ((p.lastActiveAt || p.createdAt) < cutoff) await removeAccount(p.id);
  db.events = db.events.filter((e) => e.at >= cutoff);
  db.announcements = db.announcements.filter(
    (m) => !m.clearedAt || m.clearedAt >= cutoff,
  );
  await save();
}
await maintainData();
setInterval(() => {
  maintainData().catch((error) =>
    console.error("Data maintenance failed:", error),
  );
}, 60000).unref();
function currentConference() {
  return conferenceState(Date.now(), db.settings?.sessionOverride || "auto");
}
function publicName(p) {
  return p.publicName || "Explorer " + p.id.slice(0, 6);
}
function recoveryCode() {
  return crypto.randomBytes(12).toString("hex").match(/.{4}/g).join("-");
}
function normalizeCode(code) {
  return String(code || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function scoreFor(game) {
  return game === "crossword" ? 40 : game === "heroes" ? 35 : 30;
}
async function api(req, res, u) {
  const route = u.pathname;
  const method = req.method;
  if (route === "/api/announcements" && method === "GET")
    return json(res, 200, {
      announcements: visibleAnnouncements(db.announcements, await auth(req)),
    });
  if (route === "/api/announcements/ack" && method === "POST") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    const b = await read(req);
    if (!Array.isArray(b.ids) || b.ids.length > 50)
      return json(res, 400, { error: "Invalid announcement list" });
    let changed = false;
    for (const m of db.announcements) {
      if (
        b.ids.includes(m.id) &&
        matchesAnnouncement(m, p) &&
        !m.displayedTo.includes(p.id)
      ) {
        m.displayedTo.push(p.id);
        changed = true;
      }
    }
    if (changed) await save();
    return json(res, 200, { ok: true });
  }
  if (route === "/api/admin/announcements" && method === "GET") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    return json(res, 200, {
      announcements: db.announcements
        .map(({ displayedTo, ...m }) => ({
          ...m,
          displayedCount: displayedTo.length,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
      accounts: db.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        publicName: publicName(p),
        age: p.age,
        ward: p.ward,
      })),
      ages: [...ages, "12+"],
      wards: ["Visitor", ...wards],
    });
  }
  if (route === "/api/admin/announcements" && method === "POST") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    if (db.announcements.filter((m) => !m.clearedAt).length >= 20)
      return json(res, 409, {
        error: "Clear an active announcement before adding more (20 maximum).",
      });
    const b = await read(req);
    let fields;
    try {
      fields = validateAnnouncement(b, db.players, [...ages, "12+"], wards);
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
    const message = {
      id: crypto.randomUUID(),
      ...fields,
      createdAt: Date.now(),
      clearedAt: null,
      displayedTo: [],
    };
    db.announcements.push(message);
    db.events.push({
      at: Date.now(),
      type: "announcement-sent",
      announcementId: message.id,
      audience: fields.target.type,
    });
    await save();
    return json(res, 201, { id: message.id });
  }
  if (
    /^\/api\/admin\/announcements\/[a-z0-9-]+\/clear$/.test(route) &&
    method === "POST"
  ) {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    const message = db.announcements.find((m) => m.id === route.split("/")[4]);
    if (!message) return json(res, 404, { error: "Announcement not found" });
    if (!message.clearedAt) {
      message.clearedAt = Date.now();
      db.events.push({
        at: Date.now(),
        type: "announcement-cleared",
        announcementId: message.id,
      });
      await save();
    }
    return json(res, 200, { ok: true });
  }
  if (route === "/api/health" && method === "GET") {
    await first("SELECT 1");
    return json(res, 200, { ok: true });
  }
  if (route === "/api/conference" && method === "GET")
    return json(res, 200, currentConference());
  if (route === "/api/admin/conference" && method === "PATCH") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    const b = await read(req);
    if (!["auto", "free", "leadership", "adult", "general"].includes(b.mode))
      return json(res, 400, { error: "Unknown session mode" });
    db.settings = { ...db.settings, sessionOverride: b.mode };
    db.events.push({ at: Date.now(), type: "session-mode", mode: b.mode });
    await save();
    return json(res, 200, currentConference());
  }
  if (route === "/api/recover" && method === "POST") {
    if (!rate(req, "recover", 10))
      return json(res, 429, {
        error: "Please wait a minute before trying again.",
      });
    const b = await read(req),
      code = normalizeCode(b.code);
    const p =
      code.length === 24
        ? db.players.find((p) => p.recoveryHash === hash(code))
        : null;
    if (!p)
      return json(res, 401, {
        error: "Recovery code not recognized. Check your saved code.",
      });
    p.lastActiveAt = Date.now();
    await save();
    await issueSession(res, p.id, "player");
    return json(res, 200, { player: playerOut(p) });
  }
  if (route === "/api/recovery-code" && method === "POST") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    const recovery = recoveryCode();
    p.recoveryHash = hash(normalizeCode(recovery));
    await save();
    return json(res, 200, { recoveryCode: recovery });
  }
  if (route === "/api/logout" && method === "POST") {
    const p = await auth(req);
    if (p) onlinePlayers.delete(p.id);
    await run("DELETE FROM sessions WHERE token=?", [
      hash(cookie(req, "sq_player")),
    ]);
    res.setHeader(
      "Set-Cookie",
      `sq_player=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`,
    );
    return json(res, 200, { ok: true });
  }
  if (route === "/api/account" && method === "DELETE") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    const b = await read(req);
    if (b.confirm !== "DELETE")
      return json(res, 400, { error: "Type DELETE to confirm." });
    await removeAccount(p.id);
    await save();
    res.setHeader(
      "Set-Cookie",
      `sq_player=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`,
    );
    return json(res, 200, { ok: true });
  }
  if (route === "/api/admin/login" && method === "POST") {
    if (!rate(req, "admin-login", 5))
      return json(res, 429, {
        error: "Too many attempts. Try again in a minute.",
      });
    const b = await read(req);
    const supplied = String(b.key || "");
    if (
      ADMIN_KEY.length < 16 ||
      !crypto.timingSafeEqual(
        Buffer.from(hash(supplied)),
        Buffer.from(hash(ADMIN_KEY)),
      )
    )
      return json(res, 403, { error: "Invalid admin key" });
    await issueSession(res, "moderator", "admin");
    return json(res, 200, { ok: true });
  }
  if (route === "/api/admin/logout" && method === "POST") {
    await run("DELETE FROM sessions WHERE token=?", [
      hash(cookie(req, "sq_admin")),
    ]);
    res.setHeader(
      "Set-Cookie",
      `sq_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`,
    );
    return json(res, 200, { ok: true });
  }
  if (route === "/api/presence" && method === "GET")
    return json(res, 200, { online: onlineCount() });
  if (route === "/api/presence" && method === "POST") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    onlinePlayers.set(p.id, Date.now());
    return json(res, 200, { online: onlineCount() });
  }
  if (route === "/api/config" && method === "GET")
    return json(res, 200, {
      name: "Gospel Explorers",
      ages,
      wards,
      games: gameIds,
      conference: currentConference(),
    });
  if (route === "/api/register" && method === "POST") {
    if (!rate(req, "register", 120))
      return json(res, 429, { error: "Please try again later" });
    const b = await read(req);
    if (b.acknowledged !== true)
      return json(res, 400, {
        error: "Please read and acknowledge the family participation notice.",
      });
    let nickname = clean(b.nickname, 20),
      age = b.age,
      ward = clean(b.ward, 35) || "Visitor";
    if (
      !/^[a-zA-Z0-9 _-]{2,20}$/.test(nickname) ||
      !ages.includes(age) ||
      !(ward === "Visitor" || wards.includes(ward))
    )
      return json(res, 400, {
        error: "Please use a short nickname and select an age range",
      });
    const id = crypto.randomUUID();
    const player = {
      id,
      nickname,
      age,
      ward,
      points: 0,
      progress: Object.fromEntries(gameIds.map((g) => [g, 0])),
      createdAt: Date.now(),
      publicName:
        "Explorer " + crypto.randomBytes(3).toString("hex").toUpperCase(),
    };
    const recovery = recoveryCode();
    player.recoveryHash = hash(normalizeCode(recovery));
    player.acknowledgedAt = Date.now();
    db.players.push(player);
    await save();
    await issueSession(res, id, "player");
    return json(res, 201, {
      player: playerOut(player),
      recoveryCode: recovery,
    });
  }
  if (route === "/api/me" && method === "GET") {
    const p = await auth(req);
    return p
      ? json(res, 200, { player: playerOut(p) })
      : json(res, 401, { error: "Please sign in" });
  }
  if (route === "/api/challenge" && method === "GET") {
    if (currentConference().quiet)
      return json(res, 423, {
        error:
          "Scored games are resting during the general session. Join the listening activities instead.",
      });
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (hasAnnouncement(p))
      return json(res, 423, {
        error:
          "Please attend to the organizer’s announcement. Games resume when it is cleared.",
      });
    const game = u.searchParams.get("game");
    if (!gameIds.includes(game))
      return json(res, 400, { error: "Unknown game" });
    const level = p.progress[game];
    if (level >= 15) return json(res, 200, { complete: true });
    return json(res, 200, {
      game,
      level: level + 1,
      ...publicPuzzle(makeChallenge(game, p.age, level)),
    });
  }
  if (route === "/api/crossword/hint" && method === "POST") {
    if (currentConference().quiet)
      return json(res, 423, {
        error: "Scored games will return after the general session.",
      });
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (hasAnnouncement(p))
      return json(res, 423, {
        error: "Games are paused for an organizer announcement.",
      });
    if (!rate(req, "crossword-hint:" + p.id, 30))
      return json(res, 429, { error: "Please wait before using another hint." });
    const b = await read(req);
    if (b.level !== p.progress.crossword + 1 || p.progress.crossword >= 15)
      return json(res, 409, {
        error: "Level changed. Open this challenge again.",
      });
    if (!b.answer || typeof b.answer !== "object" || Array.isArray(b.answer))
      return json(res, 400, { error: "Submit your current crossword answers for a hint." });
    const puzzle = makeChallenge("crossword", p.age, p.progress.crossword),
      hint = crosswordHint(
        puzzle,
        b.clueNumber,
        b.direction,
        b.answer,
      );
    if (hint) return json(res, 200, hint);
    if (
      Number.isInteger(b.clueNumber) &&
      ["across", "down"].includes(b.direction) &&
      puzzle.clues.some(
        (clue) =>
          clue.number === b.clueNumber && clue.direction === b.direction,
      )
    )
      return json(res, 200, { complete: true });
    return json(res, 400, {
      error: "Select a valid crossword answer for a hint.",
    });
  }
  if (route === "/api/match/check" && method === "POST") {
    if (currentConference().quiet)
      return json(res, 423, {
        error: "Matching is paused during the general session.",
      });
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (hasAnnouncement(p))
      return json(res, 423, {
        error: "Matching is paused for an organizer announcement.",
      });
    if (!rate(req, "match:" + p.id, 120))
      return json(res, 429, { error: "Take a moment before trying again." });
    const b = await read(req);
    if (b.level !== p.progress.matching + 1 || p.progress.matching >= 15)
      return json(res, 409, {
        error: "Level changed. Open this challenge again.",
      });
    const puzzle = makeChallenge("matching", p.age, p.progress.matching);
    if (
      !puzzle.left.some((v) => v.id === b.left) ||
      !puzzle.right.some((v) => v.id === b.right)
    )
      return json(res, 400, { error: "Choose one item from each column." });
    return json(res, 200, { correct: puzzle.solution[b.left] === b.right });
  }
  if (route === "/api/answer" && method === "POST") {
    if (currentConference().quiet)
      return json(res, 423, {
        error: "Scored games will return after the general session.",
      });
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (hasAnnouncement(p))
      return json(res, 423, {
        error: "Games are paused for an organizer announcement.",
      });
    if (!rate(req, "answer", 30))
      return json(res, 429, { error: "Please wait" });
    const b = await read(req),
      game = b.game;
    if (!gameIds.includes(game))
      return json(res, 400, { error: "Unknown game" });
    if (b.level !== p.progress[game] + 1)
      return json(res, 409, { error: "Level changed. Refresh challenge." });
    if (hasAnnouncement(p))
      return json(res, 423, {
        error: "Games are paused for an organizer announcement.",
      });
    const c = makeChallenge(game, p.age, p.progress[game]);
    const correct = checkAnswer(c, b.answer);
    if (correct) {
      p.progress[game]++;
      p.points += scoreFor(game);
      await save();
    }
    return json(res, 200, {
      correct,
      player: playerOut(p),
      message: correct
        ? "Well done! Take a break when you need one."
        : "Good try! Try again.",
    });
  }
  if (route === "/api/share-badge" && method === "GET") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    return json(res, 200, require("./lib/share").shareBadge(p, db.players));
  }
  if (route === "/api/leaderboard" && method === "GET") {
    const age = u.searchParams.get("age");
    const players = db.players
      .filter((p) => !age || p.age === age)
      .sort((a, b) => b.points - a.points)
      .slice(0, 20)
      .map((p) => ({ 
        nickname: p.nickname || publicName(p), 
        age: p.age, 
        points: p.points, 
        ward: p.ward 
      }));
    const wardMap = new Map();
    for (const p of db.players) {
      if (p.ward === "Visitor") continue;
      let w = wardMap.get(p.ward) || { ward: p.ward, total: 0, count: 0 };
      w.total += p.points;
      w.count++;
      wardMap.set(p.ward, w);
    }
    const wards = [...wardMap.values()]
      .filter((w) => w.count >= 3)
      .map((w) => ({
        ward: w.ward,
        average: Math.round(w.total / w.count),
        players: w.count,
      }))
      .sort((a, b) => b.average - a.average);
    return json(res, 200, { players, wards });
  }
  if (route === "/api/words" && method === "GET") {
    const p = await auth(req);
    return json(res, 200, {
      words: db.words
        .filter((w) => w.status === "approved")
        .sort((a, b) => b.likes - a.likes)
        .map((w) => viewerWord(w, p)),
    });
  }
  if (route === "/api/words" && method === "POST") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (!rate(req, "words", 5))
      return json(res, 429, {
        error: "Please wait before submitting more words",
      });
    const b = await read(req),
      text = clean(b.text, 30);
    if (!validWord(text) || unsafe(text))
      return json(res, 400, {
        error: "Please submit a short, appropriate gospel word or phrase",
      });
    let existing = db.words.find(
      (w) => w.text.toLowerCase() === text.toLowerCase(),
    );
    if (existing)
      return json(
        res,
        200,
        existing.status === "approved"
          ? {
              status: "approved",
              message:
                "This word is already in the cloud. Tap it to show your appreciation.",
            }
          : {
              status: "pending",
              message:
                "This word has already been suggested. A moderator must approve it before it can appear in the cloud.",
            },
      );
    const word = {
      id: Math.max(0, ...db.words.map((w) => w.id)) + 1,
      text,
      likes: 0,
      likedBy: [],
      reports: [],
      status: "pending",
      createdAt: Date.now(),
      submittedBy: p.id,
    };
    db.words.push(word);
    await save();
    return json(res, 201, {
      status: "pending",
      submittedText: word.text,
      message:
        "Sent for review. Your word will appear in the cloud after a moderator approves it.",
    });
  }
  if (/^\/api\/words\/\d+\/(like|report)$/.test(route) && method === "POST") {
    const p = await auth(req);
    if (!p) return json(res, 401, { error: "Please sign in" });
    if (!rate(req, "vote", 15))
      return json(res, 429, { error: "Please slow down" });
    const [, , , id, action] = route.split("/");
    const w = db.words.find((w) => w.id === Number(id));
    if (!w || w.status !== "approved")
      return json(res, 404, { error: "Word unavailable" });
    if (action === "like") {
      if (w.likedBy.includes(p.id))
        return json(res, 409, {
          error: "Already appreciated",
          word: viewerWord(w, p),
        });
      w.likedBy.push(p.id);
      w.likes++;
    } else {
      if (w.reports.includes(p.id))
        return json(res, 409, {
          error: "Already reported",
          word: viewerWord(w, p),
        });
      w.reports.push(p.id);
      if (w.reports.length >= 3) w.status = "review";
    }
    await save();
    return json(res, 200, {
      message:
        action === "like"
          ? "Appreciation recorded"
          : "Report received for review",
      word: viewerWord(w, p),
    });
  }
  if (route === "/api/admin/stats" && method === "GET") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    return json(res, 200, await adminStats());
  }
  if (route === "/api/admin/words" && method === "GET") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    const senders = new Map(db.players.map((p) => [p.id, p]));
    return json(res, 200, {
      stats: await adminStats(),
      words: db.words
        .map((w) => {
          const sender = senders.get(w.submittedBy);
          return {
            ...publicWord(w),
            reports: w.reports.length,
            createdAt: w.createdAt,
            sender: sender
              ? {
                  nickname: sender.nickname,
                  age: sender.age,
                  ward: sender.ward === "Visitor" ? null : sender.ward,
                }
              : null,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    });
  }
  if (/^\/api\/admin\/words\/\d+$/.test(route) && method === "PATCH") {
    if (!(await admin(req)))
      return json(res, 403, { error: "Admin access denied" });
    const id = Number(route.split("/").pop()),
      b = await read(req),
      w = db.words.find((w) => w.id === id);
    if (!w || !["approved", "hidden", "pending", "review"].includes(b.status))
      return json(res, 400, { error: "Invalid word or status" });
    w.status = b.status;
    db.events.push({
      at: Date.now(),
      type: "moderation",
      wordId: id,
      status: b.status,
    });
    await save();
    return json(res, 200, { word: publicWord(w) });
  }
  return json(res, 404, { error: "Not found" });
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};
const server = http.createServer(async (req, res) => {
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    const u = new URL(req.url, "http://localhost");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !==
        (process.env.APP_ORIGIN || `http://${req.headers.host}`)
    )
      return json(res, 403, { error: "Origin not allowed" });
    if (u.pathname.startsWith("/api/")) return await api(req, res, u);
    if (req.method !== "GET")
      return json(res, 405, { error: "Method not allowed" });
    const pathname =
      u.pathname === "/"
        ? "/index.html"
        : ["/admin", "/admin/"].includes(u.pathname)
          ? "/admin.html"
          : u.pathname === "/privacy"
            ? "/privacy.html"
            : u.pathname;
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep))
      return json(res, 403, { error: "Forbidden" });
    fs.readFile(file, (err, data) => {
      if (err) return json(res, 404, { error: "Not found" });
      if (path.extname(file) === ".ttf")
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.writeHead(200, {
        "content-type": types[path.extname(file)] || "application/octet-stream",
        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'self'; img-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    json(res, 400, { error: "Unable to process request" });
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 50;
server.listen(PORT, () =>
  console.log(`Gospel Explorers running at ${process.env.APP_ORIGIN}`),
);
}
start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});
