// Renders the PWA/app icons from public/icons/*.svg with Playwright's Chromium (#91).
// Run from frontend/ after changing an SVG: node scripts/make-icons.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],  // iOS rounds the corners itself
  ['icon.svg', 'favicon-32.png', 32],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [source, name, size] of OUT) {
  const svg = await readFile(new URL(`../public/icons/${source}`, import.meta.url), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)), omitBackground: true });
  console.log(`public/icons/${name} (${size}×${size})`);
}
await browser.close();
