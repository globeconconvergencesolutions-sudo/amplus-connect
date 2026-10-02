/**
 * DirectAdmin "Setup Node.js App" startup file (same idea as Kalimoni parish-api).
 * Loads .env, then starts the Nitro Node listener on PORT from the panel.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

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

loadEnvFile(join(repoRoot, ".env"));
loadEnvFile(join(here, ".env"));

process.env.NODE_ENV ||= "production";
// Stay on loopback; Apache / the Node.js App reverse-proxy reaches this port.
process.env.HOST ||= process.env.NITRO_HOST || "127.0.0.1";

const nitroEntry = join(repoRoot, ".output/server/index.mjs");
if (!existsSync(nitroEntry)) {
  console.error(
    "[amplus-connect] Missing .output/server/index.mjs. Run `npm run build` locally and upload .output/ before starting the Node app.",
  );
  process.exit(1);
}

await import(pathToFileURL(nitroEntry).href);
