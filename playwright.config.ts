import { defineConfig, devices } from "@playwright/test";

// 3100 is often taken by other projects on the dev machine, so the default is different. Override with E2E_PORT.
const PORT = Number(process.env.E2E_PORT ?? 3123);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The tests share one database and one in-memory rate limiter, so they run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // `next dev` compiles a route the first time a signed-in page needs it (the dashboard, the admin redirect).
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // The app must treat the test origin as its own (cookies, the Better Auth origin check, absolute links).
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      TRUSTED_ORIGINS: BASE_URL,
      // No Cloudflare widget or verification: the app skips the bot check outside production when no key is set.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
});
