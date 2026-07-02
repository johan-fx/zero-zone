import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 120_000,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: '../test-results/staging-e2e-junit.xml' }]] : [['list'], ['html', { open: 'never', outputFolder: '../playwright-report/staging' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
