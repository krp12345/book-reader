import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the **real** Vite demo in a **real** browser —
 * nothing is mocked. jsdom can't do layout/scroll/ResizeObserver, so the core
 * reading loop (scroll → measure → auto-advance → render) can only be trusted
 * when exercised for real; that's what these tests are for.
 *
 * Kept out of Vitest on purpose: Vitest's `include` is `src/**`, and these specs
 * live in `e2e/`, so `pnpm test` and `pnpm test:e2e` never collide.
 */
const PORT = 5179;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
