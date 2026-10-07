import { expect, test } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, deferred, json, mockAccountBackend, provider, requestA, switchAccount } from './helpers/account-backend';

test('failed reviews show unavailable feedback and recover without a false empty rating', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/reviews')) return false;
    await json(route, fail ? { message: 'Test reviews unavailable', code: 'TEST_ERROR' } : [{
      id: 'test-review', provider_id: provider.id, user_id: ACCOUNT_B,
      author_name: 'Customer Beta', rating: 4, comment: 'A reliable plumbing service.',
      created_at: requestA.created_at, updated_at: requestA.updated_at,
    }], fail ? 503 : 200);
    return true;
  });
  await page.goto(`/provider/${provider.id}`);
  await expect(page.getByText('Reviews could not be refreshed. Ratings may be unavailable or out of date.', { exact: true })).toBeVisible();
  await expect(page.getByText('New—no reviews yet', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No written reviews yet.', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry reviews', exact: true }).click();
  await expect(page.getByText('A reliable plumbing service.', { exact: true })).toBeVisible();
  await expect(page.getByText('Ratings unavailable', { exact: true })).toHaveCount(0);
});

test('an account change closes the previous review draft', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/service_requests')) return false;
    await json(route, url.searchParams.has('customer_id') ? [{ ...requestA, status: 'completed',
      review_prompted_at: requestA.created_at }] : []);
    return true;
  });
  await page.goto(`/provider/${provider.id}`);
  await page.getByRole('button', { name: /Write a review/ }).click();
  const comment = page.getByPlaceholder('What went well? Was the provider punctual, clear, and fairly priced?');
  await comment.fill('Private Alpha review draft.');
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toHaveCount(0);
  await expect(comment).toHaveCount(0);
});

test('failed quote acceptance displays feedback and can be retried', async ({ page }) => {
  let fail = true;
  let request = { ...requestA, status: 'quoted', quoted_price: 50 };
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/service_requests')) return false;
    if (route.request().method() === 'PATCH') {
      if (fail) await json(route, { message: 'Test request update failed', code: 'TEST_ERROR' }, 503);
      else {
        expect(url.searchParams.get('status')).toBe('eq.quoted');
        request = { ...request, ...route.request().postDataJSON() };
        await json(route, request);
      }
    } else await json(route, url.searchParams.has('customer_id') ? [request] : []);
    return true;
  });
  await page.goto('/request/test-request');
  await page.getByRole('button', { name: /Accept quote/ }).click();
  await expect(page.getByText('Test request update failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Quote ready', { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: /Accept quote/ }).click();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
  await expect(page.getByText('Test request update failed', { exact: true })).toHaveCount(0);
});

test('cancelling a request requires confirmation and then updates its status', async ({ page }) => {
  let request = { ...requestA };
  let mutations = 0;
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/service_requests')) return false;
    if (route.request().method() === 'PATCH') {
      mutations += 1;
      expect(url.searchParams.get('status')).toBe('eq.requested');
      request = { ...request, ...route.request().postDataJSON() };
      await json(route, request);
    } else await json(route, url.searchParams.has('customer_id') ? [request] : []);
    return true;
  });
  await page.goto('/request/test-request');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Cancel request/ }).click();
  await expect(page.getByText('Awaiting provider', { exact: true })).toBeVisible();
  expect(mutations).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Cancel request/ }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  expect(mutations).toBe(1);
});

test('completion waits for review recovery before prompting or acknowledging', async ({ page }) => {
  let fail = true;
  let acknowledgements = 0;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/reviews') && fail) {
      await json(route, { message: 'Test reviews unavailable', code: 'TEST_ERROR' }, 503);
      return true;
    }
    if (!url.pathname.endsWith('/service_requests')) return false;
    if (route.request().method() === 'PATCH') {
      acknowledgements += 1;
      await json(route, null);
    } else await json(route, url.searchParams.has('customer_id') ? [{ ...requestA, status: 'completed' }] : []);
    return true;
  });
  await page.goto('/request/test-request');
  await expect(page.getByText('Reviews could not be refreshed. Ratings may be unavailable or out of date.', { exact: true })).toBeVisible();
  expect(acknowledgements).toBe(0);
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry reviews', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toBeVisible();
  await expect.poll(() => acknowledgements).toBe(1);
});

test('review publishing retains a failed draft and uses accessible controls', async ({ page }) => {
  let fail = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/service_requests')) {
      await json(route, url.searchParams.has('customer_id') ? [{ ...requestA, status: 'completed',
        review_prompted_at: requestA.created_at }] : []);
      return true;
    }
    if (!url.pathname.endsWith('/reviews') || route.request().method() !== 'POST') return false;
    const payload = route.request().postDataJSON();
    expect(payload.rating).toBe(4);
    expect(payload.comment).toBe('The plumber arrived on time and fixed the sink.');
    await json(route, fail ? { message: 'Test review could not be saved', code: 'TEST_ERROR' } : {
      ...payload, id: 'test-review', created_at: requestA.created_at, updated_at: requestA.updated_at,
    }, fail ? 503 : 200);
    return true;
  });
  await page.goto(`/provider/${provider.id}`);
  await page.getByRole('button', { name: /Write a review/ }).click();
  const comment = page.getByRole('textbox', { name: 'Your experience', exact: true });
  await comment.fill('The plumber arrived on time and fixed the sink.');
  await page.getByRole('radio', { name: '4 stars', exact: true }).click();
  await page.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(page.getByText('Agree to the terms and community rules before publishing.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'I agree to the terms and community rules' }).check();
  await page.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(page.getByText('Test review could not be saved', { exact: true })).toBeVisible();
  await expect(comment).toHaveValue('The plumber arrived on time and fixed the sink.');
  fail = false;
  await page.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toHaveCount(0);
  await expect(page.getByText('The plumber arrived on time and fixed the sink.', { exact: true })).toBeVisible();
});

test('review deletion confirms the choice before removing feedback', async ({ page }) => {
  let deleted = false;
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/reviews')) return false;
    if (route.request().method() === 'DELETE') {
      deleted = true;
      await json(route, null);
    } else await json(route, [{ id: 'test-review', provider_id: provider.id, user_id: ACCOUNT_A,
      author_name: 'Customer Alpha', rating: 4, comment: 'A reliable plumbing service.',
      created_at: requestA.created_at, updated_at: requestA.updated_at }]);
    return true;
  });
  await page.goto(`/provider/${provider.id}`);
  await page.getByRole('button', { name: /Edit your review/ }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Delete review/ }).click();
  expect(deleted).toBe(false);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Delete review/ }).click();
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toHaveCount(0);
  expect(deleted).toBe(true);
  await expect(page.getByText('No written reviews yet.', { exact: true })).toBeVisible();
});

test('a dismissed review submission cannot close a newly opened draft', async ({ page }) => {
  const save = deferred();
  let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/service_requests')) {
      await json(route, url.searchParams.has('customer_id') ? [{ ...requestA, status: 'completed',
        review_prompted_at: requestA.created_at }] : []);
      return true;
    }
    if (!url.pathname.endsWith('/reviews') || route.request().method() !== 'POST') return false;
    pending = true;
    await save.promise;
    await json(route, { ...route.request().postDataJSON(), id: 'test-review',
      created_at: requestA.created_at, updated_at: requestA.updated_at });
    return true;
  });
  await page.goto(`/provider/${provider.id}`);
  await page.getByRole('button', { name: /Write a review/ }).click();
  const comment = page.getByPlaceholder('What went well? Was the provider punctual, clear, and fairly priced?');
  await comment.fill('The first submitted review.');
  await page.getByRole('checkbox', { name: 'I agree to the terms and community rules' }).check();
  await page.getByRole('button', { name: /Publish review/ }).click();
  await expect.poll(() => pending).toBe(true);
  await page.getByRole('button', { name: 'Close review form', exact: true }).click();
  await page.getByRole('button', { name: /Write a review/ }).click();
  await comment.fill('The new draft should stay open.');
  const response = page.waitForResponse(response => response.url().includes('/reviews') &&
    response.request().method() === 'POST');
  save.resolve();
  await response;
  await page.waitForTimeout(200);
  await expect(comment).toHaveValue('The new draft should stay open.');
});

test('provider quote, customer acceptance, scheduling and completion lead to a review', async ({ page }) => {
  let request = { ...requestA, provider_owner_id: ACCOUNT_B, quoted_price: null as number | null,
    review_prompted_at: null as string | null };
  const transitions: string[] = [];
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/providers')) {
      await json(route, [{ ...provider, owner_id: ACCOUNT_B }]);
      return true;
    }
    if (!url.pathname.endsWith('/service_requests')) return false;
    if (route.request().method() === 'PATCH') {
      const payload = route.request().postDataJSON();
      expect(url.searchParams.get('status')).toBe(`eq.${request.status}`);
      if (payload.status) transitions.push(payload.status);
      request = { ...request, ...payload };
      await json(route, payload.status ? request : null);
    } else await json(route, url.searchParams.get('customer_id') === `eq.${ACCOUNT_A}` ||
      url.searchParams.get('provider_owner_id') === `eq.${ACCOUNT_B}` ? [request] : []);
    return true;
  });
  await page.goto('/request/test-request');
  await expect(page.getByText('Awaiting provider', { exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_B);
  const quote = page.getByRole('textbox', { name: 'Quote amount', exact: true });
  await expect(quote).toBeVisible();
  await page.getByRole('button', { name: 'Send quote', exact: true }).click();
  await expect(page.getByText('Enter a positive amount before sending the quote.', { exact: true })).toBeVisible();
  expect(transitions).toEqual([]);
  await quote.fill('50');
  await page.getByRole('textbox', { name: 'Message to customer', exact: true }).fill('Parts and labor included.');
  await page.getByRole('button', { name: 'Send quote', exact: true }).click();
  await expect(page.getByText('Quote ready', { exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_A);
  await page.getByRole('button', { name: 'Accept quote', exact: true }).click();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_B);
  await page.getByRole('button', { name: 'Mark scheduled', exact: true }).click();
  await expect(page.getByText('Scheduled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start job', exact: true }).click();
  await expect(page.getByText('In progress', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Mark completed', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await switchAccount(page, ACCOUNT_A);
  await expect(page.getByRole('button', { name: 'Close review form', exact: true })).toBeVisible();
  await expect.poll(() => request.review_prompted_at).not.toBeNull();
  expect(transitions).toEqual(['quoted', 'accepted', 'scheduled', 'in_progress', 'completed']);
});
