import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const calendarScope = 'https://www.googleapis.com/auth/calendar.freebusy';

function getCalendarRedirectUri(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-oauth-callback`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !googleClientId) {
    return jsonResponse({ error: 'Calendar environment variables are missing.' }, 500);
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
    return jsonResponse({ error: 'Only model accounts with a linked model can connect Google Calendar.' }, 403);
  }

  await adminClient.from('calendar_oauth_states').delete().lt('expires_at', new Date().toISOString());

  const state = randomState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: stateError } = await adminClient.from('calendar_oauth_states').insert({
    expires_at: expiresAt,
    model_id: profile.model_id,
    state,
    user_id: user.id,
  });

  if (stateError) {
    return jsonResponse({ error: stateError.message }, 500);
  }

  const redirectUri = getCalendarRedirectUri(supabaseUrl);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('client_id', googleClientId);
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', calendarScope);
  url.searchParams.set('state', state);

  return jsonResponse({ authUrl: url.toString() });
});
