import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: {
      DB_PATH: path.join(__dirname, "src", "db", "test.sqlite"),
      JWT_SECRET: "test-secret-do-not-use-in-prod",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
    },
  },
});
