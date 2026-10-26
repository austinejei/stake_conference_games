"use strict";
const { DatabaseSync, backup } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

(async () => {
  const data = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const file = path.join(data, "stake-quest.sqlite");

  if (!fs.existsSync(file)) {
    throw Error("No database found");
  }

  const destination = path.resolve(
    process.argv[2] || path.join(data, "backups"),
  );
  fs.mkdirSync(destination, { recursive: true });

  const database = new DatabaseSync(file, { readOnly: true });
  const target = path.join(
    destination,
    "gospel-explorers-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".sqlite",
  );

  await backup(database, target);
  database.close();
  console.log("Backup created: " + target);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
