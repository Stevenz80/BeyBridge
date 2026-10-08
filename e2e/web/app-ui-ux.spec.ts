import { expect, test, type Locator, type Page } from '@playwright/test';
import { Colors } from '../../src/constants/theme';
import { ACCOUNT_A, ACCOUNT_B, deferred, json, mockAccountBackend, profileFor, provider, switchAccount } from './helpers/account-backend';

async function setup(page: Page, locale: 'en' | 'ar' = 'en', signedOut = false, owned = false) {
  await page.addInitScript(locale => localStorage.setItem('beybridge.preferred-language', locale), locale);
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/profiles') {
      await json(route, [{ ...profileFor(ACCOUNT_A), preferred_language: locale }]);
      return true;
    }
    if (owned && url.pathname === '/rest/v1/providers') {
      await json(route, [{ ...provider, owner_id: ACCOUNT_A }]);
      return true;
    }
    return false;
  }, { signedOut });
}

async function expectWithinWidth(control: Locator, width: number) {
  await expect(control).toBeVisible();
  const bounds = (await control.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
}

for (const locale of ['en', 'ar'] as const) {
  test(`bottom navigation labels fit at 320px (${locale})`, async ({ page }) => {
    await setup(page, locale);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    const labels = await tabs.evaluateAll(tabs => tabs.flatMap(tab =>
      [...tab.querySelectorAll('*')].filter(el => el.childElementCount === 0 && el.textContent!.trim())
        .map(el => ({ text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth,
          bottom: el.getBoundingClientRect().bottom, height: el.getBoundingClientRect().height,
          fontSize: parseFloat(getComputedStyle(el).fontSize) }))));
    for (const label of labels) {
      expect(label.scrollWidth, label.text!).toBeLessThanOrEqual(label.width + 1);
      expect(label.bottom, label.text!).toBeLessThanOrEqual(740);
      if (locale === 'ar' && /^[\u0600-\u06ff]/.test(label.text!)) {
        expect(label.height, label.text!).toBeGreaterThanOrEqual(label.fontSize * 1.4);
      }
    }
    await page.getByRole('tab', { name: locale === 'ar' ? 'الملف الشخصي' : 'Profile', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test(`home header controls fit at 320px with separated touch targets (${locale})`, async ({ page }) => {
    await setup(page, locale);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/');
    const notifications = page.getByTestId('home-notifications-link');
    const map = page.getByTestId('home-map-link');
    await expectWithinWidth(notifications, 320);
    await expectWithinWidth(map, 320);
    const bounds = [(await notifications.boundingBox())!, (await map.boundingBox())!].sort((a, b) => a.x - b.x);
    expect(bounds[1].x - bounds[0].x - bounds[0].width).toBeGreaterThanOrEqual(8);
    await map.click();
    await expect(page).toHaveURL(/\/map$/);
  });

  test(`password visibility stays inside its field and preserves the value (${locale})`, async ({ page }) => {
    await setup(page, locale, true);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/profile');
    const password = page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password', { exact: true });
    await password.fill('A valid password');
    const toggle = page.getByRole('button', { name: locale === 'ar' ? 'إظهار كلمة المرور' : 'Show password', exact: true });
    await expectWithinWidth(toggle, 320);
    const bounds = (await toggle.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(48);
    expect(bounds.height).toBeGreaterThanOrEqual(48);
    const field = (await password.locator('..').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(field.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(field.x + field.width);
    await toggle.click();
    await expect(password).toHaveJSProperty('type', 'text');
    await expect(password).toHaveValue('A valid password');
    await page.getByRole('button', { name: locale === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveValue('A valid password');
  });

  test(`service location controls fit and still open the picker (${locale})`, async ({ page }) => {
    await setup(page, locale);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`/request/new?providerId=${provider.id}`);
    const picker = page.getByRole('button', { name: 'Choose service location on map', exact: true });
    await expectWithinWidth(picker, 320);
    await picker.click();
    await expect(page.getByText(locale === 'ar' ? 'اختر موقع الخدمة' : 'Choose service location', { exact: true })).toBeVisible();
  });
}

test('listing fields and emergency availability keep stable accessible names', async ({ page }) => {
  await setup(page);
  await page.goto('/provider/manage');
  const name = page.getByRole('textbox', { name: 'Business or professional name', exact: true });
  await name.fill('A provider business');
  await expect(name).toHaveValue('A provider business');
  const description = page.getByRole('textbox', { name: 'Service description', exact: true });
  await description.fill('Genuine repair services described by their provider.');
  await expect(description).toHaveValue('Genuine repair services described by their provider.');
  await expect(page.getByRole('textbox', { name: 'Phone number', exact: true })).toHaveValue('+9613123456');
  const emergency = page.getByRole('switch', { name: 'Emergency or same-day service', exact: true });
  await emergency.check();
  await expect(emergency).toBeChecked();
  await emergency.uncheck();
  await expect(emergency).not.toBeChecked();
});

test('verification fields are labeled and describe the existing document workflow', async ({ page }) => {
  await setup(page, 'en', false, true);
  await page.goto(`/provider/verification?providerId=${provider.id}`);
  await page.getByRole('textbox', { name: 'Business registration (optional)', exact: true }).fill('Registration reference');
  await page.getByRole('textbox', { name: 'Professional licence (optional)', exact: true }).fill('Licence reference');
  await page.getByRole('textbox', { name: 'Verification evidence', exact: true }).fill('Business identity and professional experience for review.');
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeEnabled();
  await expect(page.getByText('After submitting, you can attach private supporting documents while your request is pending. Never include passwords or bank details.', { exact: true })).toBeVisible();
});

test('report details retain their accessible name after typing', async ({ page }) => {
  await setup(page);
  await page.goto(`/report/new?providerId=${provider.id}`);
  const details = page.getByRole('textbox', { name: 'What happened?', exact: true });
  await details.fill('The facts supporting this report for administrator review.');
  await expect(details).toHaveValue('The facts supporting this report for administrator review.');
});

for (const path of ['/request/new', '/report/new', '/provider/verification']) {
  test(`anonymous guidance can scroll to its action in landscape (${path})`, async ({ page }) => {
    await setup(page, 'en', true);
    await page.setViewportSize({ width: 568, height: 240 });
    await page.goto(path);
    const action = page.getByRole('button', { name: 'Go to profile', exact: true });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport({ ratio: 1 });
    await action.click();
    await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  });
}

test('secondary reading text meets normal-text contrast on app surfaces', () => {
  const luminance = (color: string) => {
    const channels = color.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const foreground of [Colors.textMuted, Colors.textSubtle, Colors.primaryDark]) {
    for (const background of [Colors.surface, Colors.background, Colors.primarySoft]) {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('switching provider accounts hides previous performance while new metrics load', async ({ page }) => {
  const betaMetrics = deferred();
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/profiles') {
      const id = url.searchParams.get('id')?.slice(3) ?? ACCOUNT_A;
      await json(route, [{ ...profileFor(id), account_type: 'provider' }]);
      return true;
    }
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [
        { ...provider, owner_id: ACCOUNT_A },
        { ...provider, id: 'beta-provider', name: 'Beta Plumbing', owner_id: ACCOUNT_B },
      ]);
      return true;
    }
    if (url.pathname === '/rest/v1/rpc/get_provider_analytics') {
      const token = route.request().headers().authorization.split(' ')[1];
      const account = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
      if (account === ACCOUNT_B) await betaMetrics.promise;
      await json(route, { completed_value_usd: account === ACCOUNT_A ? 42123 : 123 });
      return true;
    }
    return false;
  });
  try {
    await page.goto('/business');
    await expect(page.getByText('42,123 USD', { exact: true })).toBeVisible();
    await switchAccount(page, ACCOUNT_B);
    await expect(page.getByText('Beta Plumbing', { exact: true })).toBeVisible();
    await expect(page.getByText('42,123 USD', { exact: true })).toHaveCount(0);
    betaMetrics.resolve();
    await expect(page.getByText('123 USD', { exact: true })).toBeVisible();
  } finally {
    betaMetrics.resolve();
  }
});

test('listing creation retries a profile load failure instead of asking a signed-in user to sign in', async ({ page }) => {
  let failing = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname !== '/rest/v1/profiles') return false;
    await json(route, failing ? { message: 'Account unavailable' } : [profileFor(ACCOUNT_A)], failing ? 503 : 200);
    return true;
  });
  await page.goto('/provider/manage');
  await expect(page.getByText('Your profile could not be loaded. Please try again.', { exact: true })).toBeVisible();
  await expect(page.getByText('Sign in to list a service', { exact: true })).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Business or professional name', exact: true })).toHaveValue('Customer Alpha');
});

test('customers can start a listing when public discovery is unavailable', async ({ page }) => {
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/providers') {
      await json(route, { message: 'Catalog unavailable' }, 503);
      return true;
    }
    if (url.pathname === '/rest/v1/rpc/get_provider_analytics') {
      await json(route, {});
      return true;
    }
    return false;
  });
  await page.goto('/business');
  await page.getByRole('button', { name: 'Start my listing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Business or professional name', exact: true })).toHaveValue('Customer Alpha');
});

test('listing editing retries discovery failure instead of claiming the listing disappeared', async ({ page }) => {
  let failing = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname !== '/rest/v1/providers') return false;
    await json(route, failing ? { message: 'Catalog unavailable' } : [{ ...provider, owner_id: ACCOUNT_A }], failing ? 503 : 200);
    return true;
  });
  await page.goto(`/provider/manage?id=${provider.id}`);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByText('Listing not found', { exact: true })).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Business or professional name', exact: true })).toHaveValue(provider.name);
});

test('reporting retries unavailable discovery instead of reporting missing content', async ({ page }) => {
  let failing = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname !== '/rest/v1/providers') return false;
    await json(route, failing ? { message: 'Catalog unavailable' } : [provider], failing ? 503 : 200);
    return true;
  });
  await page.goto(`/report/new?providerId=${provider.id}`);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByText('Content unavailable', { exact: true })).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'What happened?', exact: true })).toBeVisible();
});

test('verification load failure can retry before another verification is submitted', async ({ page }) => {
  let failing = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [{ ...provider, owner_id: ACCOUNT_A }]); return true;
    }
    if (url.pathname !== '/rest/v1/provider_verification_requests') return false;
    await json(route, failing ? { message: 'Verification unavailable' } : [], failing ? 503 : 200);
    return true;
  });
  await page.goto(`/provider/verification?providerId=${provider.id}`);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Verification evidence', exact: true })).toBeVisible();
});

test('provider dashboard retries request failure without presenting a false empty inbox', async ({ page }) => {
  let failing = true;
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/profiles') {
      await json(route, [{ ...profileFor(ACCOUNT_A), account_type: 'provider' }]); return true;
    }
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [{ ...provider, owner_id: ACCOUNT_A }]); return true;
    }
    if (url.pathname === '/rest/v1/service_requests') {
      await json(route, failing ? { message: 'Requests unavailable' } : [], failing ? 503 : 200); return true;
    }
    if (url.pathname === '/rest/v1/rpc/get_provider_analytics') {
      await json(route, {}); return true;
    }
    return false;
  });
  await page.goto('/business');
  await expect(page.getByText('Could not refresh requests', { exact: true })).toBeVisible();
  await expect(page.getByText('Request count unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('No customer requests yet', { exact: true })).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('No customer requests yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Could not refresh requests', { exact: true })).toHaveCount(0);
});

for (const locale of ['en', 'ar'] as const) {
test(`verification documents recover from loading failure without suggesting that none exist (${locale})`, async ({ page }) => {
  let failing = true;
  await page.addInitScript(locale => localStorage.setItem('beybridge.preferred-language', locale), locale);
  await mockAccountBackend(page, async (route, url) => {
    if (url.pathname === '/rest/v1/profiles') {
      await json(route, [{ ...profileFor(ACCOUNT_A), preferred_language: locale }]); return true;
    }
    if (url.pathname === '/rest/v1/providers') {
      await json(route, [{ ...provider, owner_id: ACCOUNT_A }]); return true;
    }
    if (url.pathname === '/rest/v1/provider_verification_requests') {
      await json(route, [{ id: 'verification-alpha', provider_id: provider.id,
        provider_owner_id: ACCOUNT_A, provider_name: provider.name,
        business_registration: '', license_number: '', evidence_summary: 'Provider identity evidence',
        status: 'pending', admin_note: '', reviewed_by: null, reviewed_at: null,
        submitted_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }]);
      return true;
    }
    if (url.pathname === '/storage/v1/object/list/provider-verification') {
      await json(route, failing ? { statusCode: '503', error: 'Unavailable', message: 'Documents unavailable' } :
        [{ id: 'document-alpha', name: '123456-abc123-business-license.pdf', created_at: '2026-10-08T00:00:00Z',
          metadata: { size: 1024, mimetype: 'application/pdf' } }], failing ? 503 : 200);
      return true;
    }
    return false;
  });
  await page.goto(`/provider/verification?providerId=${provider.id}`);
  await expect(page.getByText('Documents unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText(locale === 'ar' ? 'لا توجد مستندات مرفقة.' : 'No documents attached.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: locale === 'ar' ? 'إرفاق مستند' : 'Attach a document', exact: true })).toBeDisabled();
  const retry = page.getByRole('button', { name: locale === 'ar' ? 'إعادة محاولة تحميل المستندات' : 'Retry documents', exact: true });
  await expect(retry).toBeVisible();
  failing = false;
  await retry.click();
  await expect(page.getByRole('button', { name: `${locale === 'ar' ? 'فتح المستند' : 'Open document'}: business-license.pdf`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: locale === 'ar' ? 'إرفاق مستند آخر' : 'Attach another document', exact: true })).toBeEnabled();
  await expect(page.getByText('Documents unavailable', { exact: true })).toHaveCount(0);
});
}
