import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:34320',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    launchOptions: process.env.WORTH_BROWSER_PATH ? { executablePath: process.env.WORTH_BROWSER_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      testIgnore: '**/responsive.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 780 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      'pnpm exec wrangler dev --config dist/worth/wrangler.json --local --ip 127.0.0.1 --port 34320 --persist-to .wrangler/browser-state',
    url: 'http://127.0.0.1:34320/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
