import { type Page, type Route } from '@playwright/test';

export const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
export const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const STORAGE_KEY = 'sb-beybridge-e2e-auth-token';
const NOW = '2026-10-07T12:00:00Z';

export function sessionFor(id: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ sub: id, exp: expiresAt }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`,
    refresh_token: `test-refresh-${id}`,
    token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id, aud: 'authenticated', role: 'authenticated',
      email: id === ACCOUNT_A ? 'alpha@example.invalid' : 'beta@example.invalid',
      email_confirmed_at: NOW, created_at: NOW, app_metadata: {},
      user_metadata: { full_name: id === ACCOUNT_A ? 'Customer Alpha' : 'Customer Beta' } },
  };
}

export function profileFor(id: string) {
  return { id, full_name: id === ACCOUNT_A ? 'Customer Alpha' : 'Customer Beta',
    avatar_url: null, phone: '+9613123456', preferred_language: 'en', default_area: 'Hamra',
    account_type: 'customer', created_at: NOW, updated_at: NOW };
}

export const provider = {
  id: 'test-provider', owner_id: null, category_id: 1, name: 'Test Plumbing',
  description: 'A test plumbing service.', address: 'Hamra Street', area: 'Hamra',
  phone: '+9613123456', whatsapp: '9613123456', latitude: 33.8959, longitude: 35.4821,
  opening_hours: {}, is_verified: false, listing_status: 'published', service_mode: 'both',
  price_type: 'quote', starting_price: null, price_currency: 'USD', years_experience: null,
  emergency_service: false, moderation_status: 'active', moderation_reason: '', moderated_at: null,
};

export const requestA = {
  id: 'test-request', provider_id: provider.id, provider_owner_id: null, customer_id: ACCOUNT_A,
  provider_name: provider.name, customer_name: 'Customer Alpha', customer_phone: '+9613123456',
  description: 'Private Alpha kitchen repair', service_address: 'Private Alpha address',
  service_latitude: null, service_longitude: null, preferred_schedule: '', urgency: 'standard',
  budget_amount: null, budget_currency: 'USD', status: 'requested', provider_message: '',
  quoted_price: null, scheduled_for: null, review_prompted_at: null, created_at: NOW, updated_at: NOW,
};

export async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export async function mockAccountBackend(page: Page, override?: (route: Route, url: URL) => Promise<boolean>) {
  const session = sessionFor(ACCOUNT_A);
  await page.addInitScript(({ key, session }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
  }, { key: STORAGE_KEY, session });
  await page.routeWebSocket('**beybridge-e2e.invalid/**', socket => socket.close());
  await page.route('https://beybridge-e2e.invalid/**', async route => {
    const url = new URL(route.request().url());
    if (override && await override(route, url)) return;
    const table = url.pathname.split('/').at(-1);
    const token = route.request().headers().authorization?.split(' ')[1];
    const accountId = token?.split('.')[1]
      ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub as string
      : ACCOUNT_A;
    const id = url.searchParams.get('id')?.slice(3) ?? ACCOUNT_A;
    if (table === 'profiles') return json(route, [profileFor(id)]);
    if (table === 'providers') return json(route, [provider]);
    if (table === 'favorites') return json(route,
      url.searchParams.get('user_id') === `eq.${ACCOUNT_A}` ? [{ provider_id: provider.id }] : []);
    if (table === 'service_requests') return json(route,
      url.searchParams.get('customer_id') === `eq.${ACCOUNT_A}` ? [requestA] : []);
    if (table === 'user_notifications') return json(route, accountId === ACCOUNT_A ? [{ id: 'alpha-notification',
      user_id: ACCOUNT_A, kind: 'request_status', title: 'Private Alpha notification',
      body: 'Private Alpha update', route: '/requests', entity_id: null, read_at: null, created_at: NOW }] : []);
    if (table === 'platform_admins') return json(route, []);
    if (['reviews', 'reports', 'provider_verification_requests', 'provider_moderation_actions',
      'get_my_push_delivery_health'].includes(table ?? '')) return json(route, []);
    throw new Error(`Unexpected mocked backend request: ${route.request().method()} ${url.pathname}`);
  });
}

export async function switchAccount(page: Page, id: string) {
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: 'SIGNED_IN', session });
    channel.close();
  }, { key: STORAGE_KEY, session: sessionFor(id) });
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
