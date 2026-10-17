import { test as base, expect, type Page } from '@playwright/test';
import fixture from '../../fixtures/marketplace.json';

const STORAGE_KEY = 'sb-beybridge-discovery-e2e-auth-token';
const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-10-07T12:00:00Z';

// Configured builds require an account, so discovery runs as a signed-in customer
// who owns no listings or reviews in the fixture.
function customerSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ sub: CUSTOMER_ID, exp: expiresAt }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`,
    refresh_token: 'test-refresh-discovery', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: CUSTOMER_ID, aud: 'authenticated', role: 'authenticated', email: 'discovery@example.invalid',
      email_confirmed_at: NOW, created_at: NOW, app_metadata: {}, user_metadata: { full_name: 'Discovery Customer' } },
  };
}

function customerProfile(preferredLanguage: 'en' | 'ar') {
  return { id: CUSTOMER_ID, full_name: 'Discovery Customer', avatar_url: null, phone: '',
    preferred_language: preferredLanguage, default_area: 'Hamra', account_type: 'customer',
    created_at: NOW, updated_at: NOW };
}

// Registered after the fixture's own init script, so the stored session is removed.
export async function signOutBeforeLoad(page: Page) {
  await page.addInitScript(key => localStorage.removeItem(key), STORAGE_KEY);
}

// Fictional records live only in the test runner and enter through the mocked API.
// They are never bundled with the app, including development builds.
// A signed-in profile language overrides the stored one, so Arabic tests set it here.
export const test = base.extend<{ profileLanguage: 'en' | 'ar' }>({
  profileLanguage: ['en', { option: true }],
  page: async ({ page, profileLanguage }, use) => {
    await page.addInitScript(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    }, { key: STORAGE_KEY, session: customerSession() });
    await page.routeWebSocket('**beybridge-discovery-e2e.invalid/**', socket => socket.close());
    await page.route('https://beybridge-discovery-e2e.invalid/**', async route => {
      const table = new URL(route.request().url()).pathname.split('/').at(-1);
      const body = table === 'profiles' ? [customerProfile(profileLanguage)] : table === 'providers' ? fixture.providers.map(p => ({
        id: p.id, owner_id: p.ownerId, name: p.name, category_id: p.categoryId,
        description: p.description, address: p.address, area: p.area, phone: p.phone,
        whatsapp: p.whatsapp, latitude: p.latitude, longitude: p.longitude,
        opening_hours: p.openingHours, is_verified: false, listing_status: 'published',
        service_mode: 'both', price_type: 'quote', starting_price: null, price_currency: 'USD',
        years_experience: null, emergency_service: false, moderation_status: 'active',
        moderation_reason: '', moderated_at: null,
      })) : table === 'reviews' ? fixture.reviews.map(r => ({
        id: r.id, provider_id: r.providerId, user_id: r.userId, author_name: r.userName,
        rating: r.rating, comment: r.comment, created_at: r.createdAt, updated_at: r.createdAt,
      })) : [];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await use(page);
  },
});

export { expect, type Page };
