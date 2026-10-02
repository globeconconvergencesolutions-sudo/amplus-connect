/**
 * Fail fast on the server if required production env is missing.
 * Usage: node scripts/check-hostafrica-env.mjs
 * Reads process.env plus .env in the current working directory.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PUBLIC_APP_URL",
];

const requiredEither = [
  ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"],
];

const recommended = [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "CRON_SECRET",
  "ORDER_NOTIFY_EMAIL",
];

const missing = required.filter((key) => !process.env[key]?.trim());
for (const group of requiredEither) {
  if (!group.some((key) => process.env[key]?.trim())) {
    missing.push(group.join(" or "));
  }
}

const skipped = recommended.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  console.error("Missing required env:", missing.join(", "));
  process.exit(1);
}

console.log("Required Host Africa env is present.");
if (skipped.length) {
  console.log("Optional (unset):", skipped.join(", "));
}

const publicUrl = process.env.PUBLIC_APP_URL ?? "";
if (publicUrl && !publicUrl.startsWith("https://")) {
  console.warn("PUBLIC_APP_URL should be https:// in production:", publicUrl);
}
