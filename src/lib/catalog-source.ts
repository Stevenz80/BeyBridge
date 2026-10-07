/** Reserved IDs from the original, fictional database seed. Never hide owned listings. */
export function isLegacyDemoProvider(provider: { id: string; ownerId?: string | null }) {
  return !provider.ownerId && /^p(?:[1-9]|1[0-9]|20)$/.test(provider.id);
}

export function isLegacyDemoReview(review: { id: string; userId: string | null }) {
  return !review.userId && /^10000000-0000-4000-8000-00000000000[1-6]$/.test(review.id);
}
