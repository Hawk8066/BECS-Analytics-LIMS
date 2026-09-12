import { readFileSync } from "node:fs";
import path from "node:path";

// Next loads .env automatically; vitest does not. Parse it here (no extra
// dependency) so PrismaClient finds DATABASE_URL in the integrity suite.
// Real environment variables always win, so CI can point tests at another DB.
try {
  const env = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env (e.g. CI with real env vars set) — nothing to do.
}
