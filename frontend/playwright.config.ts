import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the React app in a real browser at phone and desktop
 * sizes. API calls are mocked inside each test (page.route), so the backend
 * doesn't need to be running.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev',
    env: { VITE_MAP_TILE_URL: 'https://tiles.binhopper.test/{z}/{x}/{y}.svg', VITE_MAP_ATTRIBUTION: 'Test tiles · © OpenStreetMap contributors' },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
