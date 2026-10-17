import { expect, test } from './helpers/discovery-backend';
import catalog from '../../public/data/beirut-catalog.json';

for (const hasMapSource of [false, true]) {
  test(`service discovery supports ${hasMapSource ? 'current' : 'pre-migration'} catalog schemas`, async ({ page }) => {
    const renderingErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' && message.text().includes('Unexpected text node')) {
        renderingErrors.push(message.text());
      }
    });
    const provider = catalog.providers[0];
    await page.route('https://beybridge-discovery-e2e.invalid/rest/v1/providers*', async route => {
      const columns = new URL(route.request().url()).searchParams.get('select')?.split(',').map(column => column.trim());
      if (!hasMapSource && columns?.includes('map_source')) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
          code: '42703', message: 'column providers.map_source does not exist',
        }) });
        return;
      }
      const row = hasMapSource ? provider : Object.fromEntries(
        Object.entries(provider).filter(([column]) => column !== 'map_source')
      );
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([row]) });
    });

    await page.goto('/search');
    const listing = page.getByRole('button', { name: `View ${provider.name}`, exact: true });
    await expect(listing).toBeVisible();
    await expect(page.getByText('Services could not be refreshed. Check your connection and try again.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Call provider', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'WhatsApp provider', exact: true })).toHaveCount(0);
    await listing.click();
    await expect(page).toHaveURL(new RegExp(`/provider/${provider.id}$`));
    await expect(page.getByText('Source: OpenStreetMap contributors · ODbL', { exact: true })).toHaveCount(hasMapSource ? 1 : 0);
    expect(renderingErrors).toEqual([]);
  });
}
