"use strict";
const { DatabaseSync, backup } = require("node:sqlite");
const { createClient } = require("@libsql/client");
const path = require("node:path");
const fs = require("node:fs");

(async () => {
  const data = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const destination = path.resolve(
    process.argv[2] || path.join(data, "backups"),
  );
  fs.mkdirSync(destination, { recursive: true });

  const target = path.join(
    destination,
    "gospel-explorers-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
  );

  const url = process.env.TURSO_DATABASE_URL,
    authToken = process.env.TURSO_AUTH_TOKEN;
  if (Boolean(url) !== Boolean(authToken))
    throw Error("Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  if (url) {
    console.log("Pulling backup from Turso...");
    const client = createClient({ url, authToken });
    try {
      const state = await client.execute("SELECT id, body FROM state WHERE id=1"),
        sessions = await client.execute(
          "SELECT token, player_id, expires, kind FROM sessions",
        );
      if (!state.rows.length) throw Error("No application state found in Turso.");
      const snapshot = new DatabaseSync(target);
      try {
        snapshot.exec(
          "CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE sessions (token TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL, kind TEXT NOT NULL)",
        );
        snapshot
          .prepare("INSERT INTO state(id,body) VALUES(?,?)")
          .run(state.rows[0].id, state.rows[0].body);
        const insertSession = snapshot.prepare(
          "INSERT INTO sessions(token,player_id,expires,kind) VALUES(?,?,?,?)",
        );
        for (const session of sessions.rows)
          insertSession.run(
            session.token,
            session.player_id,
            session.expires,
            session.kind,
          );
      } finally {
        snapshot.close();
      }
    } finally {
      client.close();
    }
  } else {
    const file = path.join(data, "stake-quest.sqlite");
    if (!fs.existsSync(file)) throw Error("No local database found.");
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      await backup(database, target);
    } finally {
      database.close();
    }
  }

  console.log("Backup created: " + target);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});