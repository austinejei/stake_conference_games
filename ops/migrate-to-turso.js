"use strict";
const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@libsql/client");
const path = require("node:path");

async function main() {
  const url = process.env.TURSO_DATABASE_URL,
    authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken)
    throw Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  const source = path.resolve(
      process.env.LOCAL_DB_PATH ||
        path.join(__dirname, "..", "data", "stake-quest.sqlite"),
    ),
    local = new DatabaseSync(source, { readOnly: true }),
    remote = createClient({ url, authToken });
  try {
    const saved = local.prepare("SELECT body FROM state WHERE id=1").get();
    if (!saved) throw Error("The local SQLite database has no application state.");
    const sessions = local
      .prepare(
        "SELECT token, player_id, expires, kind FROM sessions",
      )
      .all();
    await remote.execute(
      "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)",
    );
    await remote.execute(
      "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL, kind TEXT NOT NULL)",
    );
    const existing = await remote.execute("SELECT id FROM state WHERE id=1");
    const existingSessions = await remote.execute(
      "SELECT token FROM sessions LIMIT 1",
    );
    if (existing.rows.length || existingSessions.rows.length)
      throw Error(
        "The Turso database already contains app data; migration stopped to avoid overwriting it.",
      );
    const transaction = await remote.transaction("write");
    try {
      await transaction.execute({
        sql: "INSERT INTO state(id,body) VALUES(1,?)",
        args: [saved.body],
      });
      for (const session of sessions)
        await transaction.execute({
          sql: "INSERT INTO sessions(token,player_id,expires,kind) VALUES(?,?,?,?)",
          args: [
            session.token,
            session.player_id,
            session.expires,
            session.kind,
          ],
        });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    console.log(
      `Migrated application state and ${sessions.length} session(s) from ${source}.`,
    );
  } finally {
    local.close();
    remote.close();
  }
}

main().catch((error) => {
  console.error("Turso migration failed:", error.message);
  process.exitCode = 1;
});
