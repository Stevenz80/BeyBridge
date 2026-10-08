import { expect, test } from '@playwright/test';
import catalog from '../../public/data/beirut-catalog.json';

// Actual shipped OSM data, no provider/review API interception.
test('real Beirut catalog is browsable and attributed without a backend', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Services in Beirut', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Business data © OpenStreetMap contributors · ODbL' })).toBeVisible();
  await page.goto('/search?query=Terra%20Cool');
  await page.getByRole('button', { name: 'View Terra Cool', exact: true }).click();
  await expect(page.getByText('Source: OpenStreetMap contributors · ODbL')).toBeVisible();
  await expect(page.getByText('Map information may be outdated. Confirm details directly.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request this service' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Write a review' })).toHaveCount(0);
  await expect(page.getByText('Reviews (0)', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('all imported businesses are available on the map and unsupported categories stay empty', async ({ page }) => {
  await page.goto('/map');
  const locations = page.getByTestId('provider-map-fallback');
  await expect(locations.getByRole('button')).toHaveCount(catalog.providers.length);
  await expect(locations.getByRole('link', { name: 'Business data © OpenStreetMap contributors · ODbL' })).toBeVisible();
  await locations.getByRole('button', { name: 'Select Terra Cool in Beirut' }).click();
  await expect(page.getByRole('button', { name: 'View Terra Cool', exact: true })).toBeVisible();
  await page.goto('/search?query=plumber');
  await expect(page.getByText('No services found', { exact: true })).toBeVisible();
  await expect(page.getByText('0 services', { exact: true })).toBeVisible();
  await expect(page.getByText('RapidFlow Plumbing', { exact: true })).toHaveCount(0);
});

test('the distributed catalog can be downloaded with its license and source', async ({ request }) => {
  const response = await request.get('/data/beirut-catalog.json');
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.providers).toHaveLength(catalog.providers.length);
  expect(data.license).toBe('ODbL-1.0');
  expect(data.boundaryCode).toBe('LB-BA');
  expect(data.providers.every((p: { is_verified: boolean; owner_id: string | null }) => !p.is_verified && p.owner_id === null)).toBe(true);
  expect((await request.get('/data/beirut-source.json')).ok()).toBe(true);
});

test('source English names find Arabic-named businesses', async ({ page }) => {
  await page.goto('/search?query=Plaza%20Laundry');
  await expect(page.getByRole('button', { name: 'View مصبغة بلازا', exact: true })).toBeVisible();
  await page.goto('/search?query=Natco');
  await expect(page.getByRole('button', { name: 'View ناتكو (كيا)', exact: true })).toBeVisible();
});
