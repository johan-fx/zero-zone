import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'test-results/e2e-junit.xml' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm api:migrate:local && pnpm api:seed:local && pnpm --filter @zona-cero/api dev',
      url: 'http://127.0.0.1:8787/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      name: 'API Worker',
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:8787 pnpm --filter @zona-cero/web-ui dev',
      url: 'http://127.0.0.1:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      name: 'Web UI',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
