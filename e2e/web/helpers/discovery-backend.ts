import { test as base, expect, type Page } from '@playwright/test';
import fixture from '../../fixtures/marketplace.json';

// Fictional records live only in the test runner and enter through the mocked API.
// They are never bundled with the app, including development builds.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.routeWebSocket('**beybridge-discovery-e2e.invalid/**', socket => socket.close());
    await page.route('https://beybridge-discovery-e2e.invalid/**', async route => {
      const table = new URL(route.request().url()).pathname.split('/').at(-1);
      const body = table === 'providers' ? fixture.providers.map(p => ({
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
