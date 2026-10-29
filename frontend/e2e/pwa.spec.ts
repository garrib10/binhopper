import { expect, test } from '../test/fixtures';

// #91: the app installs from Chrome (Android/desktop) and Safari (iOS).
test('the manifest and icons make the app installable', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser check is enough');
  await page.goto('/search');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'Binhopper', short_name: 'Binhopper', display: 'standalone', start_url: '/search', scope: '/' });
  // Chrome's own verdict (DevTools › Application › Manifest uses the same check).
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);

  for (const icon of manifest.icons.filter((i: { type: string }) => i.type === 'image/png')) {
    const png = await (await request.get(icon.src)).body();
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
  }
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
});

test('iOS gets its home-screen icon, title and theme colors', async ({ page, request }) => {
  await page.goto('/search');
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const png = await (await request.get(touch!)).body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Binhopper');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});
