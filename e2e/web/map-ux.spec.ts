import { expect, test } from './helpers/discovery-backend';

test('all services opens a browsable map results panel', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('button', { name: 'All services', exact: true }).click();
  const sheet = page.getByTestId('map-results-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('All services', { exact: true })).toBeVisible();
  await expect(sheet.getByText(/^\d+ places$/)).toBeVisible();
  await page.getByRole('button', { name: 'Close map results' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('Explore services on the map')).toBeVisible();
});

test('selected place can be dismissed without losing map search', async ({ page }) => {
  await page.goto('/map');
  // Select through the accessible location browser used by web and Expo Go.
  const firstLocation = page.getByTestId('provider-map-fallback').getByRole('button').first();
  await firstLocation.click();
  await expect(page.getByText('View service', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close selected service' }).click();
  await expect(page.getByText('View service', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Search services on the map')).toHaveValue('');
});

test('choosing a result reveals the map when results are expanded', async ({ page }) => {
  await page.goto('/map?query=tire');
  const toggle = page.getByRole('button', { name: 'Expand or collapse map results' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Show RoadReady Tire Help on map' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Search services on the map')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show RoadReady Tire Help on map' }))
    .toHaveAttribute('aria-selected', 'true');
  // Selecting the same place again after exploring must also reveal the map.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Show RoadReady Tire Help on map' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('directions opens a route to the selected service', async ({ page, context }) => {
  await context.route('https://www.google.com/maps/**', route => route.fulfill({ body: 'Maps' }));
  await page.goto('/map?providerId=p1');
  await expect(page.getByText('View service', { exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Get directions to RapidFlow Plumbing' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/google\.com\/maps\/dir\/\?api=1&destination=/);
  const url = new URL(popup.url());
  expect(url.searchParams.get('destination')).toMatch(/^\d+\.\d+,\d+\.\d+$/);
});

test('location denial leaves service discovery usable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.permissions.query = async () => ({ state: 'denied' } as PermissionStatus);
  });
  await page.goto('/map?query=tire');
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await expect(page.getByText('Location access was not granted. You can still search by area.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Distance', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Show RoadReady Tire Help on map' })).toBeVisible();
  await page.getByRole('button', { name: 'Verified', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close map results' })).toBeVisible();
});

test('map results handle supports keyboard activation', async ({ page }) => {
  await page.goto('/map?query=tire');
  const toggle = page.getByRole('button', { name: 'Expand or collapse map results' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('a direct map entry can return to home', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('button', { name: 'Go back from service map' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('What can we help with?')).toBeVisible();
});

test('empty map search can recover on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/map?query=doesnotexist');
  await expect(page.getByText('No places match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(page.getByLabel('Search services on the map')).toHaveValue('');
  await expect(page.getByTestId('map-results-sheet').getByText('All services', { exact: true })).toBeVisible();
  await expect(page.getByTestId('provider-map-fallback').getByRole('button').first()).toBeVisible();
  const hasOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasOverflow).toBe(false);
});

test('Arabic map localizes search intent, counts, and category descriptions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('beybridge.preferred-language', 'ar'));
  await page.goto('/map?query=tire');
  const sheet = page.getByTestId('map-results-sheet');
  await expect(sheet.getByText('الإطارات والمساعدة على الطريق', { exact: true })).toBeVisible();
  await expect(sheet.getByText('3 أماكن', { exact: true })).toBeVisible();
  await expect(page.getByTestId('provider-map-fallback').getByText('ميكانيكيون · Quarantina', { exact: true })).toBeVisible();
});
