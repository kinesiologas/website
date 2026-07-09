import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function redirectToProfile(siteUrl: string, status: string, detail = '') {
  const url = new URL('/admin/mi-perfil', siteUrl.replace(/\/$/, ''));
  url.searchParams.set('calendar', status);

  if (detail) {
    url.searchParams.set('detail', detail);
  }

  return Response.redirect(url.toString(), 302);
}

function getCalendarRedirectUri(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-oauth-callback`;
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const siteUrl = Deno.env.get('SITE_URL');

  if (!siteUrl) {
    return new Response('SITE_URL is missing.', { status: 500 });
  }

  if (!supabaseUrl || !serviceRoleKey || !googleClientId || !googleClientSecret) {
    return redirectToProfile(siteUrl, 'error', 'missing_env');
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError = requestUrl.searchParams.get('error');

  if (oauthError) {
    return redirectToProfile(siteUrl, 'error', oauthError);
  }

  if (!code || !state) {
    return redirectToProfile(siteUrl, 'error', 'missing_code');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: stateRecord, error: stateError } = await adminClient
    .from('calendar_oauth_states')
    .select('state, user_id, model_id, expires_at')
    .eq('state', state)
    .maybeSingle();

  if (stateError || !stateRecord) {
    return redirectToProfile(siteUrl, 'error', 'invalid_state');
  }

  if (new Date(stateRecord.expires_at).getTime() < Date.now()) {
    await adminClient.from('calendar_oauth_states').delete().eq('state', state);
    return redirectToProfile(siteUrl, 'error', 'expired_state');
  }

  const redirectUri = getCalendarRedirectUri(supabaseUrl);
  const tokenBody = new URLSearchParams({
    client_id: googleClientId,
    client_secret: googleClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    body: tokenBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenData.access_token) {
    await adminClient.from('calendar_oauth_states').delete().eq('state', state);
    return redirectToProfile(siteUrl, 'error', 'token_exchange');
  }

  if (!tokenData.refresh_token) {
    await adminClient.from('calendar_oauth_states').delete().eq('state', state);
    return redirectToProfile(siteUrl, 'error', 'missing_refresh_token');
  }

  const { data: profile } = await adminClient
    .from('app_profiles')
    .select('email')
    .eq('id', stateRecord.user_id)
    .maybeSingle();

  const expiresIn = Number(tokenData.expires_in ?? 3600);
  const expiresAt = new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000).toISOString();
  const calendarEmail = profile?.email ?? '';

  const { error: connectionError } = await adminClient.from('calendar_connections').upsert(
    {
      access_token: tokenData.access_token,
      calendar_email: calendarEmail,
      calendar_id: 'primary',
      connected_at: new Date().toISOString(),
      expires_at: expiresAt,
      model_id: stateRecord.model_id,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope ?? '',
      updated_at: new Date().toISOString(),
      user_id: stateRecord.user_id,
    },
    { onConflict: 'model_id' },
  );

  if (connectionError) {
    await adminClient.from('calendar_oauth_states').delete().eq('state', state);
    return redirectToProfile(siteUrl, 'error', 'connection_save');
  }

  await adminClient.from('calendar_connection_status').upsert(
    {
      calendar_email: calendarEmail,
      connected_at: new Date().toISOString(),
      model_id: stateRecord.model_id,
      updated_at: new Date().toISOString(),
      user_id: stateRecord.user_id,
    },
    { onConflict: 'model_id' },
  );
  await adminClient
    .from('availability_cache')
    .delete()
    .eq('model_id', stateRecord.model_id);
  await adminClient.from('calendar_oauth_states').delete().eq('state', state);

  return redirectToProfile(siteUrl, 'connected');
});
