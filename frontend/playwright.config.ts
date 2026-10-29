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
  // Chromium runs on every PR (the required `e2e` check). WebKit (Safari's engine: many users
  // are on iPhones) and Firefox run in the `e2e-browsers` job; locally: npm run e2e:all (#72).
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev',
    env: { VITE_MAP_TILE_URL: 'https://tiles.binhopper.test/{z}/{x}/{y}.svg', VITE_MAP_ATTRIBUTION: 'Test tiles · © OpenStreetMap contributors' },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
