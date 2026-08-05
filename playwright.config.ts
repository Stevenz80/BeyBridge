import { defineConfig, devices } from '@playwright/test';

const port = 8081;
const baseURL = `http://127.0.0.1:${port}`;
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_PATH;

export default defineConfig({
  testDir: './e2e/web',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL,
    launchOptions: browserExecutable ? { executablePath: browserExecutable } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node ./scripts/serve-e2e-web.cjs ${port}`,
    url: baseURL,
    env: {
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
