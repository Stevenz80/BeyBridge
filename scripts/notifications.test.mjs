import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Isolate the route helper from native push registration and Supabase imports.
const source = readFileSync(new URL('../src/lib/notifications.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
runInNewContext(outputText, { exports, require: () => ({}) });
const { getSafeNotificationRoute } = exports;

test('review reply notifications can open provider details', () => {
  for (const id of ['123e4567-e89b-12d3-a456-426614174000', 'provider_1-Ab', 'a'.repeat(100)]) {
    const route = `/provider/${id}`;
    assert.equal(getSafeNotificationRoute(route), route);
  }
});

test('notification routes reject traversal and invalid provider links', () => {
  for (const route of [
    '/provider/../x',
    '/provider/%2e%2e',
    '/provider/',
    '/provider/a/b',
    '/provider/a?next=/admin',
    '/provider/a#reviews',
    `/provider/${'a'.repeat(101)}`,
    'https://example.com/provider/a',
    '//example.com/provider/a',
    '/unknown',
    null,
    undefined,
    42,
  ]) {
    assert.equal(getSafeNotificationRoute(route), null, String(route));
  }
});

test('existing notification destinations remain available', () => {
  for (const route of [
    '/notifications',
    '/provider/verification',
    '/business',
    '/admin',
    '/request/123e4567-e89b-12d3-a456-426614174000',
  ]) {
    assert.equal(getSafeNotificationRoute(route), route);
  }
});
