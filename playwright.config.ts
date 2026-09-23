import { defineConfig, devices } from "@playwright/test";

const MOCK_SUPABASE_PORT = 54329;
const MOCK_SUPABASE_URL = `http://127.0.0.1:${MOCK_SUPABASE_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    // Chromium-based mobile viewport (avoids requiring a separate WebKit install).
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
  ],
  // The app under test talks to a local PostgREST stand-in
  // (e2e/mock-supabase.mjs) seeded from seed-data/cocktails.json rather than
  // the real Supabase project: e2e runs stay deterministic, never touch
  // production data, and work in environments that can't reach supabase.co.
  // NEXT_PUBLIC_* vars are inlined at build time, so the e2e build goes to
  // its own dist dir (.next-e2e) and never clobbers a normal `.next` build.
  webServer: [
    {
      command: `node e2e/mock-supabase.mjs`,
      url: `${MOCK_SUPABASE_URL}/rest/v1/tasters`,
      env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run start -- -p 3100",
      url: "http://127.0.0.1:3100",
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-mock-anon-key",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
