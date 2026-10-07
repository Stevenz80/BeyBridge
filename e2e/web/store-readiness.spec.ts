import { expect, test } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, deferred, json, mockAccountBackend, profileFor, provider, switchAccount } from './helpers/account-backend';

test('legacy dummy listings are hidden while owned listings remain discoverable', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [
        { ...provider, id: 'p1', name: 'Legacy dummy plumbing', owner_id: null },
        { ...provider, id: 'p2', name: 'Owner maintained service', owner_id: ACCOUNT_B },
      ]);
      return true;
    }
    return false;
  }, { signedOut: true });
  await page.goto('/');
  await expect(page.getByText('Owner maintained service', { exact: true })).toBeVisible();
  await expect(page.getByText('Legacy dummy plumbing', { exact: true })).toHaveCount(0);
});

test('an empty real catalog explains availability without inventing listings', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/providers') { await json(route, []); return true; }
    return false;
  }, { signedOut: true });
  await page.goto('/');
  await expect(page.getByText('No services are listed yet. Please check back soon.')).toBeVisible();
  await expect(page.getByText('Top rated in Beirut', { exact: true })).toHaveCount(0);
});

test('map directory entries show provenance and missing details without offering in-app booking', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [{ ...provider, id: 'osm-node-123', name: 'OSM regression fixture', phone: '', whatsapp: '',
        map_source: { kind: 'openstreetmap', url: 'https://www.openstreetmap.org/node/123',
          updatedAt: '2026-10-01T00:00:00Z', importedAt: '2026-10-07T00:00:00Z', openingHours: '' } }]);
      return true;
    }
    return false;
  }, { signedOut: true });
  await page.goto('/provider/osm-node-123');
  await expect(page.getByText('Source: OpenStreetMap contributors · ODbL')).toBeVisible();
  await expect(page.getByText('This business has not joined BeyBridge. Contact it directly to confirm services and availability.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View original map listing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request this service' })).toHaveCount(0);
  await expect(page.getByText('Opening hours not listed')).toBeVisible();
  await expect(page.getByText('Not listed', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Contact for quote', { exact: true })).toHaveCount(0);
});

test('synthetic seed reviews do not inflate real listing ratings', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/reviews') {
      await json(route, [{ id: '10000000-0000-4000-8000-000000000001', user_id: null,
        provider_id: provider.id, author_name: 'Seed author', rating: 5,
        comment: 'Synthetic seed review', created_at: '2026-06-20', updated_at: '2026-06-20' }]);
      return true;
    }
    return false;
  }, { signedOut: true });
  await page.goto(`/provider/${provider.id}`);
  await expect(page.getByText('Reviews (0)', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic seed review')).toHaveCount(0);
});

test('privacy, terms and deletion information are accessible without an account', async ({ page }) => {
  await mockAccountBackend(page, undefined, { signedOut: true });
  await page.goto('/profile');
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.getByText('Location and documents', { exact: true })).toBeVisible();
  await expect(page.getByText('Draft: operator, support, and retention details must be completed before release.')).toBeVisible();
  await page.goto('/legal/terms');
  await expect(page.getByText('Content you submit', { exact: true })).toBeVisible();
  await page.goto('/legal/deletion');
  await expect(page.getByText('Request deletion without the app', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open account deletion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permanently delete account' })).toHaveCount(0);
});

test('deletion requires explicit confirmation and signs out only after server success', async ({ page }) => {
  let calls = 0;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/functions/v1/delete-account') {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ confirmation: 'DELETE' });
      expect(route.request().headers().authorization).toContain('Bearer ');
      await json(route, { deleted: true }); return true;
    }
    if (url.pathname === '/auth/v1/logout') { await json(route, {}, 403); return true; }
    return false;
  });
  await page.goto('/profile');
  await page.getByRole('link', { name: 'Delete account', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Permanently delete account' });
  await expect(submit).toBeDisabled();
  await page.getByRole('textbox', { name: 'Deletion confirmation' }).fill('delete');
  await expect(submit).toBeDisabled(); expect(calls).toBe(0);
  await page.getByRole('textbox', { name: 'Deletion confirmation' }).fill('DELETE');
  await submit.click();
  await expect(page.getByText('Your BeyBridge account and associated data have been deleted.')).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Return to home', exact: true }).click();
  await page.getByRole('tab', { name: /Profile/ }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Customer Alpha', { exact: true })).toHaveCount(0);
});

test('a failed deletion retains the account and permits a retry', async ({ page }) => {
  let calls = 0;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname !== '/functions/v1/delete-account') return false;
    calls++; await json(route, { error: 'Temporarily unavailable' }, 503); return true;
  });
  await page.goto('/account/delete');
  const confirmation = page.getByRole('textbox', { name: 'Deletion confirmation' });
  await confirmation.fill('DELETE');
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page.getByText(/Account deletion could not be completed/)).toBeVisible();
  await expect(confirmation).toHaveValue('DELETE');
  await expect(page.getByText('alpha@example.invalid', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect.poll(() => calls).toBe(2);
});

test('a late deletion response cannot sign out the next account', async ({ page }) => {
  const gate = deferred(); let pending = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname !== '/functions/v1/delete-account') return false;
    pending = true; await gate.promise; await json(route, { deleted: true }); return true;
  });
  await page.goto('/account/delete');
  await page.getByRole('textbox', { name: 'Deletion confirmation' }).fill('DELETE');
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect.poll(() => pending).toBe(true);
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByText('beta@example.invalid', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Deletion confirmation' })).toHaveValue('');
  const response = page.waitForResponse(url => url.url().endsWith('/functions/v1/delete-account'));
  gate.resolve(); await response;
  await expect(page.getByText('beta@example.invalid', { exact: true })).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByText('Customer Beta', { exact: true })).toBeVisible();
});

test('blocking a provider hides their listings and can be undone from the account', async ({ page }) => {
  let blocked = false;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/providers')) { await json(route, [{ ...provider, owner_id: ACCOUNT_B }]); return true; }
    if (!url.pathname.endsWith('/user_blocks')) return false;
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toMatchObject({ user_id: ACCOUNT_A, blocked_user_id: ACCOUNT_B });
      blocked = true; await json(route, []); return true;
    }
    if (route.request().method() === 'DELETE') { blocked = false; await json(route, []); return true; }
    await json(route, blocked ? [{ blocked_user_id: ACCOUNT_B, display_name: provider.name }] : []); return true;
  });
  await page.goto(`/provider/${provider.id}`);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Block ${provider.name}`, exact: true }).click();
  await expect(page.getByText('Service unavailable', { exact: true })).toBeVisible();
  await page.goto('/account/blocked-users');
  await page.getByRole('button', { name: `Unblock ${provider.name}`, exact: true }).click();
  await expect(page.getByText('You haven’t blocked anyone.')).toBeVisible();
  await page.goto(`/provider/${provider.id}`);
  await expect(page.getByRole('button', { name: `Block ${provider.name}`, exact: true })).toBeVisible();
});

test('blocked review authors are hidden and block state does not leak to another account', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/user_blocks')) {
      await json(route, url.searchParams.get('user_id') === `eq.${ACCOUNT_A}`
        ? [{ blocked_user_id: ACCOUNT_B, display_name: 'Blocked reviewer' }] : []); return true;
    }
    if (url.pathname.endsWith('/reviews')) {
      await json(route, [{ id: 'blocked-review', user_id: ACCOUNT_B, provider_id: provider.id,
        author_name: 'Blocked reviewer', rating: 2, comment: 'A review hidden only for Alpha.',
        created_at: '2026-10-07T12:00:00Z', updated_at: '2026-10-07T12:00:00Z' }]); return true;
    }
    return false;
  });
  await page.goto(`/provider/${provider.id}`);
  await expect(page.getByText('Reviews (0)', { exact: true })).toBeVisible();
  await expect(page.getByText('A review hidden only for Alpha.', { exact: true })).toHaveCount(0);
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByText('A review hidden only for Alpha.', { exact: true })).toBeVisible();
});

test('account creation requires community agreement and permits reading without losing the form', async ({ page }) => {
  await mockAccountBackend(page, undefined, { signedOut: true });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Create account', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('New customer');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('new@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByRole('button', { name: /^Create account/ }).last().click();
  await expect(page.getByText('Agree to the terms and community rules before creating an account.')).toBeVisible();
  await page.getByRole('button', { name: 'Read terms and community rules', exact: true }).click();
  await expect(page.getByText('Content you submit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close terms', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveValue('New customer');
  await page.getByRole('checkbox', { name: 'I agree to the terms and community rules' }).check();
});

test('an administrator can remove a reported review and keep its moderation record', async ({ page }) => {
  let removed = false;
  const report = { id: 'review-report', reporter_id: ACCOUNT_A, reporter_name: 'Customer Alpha',
    target_type: 'review', provider_id: provider.id, review_id: 'reported-review', target_name: 'Reviewer Beta',
    target_snapshot: 'Reported review content', reason: 'abuse', details: 'This review contains inappropriate content.',
    status: 'open', admin_note: '', reviewed_by: null, created_at: '2026-10-07T12:00:00Z',
    updated_at: '2026-10-07T12:00:00Z', resolved_at: null };
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname.endsWith('/platform_admins')) { await json(route, [{ user_id: ACCOUNT_A }]); return true; }
    if (url.pathname.endsWith('/reports')) {
      await json(route, [{ ...report, ...(removed ? { review_id: null, status: 'resolved',
        admin_note: 'Removed after reviewing the abusive content.' } : {}) }]); return true;
    }
    if (url.pathname.endsWith('/reviews')) {
      await json(route, removed ? [] : [{ id: 'reported-review', user_id: ACCOUNT_B, provider_id: provider.id,
        author_name: 'Reviewer Beta', rating: 2, comment: 'Reported review content',
        created_at: report.created_at, updated_at: report.updated_at }]); return true;
    }
    if (url.pathname.endsWith('/remove_reported_review')) {
      expect(route.request().postDataJSON()).toEqual({ p_report_id: report.id,
        p_reason: 'Removed after reviewing the abusive content.' });
      removed = true; await json(route, null); return true;
    }
    return false;
  });
  await page.goto(`/admin/report/${report.id}`);
  await page.getByRole('textbox', { name: 'Moderation reason', exact: true }).fill('Removed after reviewing the abusive content.');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove reported review', exact: true }).click();
  await expect(page.getByText('Resolved', { exact: true })).toBeVisible();
  await expect(page.getByText('Reported review content', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove reported review', exact: true })).toHaveCount(0);
  await page.goto(`/provider/${provider.id}`);
  await expect(page.getByText('Reviews (0)', { exact: true })).toBeVisible();
  await expect(page.getByText('Reported review content', { exact: true })).toHaveCount(0);
});

test('Arabic deletion remains readable and usable on a narrow screen', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (!url.pathname.endsWith('/profiles')) return false;
    await json(route, [{ ...profileFor(ACCOUNT_A), preferred_language: 'ar' }]); return true;
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/account/delete');
  const confirmation = page.getByRole('textbox', { name: 'تأكيد الحذف', exact: true });
  await confirmation.fill('DELETE');
  await expect(page.getByRole('button', { name: 'حذف الحساب نهائياً', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'الاحتفاظ بحسابي', exact: true }).click();
  await page.getByRole('link', { name: 'سياسة الخصوصية', exact: true }).click();
  await expect(page.getByText('سياسة الخصوصية', { exact: true }).last()).toBeVisible();
});
