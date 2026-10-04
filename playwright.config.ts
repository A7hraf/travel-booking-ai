import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 4011);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: `node tests/mock-claude.mjs`,
      port: MOCK_PORT,
      env: { MOCK_CLAUDE_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npx next dev --port ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        AUTH_SECRET: "e2e-test-secret-e2e-test-secret-e2e-test-secret",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_BASE_URL: `http://localhost:${MOCK_PORT}`,
        UPLOAD_DIR: "./.e2e-uploads",
      },
    },
  ],
});
