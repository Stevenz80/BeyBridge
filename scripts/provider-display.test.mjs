import assert from 'node:assert/strict';
import test from 'node:test';
import { localizedProviderNames } from '../src/lib/provider-names.ts';
import { getRecommendationScore } from '../src/lib/provider-ranking.ts';

const listing = (name, names, extra = {}) => ({ id: name, name, phone: '', whatsapp: '', ownerId: null,
  mapSource: names ? { names } : null, ...extra });

test('directory names follow the reader\'s language when the source maps both', () => {
  const providers = [listing('ووركشب كرس', ['ووركشب كرس', 'Chris Workshop']), listing('Garage Harout', ['Garage Harout']),
    listing('Khoury Cleaners', ['Khoury Cleaners', 'خوري كلينرز']), listing('فادي', ['فادي']), listing('Owner listing', null)];
  assert.deepEqual([...localizedProviderNames(providers, 'en')], [['ووركشب كرس', 'Chris Workshop']]);
  assert.deepEqual([...localizedProviderNames(providers, 'ar')], [['Khoury Cleaners', 'خوري كلينرز']]);
});

test('recommended order prefers verified, reviewed and contactable listings', () => {
  const none = { average: 0, count: 0 };
  const score = (extra, rating = none) => getRecommendationScore(listing('x', null, extra), rating);
  assert.ok(score({ phone: '+9611234567' }) > score({}));
  assert.ok(score({ whatsapp: '9611234567' }) > score({}));
  assert.ok(score({ isVerified: true }) > score({ phone: '+9611234567' }));
  assert.ok(score({}, { average: 4.5, count: 3 }) > score({ phone: '+9611234567' }));
});
