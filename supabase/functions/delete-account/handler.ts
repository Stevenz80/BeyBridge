import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export function createDeleteAccountHandler(client: SupabaseClient) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return response({ error: 'Authentication required' }, 401);
    try {
      // Never accept a user ID from the request or trust a locally decoded JWT.
      const { data: { user }, error: authError } = await client.auth.getUser(token);
      if (authError || !user) return response({ error: 'Sign in again before deleting your account' }, 401);
      const body = await request.json().catch(() => null);
      if (body?.confirmation !== 'DELETE') return response({ error: 'Explicit deletion confirmation required' }, 400);
      const args = { p_user_id: user.id };
      const started = await client.rpc('begin_account_deletion', args);
      if (started.error) throw new Error('start');

      // Bounded batches include orphaned submissions as well as current ones.
      // No storage metadata is deleted directly: remove actual objects via API.
      let cleaned = false;
      for (let batch = 0; batch < 40; batch++) {
        const files = await client.rpc('account_deletion_files', args);
        if (files.error) throw new Error('files');
        const paths = (files.data ?? []).map((file: { path: string }) => file.path);
        if (!paths.length) { cleaned = true; break; }
        const removed = await client.storage.from('provider-verification').remove(paths);
        if (removed.error) throw new Error('storage');
      }
      if (!cleaned) throw new Error('cleanup limit');
      const records = await client.rpc('delete_account_records', args);
      if (records.error) throw new Error('records');
      const removed = await client.auth.admin.deleteUser(user.id, false);
      if (removed.error) throw new Error('auth');
      return response({ deleted: true });
    } catch {
      // No JWT, file path, account identifier or upstream error is logged/exposed.
      return response({ error: 'Deletion could not be completed. Please retry or contact support.' }, 503);
    }
  };
}
