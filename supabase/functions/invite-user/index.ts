import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const allowedRoles = new Set(['super_admin', 'admin', 'model', 'user']);

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
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const { data: requesterProfile, error: requesterError } = await adminClient
    .from('app_profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (requesterError) {
    return jsonResponse({ error: requesterError.message }, 500);
  }

  if (!requesterProfile?.active || requesterProfile.role !== 'super_admin') {
    return jsonResponse({ error: 'Only super administrators can invite users.' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.fullName ?? '').trim();
  const role = String(body.role ?? 'user').trim();
  const modelId = body.modelId ? String(body.modelId) : null;
  const siteUrl = Deno.env.get('SITE_URL');
  const redirectTo = body.redirectTo ? String(body.redirectTo) : siteUrl ? `${siteUrl.replace(/\/$/, '')}/login` : undefined;

  if (!email) {
    return jsonResponse({ error: 'Email is required.' }, 400);
  }

  if (!allowedRoles.has(role)) {
    return jsonResponse({ error: 'Invalid role.' }, 400);
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role,
    },
    redirectTo,
  });

  if (inviteError || !inviteData.user) {
    return jsonResponse({ error: inviteError?.message ?? 'Invite failed.' }, 400);
  }

  const { error: profileError } = await adminClient.from('app_profiles').upsert(
    {
      active: true,
      email,
      full_name: fullName,
      id: inviteData.user.id,
      model_id: role === 'model' ? modelId : null,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  return jsonResponse({
    email,
    invited: true,
    role,
    userId: inviteData.user.id,
  });
});
