import { expect, test, type Page, type Route } from '@playwright/test';
import { ACCOUNT_A, ACCOUNT_B, deferred, json, mockAccountBackend, profileFor, sessionFor, switchAccount } from './helpers/account-backend';
import { isPasswordRecoveryUrl, parseAuthCallbackUrl } from '../../src/lib/auth';

function recoveryLink(id = ACCOUNT_A) {
  const session = sessionFor(id);
  return `/auth/reset-password#${new URLSearchParams({ access_token: session.access_token,
    refresh_token: session.refresh_token, type: 'recovery', expires_in: '3600', token_type: 'bearer' })}`;
}

function requestAccount(route: Route) {
  const token = route.request().headers().authorization?.split(' ')[1];
  return token?.split('.')[1] ? JSON.parse(atob(token.split('.')[1]
    .replace(/-/g, '+').replace(/_/g, '/'))).sub as string : ACCOUNT_A;
}

async function mockRecovery(page: Page, override?: (route: Route, url: URL) => Promise<boolean>, signedOut = true) {
  await mockAccountBackend(page, async (route, url) => {
    if (override && await override(route, url)) return true;
    if (url.pathname === '/auth/v1/user') {
      await json(route, sessionFor(requestAccount(route)).user);
      return true;
    }
    return false;
  }, { signedOut });
}

test('recovery links parse web and native destinations without accepting other routes', () => {
  const native = 'beybridge://auth/reset-password#access_token=test&refresh_token=refresh&type=recovery';
  expect(isPasswordRecoveryUrl(native)).toBe(true);
  expect(isPasswordRecoveryUrl('beybridge:///auth/reset-password?code=test-code')).toBe(true);
  expect(isPasswordRecoveryUrl('https://example.invalid/auth/reset-password/')).toBe(true);
  expect(isPasswordRecoveryUrl('beybridge://auth/callback#type=recovery')).toBe(false);
  expect(isPasswordRecoveryUrl('invalid-url')).toBe(false);
  expect(isPasswordRecoveryUrl('javascript:/auth/reset-password')).toBe(false);
  expect(parseAuthCallbackUrl(native)).toMatchObject({ accessToken: 'test', refreshToken: 'refresh', type: 'recovery' });
  expect(parseAuthCallbackUrl('beybridge://auth/reset-password?code=test-code').authorizationCode).toBe('test-code');
});

test('sign-in offers recovery, normalizes email and prevents repeated sends', async ({ page }) => {
  const send = deferred();
  let requests = 0;
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/recover') return false;
    requests += 1;
    expect(route.request().postDataJSON().email).toBe('alpha@example.invalid');
    expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4174/auth/reset-password');
    await send.promise;
    await json(route, {});
    return true;
  });
  await page.goto('/profile');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(' Alpha@Example.invalid ');
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('Alpha@Example.invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeDisabled();
  send.resolve();
  await expect(page.getByText('If an account uses this email, you’ll receive a reset link shortly.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send another reset link', exact: true })).toBeDisabled();
  expect(requests).toBe(1);
});

test('failed reset email retains the address and can retry', async ({ page }) => {
  let fail = true;
  let requests = 0;
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/recover') return false;
    requests += 1;
    await json(route, fail ? { message: 'Test email unavailable' } : {}, fail ? 503 : 200);
    return true;
  });
  await page.goto('/auth/forgot-password');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.fill('invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await email.fill('alpha@example.invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('The reset email could not be sent. Check your connection and try again.', { exact: true })).toBeVisible();
  await expect(email).toHaveValue('alpha@example.invalid');
  fail = false;
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('If an account uses this email, you’ll receive a reset link shortly.', { exact: true })).toBeVisible();
});

test('rate limiting gives actionable feedback', async ({ page }) => {
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/recover') return false;
    await json(route, { message: 'Test rate limited', error_code: 'over_email_send_rate_limit' }, 429);
    return true;
  });
  await page.goto('/auth/forgot-password');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('alpha@example.invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('Too many reset requests. Please wait a minute and try again.', { exact: true })).toBeVisible();
});

test('unknown accounts receive the same neutral reset-request feedback', async ({ page }) => {
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/recover') return false;
    await json(route, { message: 'User not found', error_code: 'user_not_found' }, 400);
    return true;
  });
  await page.goto('/auth/forgot-password');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('unknown@example.invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('If an account uses this email, you’ll receive a reset link shortly.', { exact: true })).toBeVisible();
  await expect(page.getByText('User not found', { exact: true })).toHaveCount(0);
});

test('an ordinary signed-in session cannot open the reset form without an email link', async ({ page }) => {
  await mockRecovery(page, undefined, false);
  await page.goto('/auth/reset-password');
  await expect(page.getByText('Reset link unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'New password', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request a new reset link', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password$/);
});

test('expired email redirects are handled even when another account is signed in', async ({ page }) => {
  await mockRecovery(page, undefined, false);
  await page.goto('/auth/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+expired');
  await expect(page.getByText('This reset link is invalid or has expired. Request a new link to continue.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'New password', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
});

test('invalid recovery tokens never unlock the password form', async ({ page }) => {
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/user') return false;
    await json(route, { message: 'Invalid JWT', error_code: 'bad_jwt' }, 401);
    return true;
  }, false);
  await page.goto(recoveryLink());
  await expect(page.getByText('This reset link is invalid or has expired. Request a new link to continue.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'New password', exact: true })).toHaveCount(0);
});

test('a non-recovery token link does not open the password form', async ({ page }) => {
  await mockRecovery(page);
  await page.goto(recoveryLink().replace('type=recovery', 'type=signup'));
  await expect(page.getByText('This reset link is invalid or has expired. Request a new link to continue.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
});

test('link verification distinguishes a connection failure from an expired link', async ({ page }) => {
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/user') return false;
    await json(route, { message: 'Test auth unavailable' }, 503);
    return true;
  });
  await page.goto(recoveryLink());
  await expect(page.getByText('Your reset link could not be checked. Check your connection and open the email link again.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
});

for (const failure of [{ status: 401, code: 'session_not_found' }, { status: 422, code: 'reauthentication_needed' }]) {
  test(`password updates requiring a new session recover via a new link (${failure.code})`, async ({ page }) => {
    await mockRecovery(page, async (route, url) => {
      if (url.pathname !== '/auth/v1/user' || route.request().method() !== 'PUT') return false;
      await json(route, { message: 'Test session unavailable', error_code: failure.code }, failure.status);
      return true;
    });
    await page.goto(recoveryLink());
    await page.getByLabel('New password', { exact: true }).fill('NewSecret123!');
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewSecret123!');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(page.getByText('This reset link is invalid or has expired. Request a new link to continue.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Request a new reset link', exact: true })).toBeVisible();
  });
}

test('a verified email-link session validates passwords and recovers from update failure', async ({ page }) => {
  let fail = true;
  let updates = 0;
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/user' || route.request().method() !== 'PUT') return false;
    updates += 1;
    expect(route.request().postDataJSON().password).toBe('NewSecret123!');
    expect(requestAccount(route)).toBe(ACCOUNT_A);
    await json(route, fail ? { message: 'Test password service unavailable' } : sessionFor(ACCOUNT_A).user, fail ? 503 : 200);
    return true;
  });
  await page.goto(recoveryLink());
  const password = page.getByLabel('New password', { exact: true });
  const confirmation = page.getByLabel('Confirm new password', { exact: true });
  await expect(password).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await password.fill('short');
  await confirmation.fill('short');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password must be at least 8 characters.', { exact: true })).toBeVisible();
  await password.fill('NewSecret123!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('The passwords do not match.', { exact: true })).toBeVisible();
  expect(updates).toBe(0);
  await confirmation.fill('NewSecret123!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Your password could not be updated. Please try again.', { exact: true })).toBeVisible();
  await expect(password).toHaveValue('NewSecret123!');
  fail = false;
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  await expect(password).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to account', exact: true }).click();
  await expect(page.getByText('alpha@example.invalid', { exact: true })).toBeVisible();
  expect(updates).toBe(2);
});

test('PKCE recovery exchanges the code once and removes it from the URL', async ({ page }) => {
  let exchanges = 0;
  await page.addInitScript(() => {
    localStorage.setItem('sb-beybridge-e2e-auth-token-code-verifier', JSON.stringify('test-verifier/recovery'));
  });
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/token') return false;
    exchanges += 1;
    expect(url.searchParams.get('grant_type')).toBe('pkce');
    expect(route.request().postDataJSON()).toMatchObject({ auth_code: 'test-code', code_verifier: 'test-verifier' });
    await json(route, sessionFor(ACCOUNT_A));
    return true;
  });
  await page.goto('/auth/reset-password?code=test-code');
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  expect(exchanges).toBe(1);
});

test('an account change hides the password draft and survives an old update response', async ({ page }) => {
  const update = deferred();
  let pending = false;
  await mockRecovery(page, async (route, url) => {
    if (url.pathname !== '/auth/v1/user' || route.request().method() !== 'PUT') return false;
    pending = true;
    await update.promise;
    await json(route, sessionFor(ACCOUNT_A).user);
    return true;
  });
  await page.goto(recoveryLink());
  await page.getByLabel('New password', { exact: true }).fill('NewSecret123!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('NewSecret123!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect.poll(() => pending).toBe(true);
  await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeDisabled();
  await switchAccount(page, ACCOUNT_B);
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  const response = page.waitForResponse(response => response.url().endsWith('/auth/v1/user') &&
    response.request().method() === 'PUT');
  update.resolve();
  await response;
  await page.waitForTimeout(200);
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to account', exact: true }).click();
  await expect(page.getByText('beta@example.invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('alpha@example.invalid', { exact: true })).toHaveCount(0);
});

test('Arabic recovery remains usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockRecovery(page, async (route, url) => {
    if (url.pathname.endsWith('/profiles')) {
      await json(route, [{ ...profileFor(ACCOUNT_A), preferred_language: 'ar' }]);
      return true;
    }
    return false;
  }, false);
  await page.goto('/auth/forgot-password');
  await expect(page.getByRole('button', { name: 'إرسال رابط إعادة التعيين', exact: true })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('ordinary OAuth callbacks still finish sign-in', async ({ page }) => {
  await mockRecovery(page);
  const session = sessionFor(ACCOUNT_A);
  await page.goto(`/auth/callback#${new URLSearchParams({ access_token: session.access_token,
    refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', type: 'signup' })}`);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('alpha@example.invalid', { exact: true })).toBeVisible();
});
