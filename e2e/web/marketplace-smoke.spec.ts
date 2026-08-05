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

test('customer can explore provider locations from the home screen', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open service map' }).click();

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByText('Provider map')).toBeVisible();
  await expect(page.getByText(/service locations/)).toBeVisible();

  const firstLocation = page.getByRole('button', { name: /Select .* in/ }).first();
  await firstLocation.click();
  await expect(page.getByRole('button', { name: 'View RapidFlow Plumbing' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Get directions to / })).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('account setup and request areas guide unconfigured users safely', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText('Profile', { exact: true }).last().click();

  await expect(page.getByText('Connect Supabase to enable accounts')).toBeVisible();
  await expect(page.getByText('Create .env.local')).toBeVisible();

  await page.getByText('Requests', { exact: true }).last().click();

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
