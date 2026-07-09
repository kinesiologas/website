import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('app_profiles')
    .select('role, active, model_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  if (!profile?.active || profile.role !== 'model' || !profile.model_id) {
    return jsonResponse({ error: 'Only model accounts can disconnect Google Calendar.' }, 403);
  }

  const { error: connectionError } = await adminClient
    .from('calendar_connections')
    .delete()
    .eq('model_id', profile.model_id)
    .eq('user_id', user.id);

  if (connectionError) {
    return jsonResponse({ error: connectionError.message }, 500);
  }

  const { error: statusError } = await adminClient
    .from('calendar_connection_status')
    .delete()
    .eq('model_id', profile.model_id)
    .eq('user_id', user.id);

  if (statusError) {
    return jsonResponse({ error: statusError.message }, 500);
  }

  await adminClient
    .from('availability_cache')
    .delete()
    .eq('model_id', profile.model_id);

  return jsonResponse({ disconnected: true });
});
