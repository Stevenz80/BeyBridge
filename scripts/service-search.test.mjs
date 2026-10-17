import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeServiceSearch,
  normalizeSearchText,
  scoreProviderForSearch,
} from '../src/lib/service-search.ts';

const TIRE_CATEGORY_ID = 4;
const AC_CATEGORY_ID = 9;

function provider(overrides = {}) {
  return {
    id: 'p1',
    categoryId: 1,
    name: 'Test service',
    description: '',
    area: 'Hamra',
    address: '',
    mapSource: null,
    ...overrides,
  };
}

test('keeps Arabic words whole when they carry hamza, madda or vowel marks', () => {
  assert.equal(normalizeSearchText('إطار مثقوب'), 'اطار مثقوب');
  assert.equal(normalizeSearchText('آلة'), 'اله');
  assert.equal(normalizeSearchText('مُكيّف'), 'مكيف');
  assert.equal(normalizeSearchText('صـيـانـة'), 'صيانه');
});

test('normalizes Arabic-Indic digits and Latin accents', () => {
  assert.equal(normalizeSearchText('٠٣ ١٢٣'), '03 123');
  assert.equal(normalizeSearchText('Café Ü'), 'cafe u');
});

test('matches Arabic intents typed with or without hamza and vowel marks', () => {
  for (const query of ['اطار', 'إطار', 'إطار مثقوب']) {
    assert.equal(analyzeServiceSearch(query).categoryIds[0], TIRE_CATEGORY_ID, query);
  }
  assert.equal(analyzeServiceSearch('مُكيّف').categoryIds[0], AC_CATEGORY_ID);
});

test('keeps English problem matching and provider token scoring', () => {
  const analysis = analyzeServiceSearch('flat tire');
  assert.equal(analysis.categoryIds[0], TIRE_CATEGORY_ID);

  const named = analyzeServiceSearch('hamra plumbers');
  const score = scoreProviderForSearch(provider(), { id: 1, name: 'Plumbing' }, named);
  assert.ok(score >= 60, `expected a strong match, received ${score}`);
});

test('returns no score for unrelated text and a neutral score for an empty query', () => {
  const unrelated = analyzeServiceSearch('zzzz');
  assert.equal(scoreProviderForSearch(provider(), undefined, unrelated), 0);
  assert.equal(scoreProviderForSearch(provider(), undefined, analyzeServiceSearch('')), 1);
});
