import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.5';
import { createDeleteAccountHandler } from './handler.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}
function fixture(failure = '', files = ['owner/submission/proof.pdf']) {
  const calls: string[] = [];
  let batch = files;
  const client = {
    auth: {
      getUser: (token: string) => {
        calls.push(`verify:${token}`);
        return Promise.resolve({ data: { user: failure === 'auth-check' ? null : { id: 'verified-owner' } },
          error: failure === 'auth-check' ? new Error('expired') : null });
      },
      admin: { deleteUser: (id: string, soft: boolean) => {
        assert(id === 'verified-owner' && soft === false);
        calls.push('delete-auth');
        return Promise.resolve({ error: failure === 'auth-delete' ? new Error('auth failed') : null });
      } },
    },
    rpc: (name: string, args: { p_user_id: string }) => {
      assert(args.p_user_id === 'verified-owner', 'Only verified JWT identity can be deleted');
      calls.push(name);
      return Promise.resolve({ data: name === 'account_deletion_files' ? batch.map(path => ({ path })) : null,
        error: failure === name ? new Error('rpc failed') : null });
    },
    storage: { from: (bucket: string) => {
      assert(bucket === 'provider-verification');
      return { remove: (paths: string[]) => {
        assert(paths.join() === batch.join()); calls.push('remove-files');
        if (failure !== 'storage-stuck') batch = [];
        return Promise.resolve({ error: failure === 'storage' ? new Error('offline') : null });
      } };
    } },
  } as unknown as SupabaseClient;
  return { calls, handle: createDeleteAccountHandler(client) };
}
function request(body: object = { confirmation: 'DELETE' }, token: string | null = 'verified-token', method = 'POST') {
  return new Request('https://backend.invalid/functions/v1/delete-account', {
    method, headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

Deno.test('delete endpoint rejects unauthenticated, unconfirmed and unsupported requests', async () => {
  for (const [input, expected] of [[request({}, null), 401], [request({}), 400], [request({}, 'token', 'GET'), 405]] as const) {
    const test = fixture();
    assert((await test.handle(input)).status === expected);
    assert(!test.calls.includes('begin_account_deletion'));
  }
  const test = fixture('auth-check');
  assert((await test.handle(request())).status === 401);
  assert(!test.calls.includes('begin_account_deletion'));
});

Deno.test('deletion uses verified identity, removes files then records then Auth', async () => {
  const test = fixture();
  const result = await test.handle(request({ confirmation: 'DELETE', user_id: 'another-account' }));
  assert(result.status === 200 && (await result.json()).deleted === true);
  assert(test.calls.join('|') === 'verify:verified-token|begin_account_deletion|account_deletion_files|remove-files|account_deletion_files|delete_account_records|delete-auth');
  assert(result.headers.get('Cache-Control') === 'no-store');
});

for (const failure of ['begin_account_deletion', 'account_deletion_files', 'storage', 'delete_account_records', 'auth-delete']) {
  Deno.test(`failure at ${failure} does not claim deletion success`, async () => {
    const test = fixture(failure);
    const result = await test.handle(request());
    assert(result.status === 503);
    assert((await result.json()).deleted !== true);
    if (failure !== 'auth-delete') assert(!test.calls.includes('delete-auth'));
  });
}

Deno.test('storage cleanup is bounded and can be retried rather than orphaning files', async () => {
  const test = fixture('storage-stuck');
  assert((await test.handle(request())).status === 503);
  assert(test.calls.filter(name => name === 'remove-files').length === 40);
  assert(!test.calls.includes('delete_account_records') && !test.calls.includes('delete-auth'));
});

Deno.test('CORS preflight does not authenticate or modify records', async () => {
  const test = fixture();
  const result = await test.handle(request({}, null, 'OPTIONS'));
  assert(result.status === 204 && test.calls.length === 0);
  assert(result.headers.get('Access-Control-Allow-Methods') === 'POST, OPTIONS');
});
