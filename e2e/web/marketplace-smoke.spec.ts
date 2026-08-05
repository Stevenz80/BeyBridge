import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  return errors;
}

test('customer can discover and filter services', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Help, right when you need it.')).toBeVisible();
  await expect(page.getByText('Quick help')).toBeVisible();
  await expect(page.getByText('Top rated in Beirut')).toBeVisible();

  await page.getByLabel('Search for a service').fill('plumber');
  await page.getByLabel('Submit search').click();

  await expect(page).toHaveURL(/\/search\?query=plumber/);
  await expect(page.getByPlaceholder('Search service or provider')).toHaveValue('plumber');
  await expect(page.getByRole('button', { name: 'All services' })).toBeVisible();
  await expect(page.getByText(/services? found/)).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('account and request areas guide signed-out users safely', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/profile', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Welcome back')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

  await page.goto('/requests', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Sign in to track requests')).toBeVisible();
  await expect(
    page.getByText('Every quote, acceptance, and completed job will stay organized here.')
  ).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('administrator routes do not expose private queues anonymously', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Sign in required')).toBeVisible();
  await expect(
    page.getByText('Sign in with an administrator account to open this dashboard.')
  ).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});
