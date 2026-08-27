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

  await expect(page.getByText('What can we help with?')).toBeVisible();
  await expect(page.getByText('Quick help')).toBeVisible();
  await expect(page.getByText('Top rated in Beirut')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open notifications' })).toBeVisible();

  await page.getByLabel('Search for a service').fill('tire');
  await page.getByLabel('Submit search').click();

  await expect(page).toHaveURL(/\/search\?query=tire/);
  await expect(page.getByPlaceholder('Try “tire change” or “broken fridge”')).toHaveValue(
    'tire'
  );
  await expect(page.getByText(/Matching Tire & roadside help/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'View RoadReady Tire Help' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Garage 961' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View SafeTow Lebanon' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mechanics', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Towing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plumbers', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('search-price-sort')).toBeVisible();
  await page.getByTestId('search-price-sort').selectOption('descending');
  await expect(page.getByTestId('search-price-sort')).toHaveValue('descending');
  await expect(page.getByRole('button', { name: 'Recommended', exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ services?$/)).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Search for a service')).toHaveValue('');

  expect(runtimeErrors).toEqual([]);
});

test('semantic search results carry from the list to the interactive map filters', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/search?query=tire', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'View these services on the map' }).click();

  await expect(page).toHaveURL(/\/map\?query=tire/);
  await expect(page.getByLabel('Search services on the map')).toHaveValue('tire');
  await expect(page.getByText('3 places')).toBeVisible();
  await expect(
    page
      .getByTestId('map-results-sheet')
      .getByText('Tire & roadside help', { exact: true })
  ).toBeVisible();
  const sheetToggle = page.getByRole('button', {
    name: 'Expand or collapse map results',
  });
  await expect(sheetToggle).toBeVisible();
  await expect(page.getByLabel('Drag map results up or down')).toBeVisible();
  const partiallyOpenListCanScroll = await page
    .getByTestId('map-results-list')
    .evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(partiallyOpenListCanScroll).toBe(true);

  await sheetToggle.click();
  await expect(page.getByLabel('Search services on the map')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Go back from service map' })
  ).toBeVisible();
  await page.waitForTimeout(400);
  await sheetToggle.click();
  await expect(page.getByLabel('Search services on the map')).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Show RoadReady Tire Help on map' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Garage 961 on map' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show SafeTow Lebanon on map' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plumbers', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Mechanics', exact: true }).click();
  await expect(page.getByText('1 place')).toBeVisible();
  await expect(page.getByText('Mechanics', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Garage 961 on map' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show RoadReady Tire Help on map' })
  ).toHaveCount(0);

  expect(runtimeErrors).toEqual([]);
});

test('preferred Arabic language localizes the whole app shell and home experience', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.addInitScript(() => {
    window.localStorage.setItem('beybridge.preferred-language', 'ar');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('كيف يمكننا مساعدتك؟')).toBeVisible();
  await expect(page.getByText('مساعدة سريعة')).toBeVisible();
  await expect(page.getByText('الأعلى تقييماً في بيروت')).toBeVisible();
  await expect(page.getByText('الرئيسية', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('الملف الشخصي', { exact: true }).last()).toBeVisible();
  await expect(page.locator('[lang="ar"]').first()).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('customer can explore provider locations from the home screen', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open service map for Beirut' }).click();

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByText('Explore services by area')).toBeVisible();

  await page.getByRole('button', { name: 'Plumbers' }).click();
  await expect(page.getByText('1 place')).toBeVisible();
  await expect(page.getByText('Plumbers', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Relevance' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Distance' })).toBeVisible();
  await expect(page.getByTestId('map-price-sort')).toBeVisible();
  await page.getByTestId('map-price-sort').selectOption('ascending');
  await expect(page.getByTestId('map-price-sort')).toHaveValue('ascending');
  await expect(page.getByRole('button', { name: 'Relevance', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open now' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show RapidFlow Plumbing on map' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show Mishwar Express on map' })
  ).toHaveCount(0);

  const topRatedFilter = page.getByRole('button', { name: 'Top rated' });
  await topRatedFilter.click();
  await expect(page.getByRole('button', { name: 'Top rated', exact: true })).toBeVisible();

  const rapidFlowLocation = page.getByRole('button', {
    name: 'Show RapidFlow Plumbing on map',
  });
  await rapidFlowLocation.click();
  await expect(page.getByRole('button', { name: 'View RapidFlow Plumbing' })).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('account setup and request areas guide anonymous users safely', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText('Profile', { exact: true }).last().click();

  // The smoke build deliberately strips local Supabase credentials so the
  // browser suite stays deterministic and never talks to the live project.
  await expect(page.getByText('Connect Supabase to enable accounts')).toBeVisible();
  await expect(page.getByText('EXPO_PUBLIC_SUPABASE_URL=…')).toBeVisible();

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
