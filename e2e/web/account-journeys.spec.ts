import { expect, test } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, deferred, json, mockAccountBackend, profileFor,
  provider, requestA, switchAccount } from './helpers/account-backend';

test('a delayed profile response cannot replace the next account', async ({ page }) => {
  const alpha = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/profiles') && url.searchParams.get('id') === `eq.${ACCOUNT_A}`) {
      pending = true;
      await alpha.promise;
      await json(route, [profileFor(ACCOUNT_A)]);
      return true;
    }
    return false;
  });
  await page.goto('/profile');
  await expect.poll(() => pending).toBe(true);
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByText('beta@example.invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Customer Beta', { exact: true })).toBeVisible();
  const response = page.waitForResponse(url => url.url().includes(`/profiles?`) &&
    new URL(url.url()).searchParams.get('id') === `eq.${ACCOUNT_A}`);
  alpha.resolve();
  await response;
  // Let the released response and React commit finish before checking isolation.
  await page.waitForTimeout(200);
  await expect(page.getByText('Customer Alpha', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Customer Beta', { exact: true })).toBeVisible();
});

test('switching accounts hides the previous saved services while loading', async ({ page }) => {
  const beta = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/favorites') && url.searchParams.get('user_id') === `eq.${ACCOUNT_B}`) {
      pending = true;
      await beta.promise;
      await json(route, []);
      return true;
    }
    return false;
  });
  await page.goto('/favorites');
  await expect(page.getByRole('button', { name: `View ${provider.name}`, exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_B);
  await expect.poll(() => pending).toBe(true);
  await expect(page.getByRole('button', { name: `View ${provider.name}`, exact: true })).toHaveCount(0);
  beta.resolve();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
});

test('failed loading for a new account never shows the previous private request', async ({ page }) => {
  let switched = false;
  await mockAccountBackend(page, async (route, url) => {
    if (switched && url.pathname.endsWith('/service_requests')) {
      await json(route, { message: 'Test connection failed', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto('/request/test-request');
  await expect(page.getByText('Private Alpha kitchen repair', { exact: true })).toBeVisible();
  switched = true;
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByText('Private Alpha kitchen repair', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('a request detail load failure can retry without pretending the request is missing', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (fail && url.pathname.endsWith('/service_requests')) {
      await json(route, { message: 'Test connection failed', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto('/request/test-request');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText('Request unavailable', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Private Alpha kitchen repair', { exact: true })).toBeVisible();
});

test('a profile hides the previous name while the next profile is loading', async ({ page }) => {
  const beta = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/profiles') && url.searchParams.get('id') === `eq.${ACCOUNT_B}`) {
      pending = true;
      await beta.promise;
      await json(route, [profileFor(ACCOUNT_B)]);
      return true;
    }
    return false;
  });
  await page.goto('/profile');
  await expect(page.getByText('Customer Alpha', { exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_B);
  await expect.poll(() => pending).toBe(true);
  await expect(page.getByText('Customer Alpha', { exact: true })).toHaveCount(0);
  beta.resolve();
  await expect(page.getByText('Customer Beta', { exact: true })).toBeVisible();
});

test('notification loading cannot expose the previous account updates', async ({ page }) => {
  const beta = deferred();
  let switched = false;
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (switched && url.pathname.endsWith('/user_notifications')) {
      pending = true;
      await beta.promise;
      await json(route, []);
      return true;
    }
    return false;
  });
  await page.goto('/notifications');
  await expect(page.getByText('Private Alpha notification', { exact: true })).toBeVisible();
  switched = true;
  await switchAccount(page, ACCOUNT_B);
  await expect.poll(() => pending).toBe(true);
  await expect(page.getByText('Private Alpha notification', { exact: true })).toHaveCount(0);
  beta.resolve();
});

test('a failed favorite mutation from an old account cannot restore it in the new one', async ({ page }) => {
  const deletion = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/favorites') && route.request().method() === 'DELETE') {
      pending = true;
      await deletion.promise;
      await json(route, { message: 'Test deletion failed', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto('/favorites');
  await page.getByRole('button', { name: `Remove ${provider.name} from Saved`, exact: true }).click();
  await expect.poll(() => pending).toBe(true);
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
  const response = page.waitForResponse(response =>
    response.request().method() === 'DELETE' && response.url().includes('/favorites?'));
  deletion.resolve();
  await response;
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: `View ${provider.name}`, exact: true })).toHaveCount(0);
});

test('service discovery failure offers retry when starting a request', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (fail && url.pathname.endsWith('/providers')) {
      await json(route, { message: 'Test connection failed', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto(`/request/new?providerId=${provider.id}`);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByText('Service unavailable', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('What do you need?', { exact: true })).toBeVisible();
});

test('administrator UI is hidden while a different account role is being checked', async ({ page }) => {
  const beta = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/platform_admins')) {
      if (url.searchParams.get('user_id') === `eq.${ACCOUNT_B}`) {
        pending = true;
        await beta.promise;
        await json(route, []);
      } else {
        await json(route, [{ user_id: ACCOUNT_A }]);
      }
      return true;
    }
    return false;
  });
  await page.goto('/profile');
  const admin = page.getByRole('button', { name: 'Open administrator dashboard' });
  await expect(admin).toBeVisible();
  await switchAccount(page, ACCOUNT_B);
  await expect.poll(() => pending).toBe(true);
  await expect(admin).toHaveCount(0);
  beta.resolve();
});

test('switching accounts closes an editor containing the previous account details', async ({ page }) => {
  await mockAccountBackend(page);
  await page.goto('/profile');
  await expect(page.getByText('+9613123456', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Edit profile/ }).click();
  await expect(page.getByPlaceholder('Your name')).toHaveValue('Customer Alpha');
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByRole('button', { name: 'Close profile editor' })).toHaveCount(0);
  await expect(page.getByText('Customer Beta', { exact: true })).toBeVisible();
});

test('profile fields retain accessible names when populated', async ({ page }) => {
  await mockAccountBackend(page);
  await page.goto('/profile');
  await expect(page.getByText('+9613123456', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Edit profile/ }).click();
  await expect(page.getByPlaceholder('Your name')).toHaveAccessibleName('Full name');
  await expect(page.getByPlaceholder('+961…')).toHaveAccessibleName('Phone number');
});

test('request fields have stable accessible names', async ({ page }) => {
  await mockAccountBackend(page);
  await page.goto(`/request/new?providerId=${provider.id}`);
  await expect(page.getByPlaceholder('Example: The kitchen sink is leaking under the cabinet and the valve may need replacing.'))
    .toHaveAccessibleName('Describe the job');
  await expect(page.getByPlaceholder('Street, building, neighborhood, or landmark'))
    .toHaveAccessibleName('Service address or area');
});

test('a customer can retry submitting a request without losing the draft', async ({ page }) => {
  let fail = true;
  let saved = requestA;
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/service_requests')) return false;
    if (route.request().method() === 'POST') {
      if (fail) {
        await json(route, { message: 'Test request could not be sent', code: 'TEST_ERROR' }, 503);
      } else {
        const input = route.request().postDataJSON();
        saved = { ...requestA, ...input };
        await json(route, saved);
      }
      return true;
    }
    if (url.searchParams.get('customer_id') === `eq.${ACCOUNT_A}`) {
      await json(route, [saved]);
      return true;
    }
    return false;
  });
  await page.goto(`/request/new?providerId=${provider.id}`);
  const description = page.getByLabel('Describe the job', { exact: true });
  await description.fill('Please repair the leaking kitchen sink this week.');
  const address = page.getByLabel('Service address or area', { exact: true });
  await address.fill('Hamra Street, building 10');
  await page.getByRole('button', { name: 'Send service request', exact: true }).click();
  await expect(page.getByText('Test request could not be sent', { exact: true })).toBeVisible();
  await expect(description).toHaveValue('Please repair the leaking kitchen sink this week.');
  await expect(address).toHaveValue('Hamra Street, building 10');
  fail = false;
  await page.getByRole('button', { name: 'Send service request', exact: true }).click();
  await expect(page).toHaveURL(/\/request\/test-request$/);
  await expect(page.getByText('Please repair the leaking kitchen sink this week.', { exact: true })).toBeVisible();
});

test('saved-service load failure offers retry rather than an empty account', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (fail && url.pathname.endsWith('/favorites')) {
      await json(route, { message: 'Test favorites unavailable', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto('/favorites');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing saved yet')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${provider.name}`, exact: true })).toBeVisible();
});

test('profile load failure is visible and recoverable', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (fail && url.pathname.endsWith('/profiles')) {
      await json(route, { message: 'Test profile unavailable', code: 'TEST_ERROR' }, 503);
      return true;
    }
    return false;
  });
  await page.goto('/profile');
  await expect(page.getByText('Your profile could not be loaded. Please try again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('+9613123456', { exact: true })).toBeVisible();
  await expect(page.getByText('Your profile could not be loaded. Please try again.', { exact: true })).toHaveCount(0);
});
