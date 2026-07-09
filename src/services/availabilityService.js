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
    throw new Error(await readFunctionError(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

async function readFunctionError(error) {
  const response = error?.context;

  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();
      const message = payload?.error || payload?.message || payload?.details;

      if (message) {
        return String(message);
      }
    } catch (_jsonError) {
      // Keep the original Supabase message if the response is not JSON.
    }

    try {
      const text = await response.clone().text();

      if (text) {
        return text;
      }
    } catch (_textError) {
      // Keep the original Supabase message if the body cannot be read twice.
    }
  }

  return error?.message ?? 'No se pudo consultar disponibilidad.';
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
