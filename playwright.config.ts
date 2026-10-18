import { defineConfig, devices } from '@playwright/test';

// E2E runs the production (API-mode) build with the API mocked in the
// browser (e2e/mockApi.ts). The real handlers are covered by api/api.test.ts.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
