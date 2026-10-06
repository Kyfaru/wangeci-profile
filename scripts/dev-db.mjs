// Local throwaway Postgres for development and tests (no Docker needed).
// Run: node scripts/dev-db.mjs  -> postgres://postgres:postgres@localhost:54329/wangeci
// Data lives in .local/pg (gitignored). Never point this at staging or production.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dir = ".local/pg";
const first = !fs.existsSync(`${dir}/PG_VERSION`);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 54329, persistent: true });

if (first) await pg.initialise();
await pg.start();
if (first) {
  await pg.createDatabase("wangeci");
  await pg.createDatabase("wangeci_shadow");
}
console.log("dev-db ready on postgres://postgres:postgres@localhost:54329/wangeci");
process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
