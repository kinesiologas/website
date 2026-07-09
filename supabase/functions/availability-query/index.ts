import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const pendingStatuses = ['pending', 'confirmed'];
const defaultRule = {
  buffer_minutes: 0,
  days_of_week: [1, 2, 3, 4, 5, 6],
  enabled: true,
  end_time: '20:00:00',
  min_notice_minutes: 120,
  slot_duration_minutes: 60,
  start_time: '10:00:00',
  timezone: 'America/Lima',
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

function addDays(dateOnly: string, amount: number) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function addMinutes(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 60 * 1000);
}

function dateList(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function labelInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function parseOffsetMinutes(value: string) {
  if (value === 'GMT' || value === 'UTC') {
    return 0;
  }

  const match = value.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const zoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  return parseOffsetMinutes(zoneName);
}

function zonedDateTimeToUtc(dateOnly: string, timeValue: string, timeZone: string) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}

function localWeekday(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function toBusyRanges(rows: Array<{ start_at?: string; end_at?: string; start?: string; end?: string }>) {
  return rows
    .map((row) => ({
      end: new Date(String(row.end_at ?? row.end)),
      start: new Date(String(row.start_at ?? row.start)),
    }))
    .filter((range) => Number.isFinite(range.start.getTime()) && Number.isFinite(range.end.getTime()));
}

async function getUserFromRequest(request: Request, supabaseUrl: string, supabaseAnonKey: string) {
  const authorization = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getPublishedModel(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  requirePublished = true,
) {
  let query = adminClient.from('models').select('id, slug, name, status');

  if (requirePublished) {
    query = query.eq('status', 'published');
  }

  if (body.modelId) {
    query = query.eq('id', String(body.modelId));
  } else if (body.modelSlug) {
    query = query.eq('slug', String(body.modelSlug));
  } else {
    return { error: 'Model is required.' };
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: 'Model not found.' };
  }

  return { model: data };
}

async function getRule(adminClient: ReturnType<typeof createClient>, modelId: string) {
  const { data, error } = await adminClient
    .from('model_availability_rules')
    .select('model_id, timezone, days_of_week, start_time, end_time, slot_duration_minutes, buffer_minutes, min_notice_minutes, enabled')
    .eq('model_id', modelId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return { ...defaultRule, ...(data ?? {}), model_id: modelId };
}

async function getConnection(adminClient: ReturnType<typeof createClient>, modelId: string) {
  const { data, error } = await adminClient
    .from('calendar_connections')
    .select('model_id, calendar_id, calendar_email, access_token, refresh_token, expires_at, scope')
    .eq('model_id', modelId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function userCanDiagnoseModel(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  modelId: string,
) {
  const { data, error } = await adminClient
    .from('app_profiles')
    .select('role, active, model_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.active) {
    return false;
  }

  if (data.role === 'super_admin' || data.role === 'admin') {
    return true;
  }

  return data.role === 'model' && data.model_id === modelId;
}

function getCalendarQueryIds(connection: Record<string, unknown>) {
  return Array.from(
    new Set(
      [
        String(connection.calendar_id ?? 'primary').trim(),
        String(connection.calendar_email ?? '').trim(),
        'primary',
      ].filter(Boolean),
    ),
  );
}

async function getCalendarListIds(accessToken: string) {
  const entries = await getCalendarListEntries(accessToken);

  return entries.map((calendar) => calendar.id);
}

async function getCalendarListEntries(accessToken: string) {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('minAccessRole', 'freeBusyReader');
  url.searchParams.set('showHidden', 'true');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch((error) => {
    console.warn('Google CalendarList request failed. Falling back to known calendar ids.', error);
    return null;
  });

  if (!response) {
    return [];
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.warn('Google CalendarList returned an error. Falling back to known calendar ids.', data);
    return [];
  }

  const calendarsById = new Map<string, { id: string; primary: boolean; timeZone: string }>();

  for (const calendar of data.items ?? []) {
    const id = String(calendar.id ?? '').trim();

    if (!id) {
      continue;
    }

    calendarsById.set(id, {
      id,
      primary: Boolean(calendar.primary),
      timeZone: String(calendar.timeZone ?? '').trim(),
    });
  }

  return Array.from(calendarsById.values()).slice(0, 50);
}

async function refreshGoogleAccessToken(adminClient: ReturnType<typeof createClient>, connection: Record<string, unknown>) {
  const expiresAt = connection.expires_at ? new Date(String(connection.expires_at)).getTime() : 0;

  if (expiresAt > Date.now() + 120 * 1000 && connection.access_token) {
    return String(connection.access_token);
  }

  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!googleClientId || !googleClientSecret || !connection.refresh_token) {
    return null;
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      grant_type: 'refresh_token',
      refresh_token: String(connection.refresh_token),
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenData.access_token) {
    return null;
  }

  const expiresIn = Number(tokenData.expires_in ?? 3600);
  const nextExpiresAt = new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000).toISOString();
  await adminClient
    .from('calendar_connections')
    .update({
      access_token: tokenData.access_token,
      expires_at: nextExpiresAt,
      scope: tokenData.scope ?? '',
      updated_at: new Date().toISOString(),
    })
    .eq('model_id', String(connection.model_id));

  return String(tokenData.access_token);
}

async function getGoogleBusyRanges(
  adminClient: ReturnType<typeof createClient>,
  connection: Record<string, unknown> | null,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
) {
  if (!connection) {
    return { busy: [], unavailable: false };
  }

  const accessToken = await refreshGoogleAccessToken(adminClient, connection);

  if (!accessToken) {
    console.warn('Google Calendar access token is unavailable. Continuing with internal availability.');
    return { busy: [], unavailable: false };
  }

  const listedCalendarIds = await getCalendarListIds(accessToken);
  const calendarIds = listedCalendarIds.length ? listedCalendarIds : getCalendarQueryIds(connection);
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    body: JSON.stringify({
      calendarExpansionMax: 50,
      items: calendarIds.map((id) => ({ id })),
      timeMax: rangeEnd.toISOString(),
      timeMin: rangeStart.toISOString(),
      timeZone,
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }).catch((error) => {
    console.warn('Google Calendar FreeBusy request failed. Continuing with internal availability.', error);
    return null;
  });

  if (!response) {
    return { busy: [], unavailable: false };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.warn('Google Calendar FreeBusy returned an error. Continuing with internal availability.', data);
    return { busy: [], unavailable: false };
  }

  const calendars = data.calendars ?? {};
  const ranges = [];
  let calendarsWithErrors = 0;

  for (const calendarId of calendarIds) {
    const calendar = calendars[calendarId];

    if (!calendar) {
      continue;
    }

    if (calendar.errors?.length) {
      calendarsWithErrors += 1;
      console.warn('Google Calendar FreeBusy returned calendar errors. Continuing with other calendars.', {
        calendarId,
        errors: calendar.errors,
      });
      continue;
    }

    ranges.push(...toBusyRanges(calendar.busy ?? []));
  }

  console.log('Google Calendar FreeBusy result', {
    busyCount: ranges.length,
    calendarListUsed: listedCalendarIds.length > 0,
    calendarsQueried: calendarIds.length,
    calendarsWithErrors,
  });

  return { busy: ranges, unavailable: false };
}

async function diagnoseGoogleBusy(
  adminClient: ReturnType<typeof createClient>,
  modelId: string,
  dateOnly: string,
) {
  const rule = await getRule(adminClient, modelId);
  const timeZone = String(rule.timezone ?? defaultRule.timezone);
  const rangeStart = zonedDateTimeToUtc(dateOnly, '00:00:00', timeZone);
  const rangeEnd = zonedDateTimeToUtc(addDays(dateOnly, 1), '00:00:00', timeZone);
  const connection = await getConnection(adminClient, modelId);
  const internalBusy = await getInternalBusyRanges(adminClient, modelId, rangeStart, rangeEnd);

  if (!connection) {
    const slots = buildSlotsForDate(rule, dateOnly, internalBusy, false);

    return {
      connected: false,
      date: dateOnly,
      googleBusy: [],
      googleBusyCount: 0,
      googleCalendarErrors: [],
      googleCalendarsQueried: 0,
      internalBusyCount: internalBusy.length,
      remainingSlots: slots,
      remainingSlotsCount: slots.length,
      rule: {
        daysOfWeek: rule.days_of_week,
        endTime: rule.end_time,
        slotDurationMinutes: rule.slot_duration_minutes,
        startTime: rule.start_time,
        timezone: rule.timezone,
      },
    };
  }

  const accessToken = await refreshGoogleAccessToken(adminClient, connection);

  if (!accessToken) {
    const slots = buildSlotsForDate(rule, dateOnly, internalBusy, false);

    return {
      connected: true,
      date: dateOnly,
      error: 'No se pudo refrescar el token de Google.',
      googleBusy: [],
      googleBusyCount: 0,
      googleCalendarErrors: [],
      googleCalendarsQueried: 0,
      internalBusyCount: internalBusy.length,
      remainingSlots: slots,
      remainingSlotsCount: slots.length,
      storedScope: String(connection.scope ?? ''),
    };
  }

  const listedCalendars = await getCalendarListEntries(accessToken);
  const listedCalendarIds = listedCalendars.map((calendar) => calendar.id);
  const calendarIds = listedCalendarIds.length ? listedCalendarIds : getCalendarQueryIds(connection);
  const primaryGoogleCalendar = listedCalendars.find((calendar) => calendar.primary) ?? listedCalendars[0] ?? null;
  let response: Response | null = null;
  let requestError = '';

  try {
    response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      body: JSON.stringify({
        calendarExpansionMax: 50,
        items: calendarIds.map((id) => ({ id })),
        timeMax: rangeEnd.toISOString(),
        timeMin: rangeStart.toISOString(),
        timeZone,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  } catch (error) {
    requestError = error instanceof Error ? error.message : 'No se pudo consultar Google FreeBusy.';
  }

  if (!response) {
    const slots = buildSlotsForDate(rule, dateOnly, internalBusy, false);

    return {
      connected: true,
      date: dateOnly,
      error: requestError || 'No se pudo consultar Google FreeBusy.',
      freeBusyHttpOk: false,
      freeBusyStatus: 0,
      googleBusy: [],
      googleBusyCount: 0,
      googleCalendarErrors: [],
      googleCalendarsListed: listedCalendarIds.length,
      googleCalendarsQueried: calendarIds.length,
      googleCalendarTimeZones: Array.from(new Set(listedCalendars.map((calendar) => calendar.timeZone).filter(Boolean))),
      internalBusyCount: internalBusy.length,
      primaryGoogleCalendarTimeZone: primaryGoogleCalendar?.timeZone ?? '',
      remainingSlots: slots,
      remainingSlotsCount: slots.length,
      storedCalendarEmail: connection.calendar_email ? 'set' : 'empty',
      storedScope: String(connection.scope ?? ''),
      timeZoneMismatch: Boolean(primaryGoogleCalendar?.timeZone && primaryGoogleCalendar.timeZone !== timeZone),
    };
  }

  const data = await response.json().catch(() => ({}));
  const calendars = data.calendars ?? {};
  const googleError = response.ok ? '' : String(data.error?.message ?? data.error_description ?? data.error ?? 'Google FreeBusy error.');
  const googleBusy = [];
  const googleCalendarErrors = [];

  if (response.ok) {
    for (const calendarId of calendarIds) {
      const calendar = calendars[calendarId];

      if (!calendar) {
        continue;
      }

      if (calendar.errors?.length) {
        googleCalendarErrors.push({
          calendar: calendarId === 'primary' ? 'primary' : 'calendar',
          errors: calendar.errors,
        });
        continue;
      }

      googleBusy.push(...toBusyRanges(calendar.busy ?? []));
    }
  }

  const busy = [...internalBusy, ...googleBusy];
  const slots = buildSlotsForDate(rule, dateOnly, busy, false);

  return {
    connected: true,
    date: dateOnly,
    error: googleError,
    freeBusyHttpOk: response.ok,
    freeBusyStatus: response.status,
    googleBusy: googleBusy.map((range) => ({
      end: range.end.toISOString(),
      start: range.start.toISOString(),
    })),
    googleBusyCount: googleBusy.length,
    googleCalendarErrors,
    googleCalendarsListed: listedCalendarIds.length,
    googleCalendarsQueried: calendarIds.length,
    googleCalendarTimeZones: Array.from(new Set(listedCalendars.map((calendar) => calendar.timeZone).filter(Boolean))),
    internalBusyCount: internalBusy.length,
    primaryGoogleCalendarTimeZone: primaryGoogleCalendar?.timeZone ?? '',
    remainingSlots: slots,
    remainingSlotsCount: slots.length,
    rule: {
      daysOfWeek: rule.days_of_week,
      endTime: rule.end_time,
      slotDurationMinutes: rule.slot_duration_minutes,
      startTime: rule.start_time,
      timezone: timeZone,
    },
    storedCalendarEmail: connection.calendar_email ? 'set' : 'empty',
    storedScope: String(connection.scope ?? ''),
    timeZoneMismatch: Boolean(primaryGoogleCalendar?.timeZone && primaryGoogleCalendar.timeZone !== timeZone),
  };
}

async function getInternalBusyRanges(
  adminClient: ReturnType<typeof createClient>,
  modelId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const [blocksResult, bookingsResult] = await Promise.all([
    adminClient
      .from('model_availability_blocks')
      .select('start_at, end_at')
      .eq('model_id', modelId)
      .lt('start_at', rangeEnd.toISOString())
      .gt('end_at', rangeStart.toISOString()),
    adminClient
      .from('bookings')
      .select('start_at, end_at')
      .eq('model_id', modelId)
      .in('status', pendingStatuses)
      .lt('start_at', rangeEnd.toISOString())
      .gt('end_at', rangeStart.toISOString()),
  ]);

  const firstError = blocksResult.error ?? bookingsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return [...toBusyRanges(blocksResult.data ?? []), ...toBusyRanges(bookingsResult.data ?? [])];
}

function buildSlotsForDate(
  rule: Record<string, unknown>,
  dateOnly: string,
  busyRanges: Array<{ start: Date; end: Date }>,
  calendarUnavailable: boolean,
) {
  const timeZone = String(rule.timezone ?? defaultRule.timezone);
  const daysOfWeek = Array.isArray(rule.days_of_week) ? rule.days_of_week.map(Number) : defaultRule.days_of_week;

  if (!rule.enabled || calendarUnavailable || !daysOfWeek.includes(localWeekday(dateOnly))) {
    return [];
  }

  const duration = Number(rule.slot_duration_minutes ?? defaultRule.slot_duration_minutes);
  const buffer = Number(rule.buffer_minutes ?? defaultRule.buffer_minutes);
  const minNotice = Number(rule.min_notice_minutes ?? defaultRule.min_notice_minutes);
  const dayStart = zonedDateTimeToUtc(dateOnly, String(rule.start_time ?? defaultRule.start_time), timeZone);
  const dayEnd = zonedDateTimeToUtc(dateOnly, String(rule.end_time ?? defaultRule.end_time), timeZone);
  const earliestStart = addMinutes(new Date(), minNotice);
  const slots = [];

  for (let start = dayStart; addMinutes(start, duration) <= dayEnd; start = addMinutes(start, duration + buffer)) {
    const end = addMinutes(start, duration);

    if (start < earliestStart) {
      continue;
    }

    const isBusy = busyRanges.some((range) => overlaps(start, end, range.start, range.end));

    if (!isBusy) {
      slots.push({
        endAt: end.toISOString(),
        label: labelInTimeZone(start, timeZone),
        startAt: start.toISOString(),
      });
    }
  }

  return slots;
}

async function getBusyContext(
  adminClient: ReturnType<typeof createClient>,
  modelId: string,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
) {
  const [internalBusy, connection] = await Promise.all([
    getInternalBusyRanges(adminClient, modelId, rangeStart, rangeEnd),
    getConnection(adminClient, modelId),
  ]);
  const googleBusy = await getGoogleBusyRanges(adminClient, connection, rangeStart, rangeEnd, timeZone);

  return {
    busy: [...internalBusy, ...googleBusy.busy],
    calendarUnavailable: googleBusy.unavailable,
  };
}

async function handleDays(adminClient: ReturnType<typeof createClient>, model: Record<string, unknown>, body: Record<string, unknown>) {
  const today = dateInTimeZone(new Date(), defaultRule.timezone);
  const startDate = String(body.startDate ?? today);
  const days = Math.min(Math.max(Number(body.days ?? 31), 1), 62);
  const dates = dateList(startDate, days);
  const now = new Date().toISOString();
  const connection = await getConnection(adminClient, String(model.id));
  const cacheQuery = connection
    ? Promise.resolve({ data: [], error: null })
    : adminClient
      .from('availability_cache')
      .select('date, is_available, expires_at')
      .eq('model_id', String(model.id))
      .in('date', dates)
      .gt('expires_at', now);
  const { data: cached, error: cacheError } = await cacheQuery;

  if (cacheError) {
    throw new Error(cacheError.message);
  }

  const cachedByDate = new Map((cached ?? []).map((item: { date: string; is_available: boolean }) => [item.date, item.is_available]));
  const missingDates = dates.filter((date) => !cachedByDate.has(date));
  const computed = new Map<string, boolean>();

  if (missingDates.length) {
    const rule = await getRule(adminClient, String(model.id));
    const timeZone = String(rule.timezone ?? defaultRule.timezone);
    const rangeStart = zonedDateTimeToUtc(missingDates[0], '00:00:00', timeZone);
    const rangeEnd = zonedDateTimeToUtc(addDays(missingDates[missingDates.length - 1], 1), '00:00:00', timeZone);
    const busyContext = await getBusyContext(adminClient, String(model.id), rangeStart, rangeEnd, timeZone);

    for (const date of missingDates) {
      const slots = buildSlotsForDate(rule, date, busyContext.busy, busyContext.calendarUnavailable);
      computed.set(date, slots.length > 0);
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const rows = Array.from(computed.entries()).map(([date, isAvailable]) => ({
      checked_at: new Date().toISOString(),
      date,
      expires_at: expiresAt,
      is_available: isAvailable,
      model_id: String(model.id),
    }));

    if (rows.length) {
      await adminClient.from('availability_cache').upsert(rows, { onConflict: 'model_id,date' });
    }
  }

  return {
    days: dates.map((date) => ({
      date,
      isAvailable: cachedByDate.get(date) ?? computed.get(date) ?? false,
    })),
  };
}

async function computeSlots(adminClient: ReturnType<typeof createClient>, modelId: string, dateOnly: string) {
  const rule = await getRule(adminClient, modelId);
  const timeZone = String(rule.timezone ?? defaultRule.timezone);
  const rangeStart = zonedDateTimeToUtc(dateOnly, '00:00:00', timeZone);
  const rangeEnd = zonedDateTimeToUtc(addDays(dateOnly, 1), '00:00:00', timeZone);
  const busyContext = await getBusyContext(adminClient, modelId, rangeStart, rangeEnd, timeZone);

  return {
    calendarUnavailable: busyContext.calendarUnavailable,
    slots: buildSlotsForDate(rule, dateOnly, busyContext.busy, busyContext.calendarUnavailable),
  };
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? 'days');
  const modelResult = await getPublishedModel(adminClient, body, action !== 'diagnose');

  if (modelResult.error || !modelResult.model) {
    return jsonResponse({ error: modelResult.error ?? 'Model not found.' }, 404);
  }

  try {
    if (action === 'days') {
      return jsonResponse(await handleDays(adminClient, modelResult.model, body));
    }

    const user = await getUserFromRequest(request, supabaseUrl, supabaseAnonKey);

    if (!user) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    if (action === 'diagnose') {
      const date = String(body.date ?? '');

      if (!date) {
        return jsonResponse({ error: 'Date is required.' }, 400);
      }

      const canDiagnose = await userCanDiagnoseModel(adminClient, user.id, String(modelResult.model.id));

      if (!canDiagnose) {
        return jsonResponse({ error: 'Forbidden.' }, 403);
      }

      return jsonResponse(await diagnoseGoogleBusy(adminClient, String(modelResult.model.id), date));
    }

    if (action === 'slots') {
      const date = String(body.date ?? '');

      if (!date) {
        return jsonResponse({ error: 'Date is required.' }, 400);
      }

      return jsonResponse(await computeSlots(adminClient, String(modelResult.model.id), date));
    }

    if (action === 'book') {
      const startAt = new Date(String(body.startAt ?? ''));

      if (!Number.isFinite(startAt.getTime())) {
        return jsonResponse({ error: 'Valid startAt is required.' }, 400);
      }

      const rule = await getRule(adminClient, String(modelResult.model.id));
      const date = dateInTimeZone(startAt, String(rule.timezone ?? defaultRule.timezone));
      const { slots } = await computeSlots(adminClient, String(modelResult.model.id), date);
      const selectedSlot = slots.find((slot: { startAt: string }) => new Date(slot.startAt).getTime() === startAt.getTime());

      if (!selectedSlot) {
        return jsonResponse({ error: 'Selected slot is no longer available.' }, 409);
      }

      const { data: booking, error: bookingError } = await adminClient
        .from('bookings')
        .insert({
          contact_name: String(body.contactName ?? '').trim(),
          contact_phone: String(body.contactPhone ?? '').trim(),
          end_at: selectedSlot.endAt,
          id: `booking-${crypto.randomUUID()}`,
          model_id: String(modelResult.model.id),
          notes: String(body.notes ?? '').trim(),
          start_at: selectedSlot.startAt,
          status: 'pending',
          user_id: user.id,
        })
        .select('id, model_id, user_id, start_at, end_at, status, notes, contact_name, contact_phone, created_at')
        .maybeSingle();

      if (bookingError) {
        return jsonResponse({ error: bookingError.message }, 500);
      }

      await adminClient
        .from('availability_cache')
        .delete()
        .eq('model_id', String(modelResult.model.id))
        .eq('date', date);

      return jsonResponse({ booking });
    }

    return jsonResponse({ error: 'Invalid action.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Availability failed.' }, 500);
  }
});
