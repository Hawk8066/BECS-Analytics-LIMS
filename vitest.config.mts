import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from import.meta.url rather than __dirname so the config loads
// cleanly as ESM (Vite's native config loader warns on CommonJS globals).
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // The integrity suite talks to the dev Postgres, so keep files serial.
    fileParallelism: false,
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // `server-only` is a Next.js runtime guard with no Node entry point; the
      // stub lets tests import server modules (feed, tasks) directly.
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
    },
  },
});
