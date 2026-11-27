import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: [
    {
      command: 'pnpm --filter @educore36/web dev',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @educore36/api dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
