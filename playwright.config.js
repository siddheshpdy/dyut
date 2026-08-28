import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-output',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 7_500,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'local-chrome',
      testMatch: /(?:dyut-ui|lobby-smoke)\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://127.0.0.1:4173',
      },
    },
    {
      name: 'crazygames-chrome',
      testMatch: /portal-smoke\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://127.0.0.1:4174',
      },
    },
  ],
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'node node_modules/vite/bin/vite.js --mode crazygames --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
