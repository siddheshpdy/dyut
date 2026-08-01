import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /portal-smoke\.spec\.js/,
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_PORTAL_BASE_URL || 'http://127.0.0.1:5174',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure'
  },
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-portal-report', open: 'never' }]]
});
