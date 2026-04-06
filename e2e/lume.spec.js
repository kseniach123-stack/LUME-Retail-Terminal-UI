import { test, expect } from '@playwright/test';

test.describe('Lume terminal', () => {
  test('login, add to cart, checkout, see transaction', async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto('/');

    await page.getByTestId('auth-form').getByLabel('Username').fill('e2e-user');
    await page.getByTestId('auth-form').getByLabel('Password').fill('demo');
    await page.getByTestId('auth-submit').click();

    await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible();
    await page.locator('.btn-sell').first().click();
    await page.getByRole('button', { name: 'Open shopping cart' }).click();
    await page.getByRole('button', { name: 'Complete transaction and checkout' }).click();

    await expect(page.getByText(/Transaction completed successfully/i)).toBeVisible();

    await page.evaluate(() => window.LumeTerminal.ui.switchTab('operations'));
    await expect(page.locator('.transaction-row').first()).toBeVisible();
  });

  test('search filters grid and clear restores products', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-form').getByLabel('Username').fill('e2e-search');
    await page.getByTestId('auth-form').getByLabel('Password').fill('x');
    await page.getByTestId('auth-submit').click();

    await page.getByRole('textbox', { name: 'Search products' }).fill('zzznomatch');
    await expect(page.getByText(/No products match/i)).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.locator('.product-card').first()).toBeVisible();
  });
});
