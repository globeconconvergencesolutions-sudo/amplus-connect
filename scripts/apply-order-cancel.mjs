// Applies cancel_unpaid_order + reminder columns.
// Usage: node --env-file=.env scripts/apply-order-cancel.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "supabase/migrations/20260929153000_cancel_unpaid_orders.sql");
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL. Add the Postgres URI from Supabase → Project Settings → Database, then re-run.",
  );
  console.error(`SQL to paste in the dashboard editor: ${sqlPath}`);
  process.exit(1);
}

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error(
    "psql is not available. Paste supabase/migrations/20260929153000_cancel_unpaid_orders.sql into the Supabase SQL editor instead.",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
