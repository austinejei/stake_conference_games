const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
test("player persistence, scoring, presence and isolated admin access", async () => {
  const data = mkdtempSync(path.join(tmpdir(), "stake-quest-test-"));
  const port = 34000 + Math.floor(Math.random() * 10000),
    base = `http://127.0.0.1:${port}`,
    key = "integration-test-key-that-is-long-enough";
  let child;
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        ADMIN_KEY: key,
        WARDS: "Test Ward",
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });
    let error = "";
    child.stderr.on("data", (v) => (error += v));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error(error);
      try {
        await fetch(base + "/api/config");
        return;
      } catch {
        await delay(50);
      }
    }
    throw Error("Server did not start: " + error);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
  }
  async function api(route, { method = "GET", body, cookie, origin } = {}) {
    const res = await fetch(base + route, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie"),
    };
  }
  try {
    await start();
    const setupLogin = await api("/api/admin/login", {
      method: "POST",
      body: { key },
    });
    await api("/api/admin/conference", {
      method: "PATCH",
      cookie: setupLogin.cookie.split(";")[0],
      body: { mode: "free" },
    });
    const home = await (await fetch(base)).text();
    assert.match(home, /Gospel Explorers/);
    assert.doesNotMatch(home, /adminKey|demo|prototype/i);
    const font = await fetch(base + "/fonts/nunito-variable.ttf");
    assert.equal(font.status, 200);
    assert.equal(font.headers.get("content-type"), "font/ttf");
    assert.match(font.headers.get("cache-control"), /immutable/);
    assert.equal((await fetch(base + "/playful.css")).status, 200);
    assert.equal((await fetch(base + "/background.js")).status, 200);
    assert.equal((await fetch(base + "/decor/moroni.svg")).status, 200);
    assert.equal((await fetch(base + "/admin")).status, 200);
    assert.equal((await fetch(base + "/admin/")).status, 200);
    assert.equal((await api("/api/admin/words")).status, 403);
    assert.equal((await api("/api/share-badge")).status, 401);
    assert.equal(
      (
        await api("/api/admin/login", {
          method: "POST",
          body: { key: "wrong" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api("/api/register", {
          method: "POST",
          origin: "https://untrusted.example",
          body: {
            nickname: "Explorer",
            age: "6-8",
            ward: "Test Ward",
            acknowledged: true,
          },
        })
      ).status,
      403,
    );
    const registration = await api("/api/register", {
      method: "POST",
      body: {
        nickname: "Explorer",
        age: "6-8",
        ward: "Test Ward",
        acknowledged: true,
      },
    });
    assert.equal(registration.status, 201);
    assert.match(registration.cookie, /HttpOnly/);
    assert.match(registration.cookie, /SameSite=Strict/);
    assert.equal(registration.body.token, undefined);
    const playerCookie = registration.cookie.split(";")[0];
    assert.match(
      registration.body.recoveryCode,
      /^[a-f0-9]{4}(-[a-f0-9]{4}){5}$/,
    );
    assert.equal(
      (await api("/api/admin/words", { cookie: playerCookie })).status,
      403,
    );
    assert.equal((await api("/api/presence", { method: "POST" })).status, 401);
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await api("/api/presence", { method: "POST", cookie: playerCookie }))
          .body.online,
        1,
      );
    assert.equal(
      (
        await api("/api/answer", {
          method: "POST",
          cookie: playerCookie,
          body: { game: "heroes", level: 1, answer: null },
        })
      ).body.correct,
      false,
    );
    const answered = await api("/api/answer", {
      method: "POST",
      cookie: playerCookie,
      body: {
        game: "heroes",
        level: 1,
        answer: String(
          require("../lib/games").makeChallenge("heroes", "6-8", 0).answer,
        ),
      },
    });
    assert.equal(answered.body.player.points, 35);
    assert.equal(
      (
        await api("/api/answer", {
          method: "POST",
          cookie: playerCookie,
          body: {
            game: "heroes",
            level: 1,
            answer: String(
              require("../lib/games").makeChallenge("heroes", "6-8", 0).answer,
            ),
          },
        })
      ).status,
      409,
    );

    const matchPuzzle = require("../lib/games").makeChallenge(
        "matching",
        "6-8",
        0,
      ),
      left = matchPuzzle.left[0].id,
      right = matchPuzzle.solution[left],
      wrong = matchPuzzle.right.find((v) => v.id !== right).id;
    assert.equal(
      (
        await api("/api/match/check", {
          method: "POST",
          body: { level: 1, left, right },
        })
      ).status,
      401,
    );
    const correctPair = await api("/api/match/check", {
      method: "POST",
      cookie: playerCookie,
      body: { level: 1, left, right },
    });
    assert.deepEqual(correctPair.body, { correct: true });
    assert.equal(
      (
        await api("/api/match/check", {
          method: "POST",
          cookie: playerCookie,
          body: { level: 1, left, right: wrong },
        })
      ).body.correct,
      false,
    );
    assert.equal(
      (
        await api("/api/match/check", {
          method: "POST",
          cookie: playerCookie,
          body: { level: 1, left: "unknown", right },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api("/api/match/check", {
          method: "POST",
          cookie: playerCookie,
          body: { level: 2, left, right },
        })
      ).status,
      409,
    );
    const unscored = (await api("/api/me", { cookie: playerCookie })).body
      .player;
    assert.equal(unscored.points, 35);
    assert.equal(unscored.progress.matching, 0);
    const badge = await api("/api/share-badge", { cookie: playerCookie });
    assert.equal(badge.status, 200);
    assert.equal(badge.body.points, 35);
    assert.equal(badge.body.completed, 1);
    assert.equal(badge.body.groupRank, 1);
    for (const field of [
      "nickname",
      "age",
      "ward",
      "id",
      "recoveryCode",
      "recoveryHash",
    ])
      assert.equal(badge.body[field], undefined);
    const word = await api("/api/words", {
      method: "POST",
      cookie: playerCookie,
      body: { text: "Compassion" },
    });
    assert.equal(word.status, 201);
    assert.equal(word.body.status, "pending");
    assert.match(word.body.message, /Sent for review/);
    assert.equal(word.body.submittedText, "Compassion");
    const duplicatePending = await api("/api/words", {
      method: "POST",
      cookie: playerCookie,
      body: { text: "Compassion" },
    });
    assert.equal(duplicatePending.body.status, "pending");
    assert.equal(duplicatePending.body.word, undefined);
    assert.equal(
      (await api("/api/words")).body.words.some((w) => w.text === "Compassion"),
      false,
    );
    const login = await api("/api/admin/login", {
      method: "POST",
      body: { key },
    });
    assert.equal(login.status, 200);
    const adminCookie = login.cookie.split(";")[0];
    const queue = await api("/api/admin/words", { cookie: adminCookie });
    assert.deepEqual(queue.body.stats, {
      loggedIn: 1,
      online: 1,
      registered: 1,
    });
    assert.equal(
      (await api("/api/admin/stats", { cookie: playerCookie })).status,
      403,
    );
    assert.deepEqual(
      (await api("/api/admin/stats", { cookie: adminCookie })).body,
      { loggedIn: 1, online: 1, registered: 1 },
    );
    const pending = queue.body.words.find((w) => w.text === "Compassion");
    assert.equal(pending.status, "pending");
    assert.deepEqual(pending.sender, {
      nickname: "Explorer",
      age: "6-8",
      ward: "Test Ward",
    });
    assert.equal(queue.body.words.find((w) => w.text === "Faith").sender, null);
    assert.equal(
      (
        await api("/api/admin/words/" + pending.id, {
          method: "PATCH",
          cookie: adminCookie,
          body: { status: "approved" },
        })
      ).status,
      200,
    );
    const publicCloud = await api("/api/words");
    assert.equal(
      publicCloud.body.words.some((w) => w.text === "Compassion"),
      true,
    );
    for (const item of publicCloud.body.words) {
      assert.equal(item.sender, undefined);
      assert.equal(item.submittedBy, undefined);
      assert.equal(item.nickname, undefined);
      assert.equal(item.age, undefined);
      assert.equal(item.ward, undefined);
    }
    const duplicateApproved = await api("/api/words", {
      method: "POST",
      cookie: playerCookie,
      body: { text: "Compassion" },
    });
    assert.equal(duplicateApproved.body.status, "approved");

    const config = (await api("/api/config")).body;
    assert.deepEqual(config.ages, [
      "3-5",
      "6-8",
      "9-11",
      "12-17",
      "18-35",
      "36-55",
      "56+",
    ]);
    for (const age of ["12-17", "18-35", "36-55", "56+"]) {
      const joined = await api("/api/register", {
        method: "POST",
        body: { nickname: "AgeGroupCheck", age, acknowledged: true },
      });
      assert.equal(joined.status, 201);
      assert.equal(joined.body.player.age, age);
      const ownCloud = await api("/api/words", {
        cookie: joined.cookie.split(";")[0],
      });
      assert.equal(
        ownCloud.body.words.find((w) => w.id === pending.id).appreciated,
        false,
      );
    }
    const appreciated = await api("/api/words/" + pending.id + "/like", {
      method: "POST",
      cookie: playerCookie,
      body: {},
    });
    assert.equal(appreciated.status, 200);
    assert.equal(appreciated.body.word.appreciated, true);
    assert.equal(appreciated.body.word.likes, 1);
    const repeated = await api("/api/words/" + pending.id + "/like", {
      method: "POST",
      cookie: playerCookie,
      body: {},
    });
    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.word.appreciated, true);
    assert.equal(repeated.body.word.likes, 1);
    assert.equal(
      (await api("/api/words", { cookie: playerCookie })).body.words.find(
        (w) => w.id === pending.id,
      ).appreciated,
      true,
    );
    assert.equal(
      (await api("/api/words")).body.words.find((w) => w.id === pending.id)
        .appreciated,
      false,
    );
    const reported = await api("/api/words/" + pending.id + "/report", {
      method: "POST",
      cookie: playerCookie,
      body: {},
    });
    assert.equal(reported.body.word.reported, true);
    assert.equal(
      (
        await api("/api/words/" + pending.id + "/report", {
          method: "POST",
          cookie: playerCookie,
          body: {},
        })
      ).status,
      409,
    );
    await stop();
    await start();
    assert.equal(
      (await api("/api/me", { cookie: playerCookie })).body.player.points,
      35,
    );
    const savedVote = (
      await api("/api/words", { cookie: playerCookie })
    ).body.words.find((w) => w.id === pending.id);
    assert.equal(savedVote.appreciated, true);
    assert.equal(savedVote.reported, true);
    assert.equal(savedVote.likes, 1);
    assert.equal(
      (await api("/api/admin/words", { cookie: adminCookie })).status,
      200,
    );
    assert.deepEqual(
      (await api("/api/admin/stats", { cookie: adminCookie })).body,
      { loggedIn: 5, online: 0, registered: 5 },
    );
    assert.equal((await api("/api/presence")).body.online, 0);
    assert.equal(
      (
        await api("/api/admin/conference", {
          method: "PATCH",
          cookie: playerCookie,
          body: { mode: "general" },
        })
      ).status,
      403,
    );
    await api("/api/admin/conference", {
      method: "PATCH",
      cookie: adminCookie,
      body: { mode: "general" },
    });
    assert.equal((await api("/api/conference")).body.quiet, true);
    assert.equal(
      (await api("/api/challenge?game=crossword", { cookie: playerCookie }))
        .status,
      423,
    );
    assert.equal(
      (
        await api("/api/match/check", {
          method: "POST",
          cookie: playerCookie,
          body: { level: 1, left, right },
        })
      ).status,
      423,
    );
    assert.equal(
      (
        await api("/api/answer", {
          method: "POST",
          cookie: playerCookie,
          body: { game: "heroes", level: 2, answer: "0" },
        })
      ).status,
      423,
    );
    await api("/api/admin/conference", {
      method: "PATCH",
      cookie: adminCookie,
      body: { mode: "auto" },
    });
    const recovered = await api("/api/recover", {
      method: "POST",
      body: { code: registration.body.recoveryCode },
    });
    assert.equal(recovered.body.player.points, 35);
    assert.notEqual(
      (await api("/api/leaderboard")).body.players[0].nickname,
      "Explorer",
    );
    const renewed = await api("/api/recovery-code", {
      method: "POST",
      cookie: playerCookie,
      body: {},
    });
    assert.equal(
      (
        await api("/api/recover", {
          method: "POST",
          body: { code: registration.body.recoveryCode },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api("/api/recover", {
          method: "POST",
          body: { code: renewed.body.recoveryCode },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api("/api/account", {
          method: "DELETE",
          cookie: playerCookie,
          body: { confirm: "DELETE" },
        })
      ).status,
      200,
    );
    assert.equal((await api("/api/me", { cookie: playerCookie })).status, 401);
    assert.equal(
      (
        await api("/api/recover", {
          method: "POST",
          body: { code: renewed.body.recoveryCode },
        })
      ).status,
      401,
    );
    assert.equal(
      (await api("/api/words")).body.words.some((w) => w.text === "Compassion"),
      false,
    );
    await api("/api/admin/logout", {
      method: "POST",
      cookie: adminCookie,
      body: {},
    });
    assert.equal(
      (await api("/api/admin/words", { cookie: adminCookie })).status,
      403,
    );
  } finally {
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});

test("production refuses missing credentials and requires secure cookies", async () => {
  const data = mkdtempSync(path.join(tmpdir(), "stake-quest-production-"));
  const port = 45000 + Math.floor(Math.random() * 5000);
  let child;
  try {
    const invalid = spawn(process.execPath, ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        NODE_ENV: "production",
        ADMIN_KEY: "",
      },
      stdio: "pipe",
    });
    invalid.stderr.resume();
    await once(invalid, "exit");
    assert.notEqual(invalid.exitCode, 0);
    const key = "production-integration-key-long-enough";
    child = spawn(process.execPath, ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        NODE_ENV: "production",
        ADMIN_KEY: key,
        APP_ORIGIN: "https://quest.example",
      },
      stdio: "pipe",
    });
    child.stderr.resume();
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(base + "/api/config");
        ready = true;
        break;
      } catch {
        await delay(50);
      }
    }
    assert.equal(ready, true);
    const res = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://quest.example",
      },
      body: JSON.stringify({ key }),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("set-cookie"), /; Secure/);
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    rmSync(data, { recursive: true, force: true });
  }
});

// Lifecycle checks use disposable imported data and a separate child process.
test("inactive-account cleanup and online SQLite backup", async () => {
  const fs = require("node:fs"),
    { DatabaseSync } = require("node:sqlite");
  const data = mkdtempSync(path.join(tmpdir(), "explorers-retention-")),
    backups = path.join(data, "backup");
  const port = 53000 + Math.floor(Math.random() * 1000),
    base = `http://127.0.0.1:${port}`;
  let child;
  const old = Date.now() - 31 * 86400000;
  fs.writeFileSync(
    path.join(data, "store.json"),
    JSON.stringify({
      players: [
        { id: "expired", nickname: "Old", createdAt: old },
        {
          id: "recent",
          nickname: "Current",
          createdAt: Date.now(),
          points: 0,
          age: "6-8",
          ward: "Visitor",
          progress: {},
        },
      ],
      words: [
        {
          id: 1,
          text: "Expired contribution",
          likes: 0,
          likedBy: [],
          reports: [],
          status: "pending",
          createdAt: old,
          submittedBy: "expired",
        },
      ],
      events: [{ at: old, type: "old" }],
    }),
  );
  try {
    child = spawn(process.execPath, ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        ADMIN_KEY: "retention-test-admin-key-long-enough",
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });
    let startupError = "";
    child.stderr.on("data", (chunk) => (startupError += chunk));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null)
        throw Error(startupError || "Server exited before health check");
      try {
        await fetch(base + "/api/health");
        ready = true;
        break;
      } catch {
        await delay(50);
      }
    }
    assert.equal(ready, true, startupError || "Server did not become healthy");
    const task = spawn(process.execPath, ["ops/backup.js", backups], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, DATA_DIR: data },
      stdio: "pipe",
    });
    task.stdout.resume();
    task.stderr.resume();
    await once(task, "exit");
    assert.equal(task.exitCode, 0);
    const files = fs.readdirSync(backups);
    assert.equal(files.length, 1);
    const db = new DatabaseSync(path.join(backups, files[0]), {
      readOnly: true,
    });
    const saved = JSON.parse(db.prepare("SELECT body FROM state").get().body);
    assert.deepEqual(
      saved.players.map((p) => p.id),
      ["recent"],
    );
    assert.equal(saved.words.length, 0);
    assert.equal(saved.events.length, 0);
    db.close();
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    rmSync(data, { recursive: true, force: true });
  }
});

test("Turso-compatible client persists application data across restarts", async () => {
  const data = mkdtempSync(path.join(tmpdir(), "explorers-turso-client-")),
    databaseUrl = "file:" + path.join(data, "remote.db"),
    port = 54000 + Math.floor(Math.random() * 1000),
    base = `http://127.0.0.1:${port}`,
    key = "turso-adapter-test-admin-key-long-enough";
  let child;
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: path.join(data, "local"),
        TURSO_DATABASE_URL: databaseUrl,
        TURSO_AUTH_TOKEN: "test-token",
        ADMIN_KEY: key,
        WARDS: "Test Ward",
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });
    let error = "";
    child.stderr.on("data", (chunk) => (error += chunk));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error(error || "Server exited");
      try {
        const response = await fetch(base + "/api/health");
        if (response.ok) return;
      } catch {
        await delay(50);
      }
    }
    throw Error("Turso-compatible server did not start: " + error);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
  try {
    await start();
    const registration = await fetch(base + "/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: "Persistent",
        age: "6-8",
        ward: "Test Ward",
        acknowledged: true,
      }),
    });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get("set-cookie").split(";")[0],
      registered = await registration.json();
    await stop();
    await start();
    const me = await fetch(base + "/api/me", { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).player.id, registered.player.id);
  } finally {
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});
