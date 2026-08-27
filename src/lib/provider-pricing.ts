import type { Provider } from './types';

export type PriceSortDirection = 'ascending' | 'descending';

// Banque du Liban's published USD/LBP rate is used only to make mixed-currency
// listings comparable while sorting. Prices remain displayed in their original currency.
const LBP_PER_USD_REFERENCE_RATE = 89_500;

export function compareProviderPrices(
  a: Provider,
  b: Provider,
  direction: PriceSortDirection
) {
  const aPrice = getComparableStartingPrice(a);
  const bPrice = getComparableStartingPrice(b);

  // A listing without a numeric price cannot be ranked honestly, so quote-only
  // services always follow services that publish a starting price.
  if (aPrice === null && bPrice === null) return 0;
  if (aPrice === null) return 1;
  if (bPrice === null) return -1;

  const priceDifference =
    direction === 'ascending' ? aPrice - bPrice : bPrice - aPrice;

  return priceDifference;
}

export function formatCompactProviderPrice(provider: Provider) {
  if (getComparableStartingPrice(provider) === null) return 'Quote';

  const amount = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(
    provider.startingPrice!
  );
  const suffix = provider.priceType === 'hourly' ? '/hr' : '+';

  return `${amount} ${provider.priceCurrency ?? 'USD'}${suffix}`;
}

function getComparableStartingPrice(provider: Provider) {
  const price = provider.startingPrice;
  if (
    provider.priceType === 'quote' ||
    price == null ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  return provider.priceCurrency === 'LBP' ? price / LBP_PER_USD_REFERENCE_RATE : price;
}
