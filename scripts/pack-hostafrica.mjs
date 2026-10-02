/**
 * Assemble a folder you can FTP to Host Africa after `npm run build`.
 * Does not include .env or node_modules.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dest = join(root, "dist-hostafrica");
const output = join(root, ".output");

if (!existsSync(join(output, "server/index.mjs"))) {
  console.error("Run `npm run build` first. Missing .output/server/index.mjs");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(output, join(dest, ".output"), { recursive: true });
cpSync(join(root, "hosting"), join(dest, "hosting"), { recursive: true });
cpSync(join(root, "package.json"), join(dest, "package.json"));
if (existsSync(join(root, ".nvmrc"))) {
  cpSync(join(root, ".nvmrc"), join(dest, ".nvmrc"));
}

writeFileSync(
  join(dest, "README-UPLOAD.txt"),
  [
    "Upload this folder to the DirectAdmin Node.js application root (not public_html).",
    "Copy hosting/hostafrica/env.example to .env and fill secrets on the server.",
    "Startup file: hosting/hostafrica/server.mjs",
    "Then Restart the Node.js App.",
    "Full steps: HOST-AFRICA.md in the git repo.",
    "",
  ].join("\n"),
);

console.log("Packed", dest);
console.log("FTP that folder to the Node app root, add .env, restart Node.");
