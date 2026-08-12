import { test, expect } from '@playwright/test';

test('home explains Sparaton before projects', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Sparaton Studios/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Work gets better');
  await expect(page.getByRole('link', { name: /Start a conversation/ })).toBeVisible();
});

test('theme can be changed and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
});

test('service passes context into inquiry', async ({ page }) => {
  await page.goto('/services');
  const cta = page.getByRole('link', { name: /Request a quote/ }).first();
  const href = await cta.getAttribute('href');
  expect(href).toMatch(/^\/contact\?service=.+/);
  await Promise.all([
    page.waitForURL(/\/contact\?service=.+/),
    cta.click()
  ]);
  await expect(page.locator('input[name=service]')).not.toHaveValue('');
});

test('robots protects ticket paths', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(await response.text()).toContain('Disallow: /tickets/');
});

test('unknown page is a 404', async ({ request }) => {
  expect((await request.get('/definitely-not-a-page')).status()).toBe(404);
});
