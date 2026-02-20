import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config that tests the assembled _site/ directory
 * (the same structure deployed to GitHub Pages) using a plain
 * static file server instead of Vite's preview server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 4174 --directory ../_site',
    url: 'http://localhost:4174/badminton/',
    reuseExistingServer: !process.env.CI,
  },
});
