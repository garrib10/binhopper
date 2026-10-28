import { defineConfig, devices } from '@playwright/test';
import { SYSTEM_OUTBOX } from './test/system-outbox';

/**
 * System tests: the built frontend (vite preview) against the real FastAPI app and a
 * real, seeded MySQL database. External map and Discogs services are mocked; the app API and database are real. Run with `npm run e2e:system`.
 *
 * The database must already be migrated and seeded (see README.md › Tests). The API
 * and preview use their own ports (8010, 4173) so they don't clash with dev servers.
 * Set PYTHON to the backend's interpreter if `python` on your PATH isn't it.
 */
const API_PORT = 8010;
const APP_PORT = 4173;
const python = process.env.PYTHON ?? 'python';

// Remote mode is explicitly staging-only; it never starts local servers or seeds data.
const remote = Boolean(process.env.APP_URL);
if (remote && (process.env.SYSTEM_TARGET !== 'staging' || !process.env.API_URL)) {
  throw new Error('Remote system tests require SYSTEM_TARGET=staging and API_URL');
}
if (process.env.SYSTEM_TARGET && !remote) {
  throw new Error('Staging system tests require APP_URL');
}

export default defineConfig({
  testDir: './e2e-system',
  testMatch: remote
    ? ['**/staging.spec.ts', '**/album.spec.ts', '**/artist.spec.ts', '**/search.spec.ts']
    : ['**/nearby-stock.spec.ts', '**/shell.spec.ts', '**/auth.spec.ts', '**/wishlist.spec.ts', '**/collection.spec.ts', '**/reports.spec.ts', '**/album.spec.ts', '**/artist.spec.ts', '**/search.spec.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: remote ? process.env.APP_URL : `http://127.0.0.1:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: remote ? undefined : [
    {
      command: `${python} -m uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      stdout: 'pipe',
      env: { EMAIL_BACKEND: 'file', EMAIL_FILE_DIR: SYSTEM_OUTBOX, PUBLIC_APP_URL: `http://127.0.0.1:${APP_PORT}` },
    },
    {
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_MAP_TILE_URL: 'https://tiles.binhopper.test/{z}/{x}/{y}.svg', VITE_MAP_ATTRIBUTION: 'Test tiles · © OpenStreetMap contributors' },
    },
  ],
});
