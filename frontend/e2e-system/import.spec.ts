import { expect, test } from '../test/fixtures';
import { signUp } from '../test/system-account';

// The system run has no Discogs app keys (and never calls Discogs), so this checks the real
// API's answer and the page's "not set up" state. The import itself is covered by
// test_discogs_import.py with a fake Discogs, including AC-11.
test('the import page loads from the real API', async ({ page }, testInfo) => {
  await signUp(page, `import-${testInfo.project.name}`);
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Bring your records' })).toBeVisible();
  await expect(page.getByText("Discogs import isn't set up on this server yet.")).toBeVisible();
});
