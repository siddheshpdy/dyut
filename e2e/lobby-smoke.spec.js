import { expect, test } from '@playwright/test';

test('local lobby is usable from the running development server', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('DYUT').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /single player.*local|play now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /online match|play online/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /private match|custom game/i })).toBeVisible();
});

test('piece design selection is not shown in the top-level menu', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel(/piece design/i)).toHaveCount(0);
});
