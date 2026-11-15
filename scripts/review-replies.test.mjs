import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeReviewReply, validateReviewReply, mapReviewReply } from '../src/lib/review-replies.ts';

test('reply normalization trims edges, standardizes line endings and limits blank lines', () => {
  assert.equal(normalizeReviewReply(' \r\nThank you!\r\n \r\n\r\n\r\nSee you soon. \t'), 'Thank you!\n\nSee you soon.');
  assert.equal(normalizeReviewReply('First\nSecond\n\nThird'), 'First\nSecond\n\nThird');
});

test('reply validation rejects empty, short and overlong bodies', () => {
  for (const body of ['', ' \n\t ', '\u00a0\ufeff', ' a ']) assert.equal(validateReviewReply(body), 'Use at least 2 characters for your reply.');
  assert.equal(validateReviewReply('a'.repeat(1001)), 'Keep your reply within 1000 characters.');
});

test('reply validation accepts both boundaries and Arabic text', () => {
  for (const body of ['ab', 'a'.repeat(1000), 'شكراً لثقتكم بنا', '  Thank you!  ']) {
    assert.equal(validateReviewReply(body), null);
  }
});

test('reply validation counts Unicode characters consistently with the database', () => {
  assert.equal(validateReviewReply('😀'), 'Use at least 2 characters for your reply.');
  assert.equal(validateReviewReply('😀'.repeat(1000)), null);
  assert.equal(validateReviewReply('😀'.repeat(1001)), 'Keep your reply within 1000 characters.');
});

test('reply mapping handles one-to-one embeds and older mock responses', () => {
  const row = { body: 'Thank you!', created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T01:00:00Z' };
  const expected = { body: row.body, createdAt: row.created_at, updatedAt: row.updated_at };
  assert.deepEqual(mapReviewReply(row), expected);
  assert.deepEqual(mapReviewReply([row]), expected);
  for (const value of [undefined, null, []]) assert.equal(mapReviewReply(value), null);
});
