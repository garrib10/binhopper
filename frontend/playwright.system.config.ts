import { defineConfig, devices } from '@playwright/test';

/**
 * System tests: the built frontend (vite preview) against the real FastAPI app and a
 * real, seeded MySQL database. Nothing is mocked. Run with `npm run e2e:system`.
 *
 * The database must already be migrated and seeded (see README.md › Tests). The API
 * and preview use their own ports (8010, 4173) so they don't clash with dev servers.
 * Set PYTHON to the backend's interpreter if `python` on your PATH isn't it.
 */
const API_PORT = 8010;
const APP_PORT = 4173;
const python = process.env.PYTHON ?? 'python';

export default defineConfig({
  testDir: './e2e-system',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
