import { expect, test } from '@playwright/test';
import catalog from '../../public/data/beirut-catalog.json';

for (const width of [320, 375, 412]) {
  test(`map toolbar stays clear of scrolling listing icons at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    if (width === 375) {
      await page.addInitScript(() => localStorage.setItem('beybridge.preferred-language', 'ar'));
    }
    await page.goto('/map');
    const locations = page.getByTestId('provider-map-fallback');
    await locations.getByRole('button', { name: 'Select Terra Cool in Beirut' }).click();
    await locations.evaluate(element => { element.scrollTop = 500; });
    const filters = page.getByLabel('Filter by service type');
    const back = page.getByRole('button', { name: 'Go back from service map' });
    await expect.poll(async () => {
      const listBounds = await locations.boundingBox();
      const filterBounds = await filters.boundingBox();
      return listBounds!.y - filterBounds!.y - filterBounds!.height;
    }).toBeGreaterThanOrEqual(8);
    const filterBounds = (await filters.boundingBox())!;
    const backBounds = (await back.boundingBox())!;
    expect(filterBounds.y - backBounds.y - backBounds.height).toBeGreaterThanOrEqual(8);
    const gapHitsListing = await page.evaluate(({ x, y }) => Boolean(
      document.elementFromPoint(x, y)?.closest('[data-testid="provider-map-fallback"]')
    ), { x: backBounds.x + backBounds.width / 2, y: (backBounds.y + backBounds.height + filterBounds.y) / 2 });
    expect(gapHitsListing).toBe(false);
    await expect(back).toBeInViewport();
    await expect(page.getByLabel('Search services on the map')).toBeInViewport();
    await page.getByLabel('Search services on the map').fill('tire');
    const searchBounds = (await page.getByTestId('map-search').boundingBox())!;
    const listButton = (await page.getByRole('button', { name: /View all .* filtered services as a list/ }).boundingBox())!;
    const row = [backBounds, searchBounds, listButton].sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      expect(row[i].x - row[i - 1].x - row[i - 1].width).toBeGreaterThanOrEqual(8);
    }
    await expect(page.getByRole('button', { name: 'Clear search', exact: true })).toBeInViewport();
  });
}

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

for (const { query, name } of [
  { query: 'phone repair', name: 'Bashir Services' },
  { query: 'courier', name: 'دي آش إل' },
]) {
  test(`reviewed ${query} listing is discoverable in the list and map`, async ({ page }) => {
    await page.goto(`/search?query=${encodeURIComponent(query)}`);
    await expect(page.getByText('1 service', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `View ${name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Call now', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get directions', exact: true })).toBeVisible();
    await expect(page.getByText('Source: OpenStreetMap contributors · ODbL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request this service' })).toHaveCount(0);
    await page.goto(`/map?query=${encodeURIComponent(query)}`);
    const locations = page.getByTestId('provider-map-fallback');
    await expect(locations.getByRole('button')).toHaveCount(1);
    await expect(locations.getByRole('button', { name: `Select ${name} in Beirut`, exact: true })).toBeVisible();
  });
}
