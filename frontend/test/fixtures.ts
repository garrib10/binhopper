import { test as base, expect } from '@playwright/test';

// Applies to mocked and real-backend suites. The app API remains real in system
// tests; only third-party map/Discogs traffic is intercepted, including navigation.
export const test = base.extend<{ externalServices: void }>({
  externalServices: [async ({ page }, use) => {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'tiles.binhopper.test') {
        await route.fulfill({ contentType: 'image/svg+xml', body:
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee9dd"/><path d="M0 70H256M80 0V256M0 180H256M190 0V256" stroke="#d4ccbc" stroke-width="8"/></svg>' });
      } else if (/(^|\.)(discogs\.com|openstreetmap\.org|stadiamaps\.com|maptiler\.com|geoapify\.com)$/.test(url.hostname)) {
        await route.abort();
      } else await route.fallback();
    });
    await use();
  }, { auto: true }],
});
export { expect };
export type { Page } from '@playwright/test';
