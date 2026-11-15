import type { Provider } from './types';

type Rating = { average: number; count: number };

// "Recommended" order: verified and well-reviewed listings first, then listings
// a customer can act on straight away (a phone or WhatsApp number) ahead of
// directory entries that only show a location.
export function getRecommendationScore(provider: Provider, rating: Rating) {
  return (
    Number(Boolean(provider.isVerified)) * 5 +
    rating.average * 2 +
    Math.log1p(rating.count) * 0.8 +
    Number(Boolean(provider.phone || provider.whatsapp)) * 1.5 +
    Number(Boolean(provider.ownerId)) * 0.5 +
    Number(Boolean(provider.emergencyService)) * 0.25
  );
}
