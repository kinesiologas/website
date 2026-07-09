import { supabase } from '../lib/supabaseClient.js';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
}

async function invokeAvailability(body) {
  ensureSupabase();

  const { data, error } = await supabase.functions.invoke('availability-query', {
    body,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function listAvailabilityDays({ days = 31, modelId, modelSlug, startDate }) {
  const data = await invokeAvailability({
    action: 'days',
    days,
    modelId,
    modelSlug,
    startDate,
  });

  return data?.days ?? [];
}

export async function listAvailabilitySlots({ date, modelId, modelSlug }) {
  const data = await invokeAvailability({
    action: 'slots',
    date,
    modelId,
    modelSlug,
  });

  return data ?? { calendarUnavailable: false, slots: [] };
}

export async function diagnoseAvailability({ date, modelId, modelSlug }) {
  return invokeAvailability({
    action: 'diagnose',
    date,
    modelId,
    modelSlug,
  });
}

export async function createBookingRequest({ contactName, contactPhone, modelId, modelSlug, notes, startAt }) {
  const data = await invokeAvailability({
    action: 'book',
    contactName,
    contactPhone,
    modelId,
    modelSlug,
    notes,
    startAt,
  });

  return data?.booking;
}
