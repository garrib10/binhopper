import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression (#73): screenshots of key screens in light and dark mode at phone and
 * desktop size, compared with committed baselines in visual/__screenshots__/.
 *
 * Fonts and anti-aliasing differ between macOS and Linux, so screenshots are only taken
 * and compared inside the official Playwright Linux image (mcr.microsoft.com/playwright,
 * same version as @playwright/test): in CI's `visual` job, and locally through
 * `npm run visual:docker` / `npm run visual:update`.
 */
export default defineConfig({
  testDir: './visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  retries: 0,
  use: { baseURL: 'http://localhost:5173' },
  expect: {
    // Strict: inside the same image screenshots repeat pixel for pixel, so even a slight
    // token shade change should fail (the default 0.2 color threshold misses those).
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', threshold: 0.02, maxDiffPixelRatio: 0.0005 },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    env: { VITE_MAP_TILE_URL: 'https://tiles.binhopper.test/{z}/{x}/{y}.svg', VITE_MAP_ATTRIBUTION: 'Test tiles · © OpenStreetMap contributors' },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
