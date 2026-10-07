import { createClient } from 'npm:@supabase/supabase-js@2.110.5';
import { createDeleteAccountHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) throw new Error('Server-side Supabase configuration is required');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createDeleteAccountHandler(client));
