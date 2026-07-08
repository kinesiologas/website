import { supabase } from '../lib/supabaseClient.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';

const MODEL_ADMIN_COLUMNS = [
  'id',
  'slug',
  'name',
  'city',
  'age',
  'category',
  'featured',
  'short_description',
  'description',
  'cover_image',
  'profile_image',
  'whatsapp_number',
  'instagram_url',
  'sort_order',
  'status',
  'country_id',
  'province_id',
  'city_id',
  'created_at',
  'updated_at',
].join(', ');

const PUBLIC_MODEL_COLUMNS = [
  'id',
  'slug',
  'name',
  'city',
  'age',
  'category',
  'featured',
  'short_description',
  'description',
  'cover_image',
  'profile_image',
  'whatsapp_number',
  'instagram_url',
  'sort_order',
  'status',
].join(', ');

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
}

export function slugify(value) {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeId(prefix) {
  const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toSortOrder(value) {
  return toNumberOrNull(value) ?? 0;
}

function mapPublicModel(profile) {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    city: profile.city,
    age: profile.age,
    category: profile.category,
    featured: Boolean(profile.featured),
    shortDescription: profile.short_description ?? '',
    description: profile.description ?? '',
    coverImage: resolveAssetUrl(profile.cover_image),
    profileImage: resolveAssetUrl(profile.profile_image),
    whatsappNumber: profile.whatsapp_number ?? '',
    instagramUrl: profile.instagram_url ?? '',
  };
}

function toModelPayload(model) {
  return {
    slug: slugify(model.slug || model.name),
    name: model.name?.trim() ?? '',
    city: model.city?.trim() ?? '',
    age: toNumberOrNull(model.age),
    category: model.category?.trim() ?? '',
    featured: Boolean(model.featured),
    short_description: model.short_description?.trim() ?? '',
    description: model.description?.trim() ?? '',
    cover_image: model.cover_image?.trim() ?? '',
    profile_image: model.profile_image?.trim() ?? '',
    whatsapp_number: model.whatsapp_number?.trim() ?? '',
    instagram_url: model.instagram_url?.trim() ?? '',
    sort_order: toSortOrder(model.sort_order),
    status: model.status || 'draft',
    country_id: model.country_id || null,
    province_id: model.province_id || null,
    city_id: model.city_id || null,
    updated_at: new Date().toISOString(),
  };
}

export async function listModels({ modelId } = {}) {
  ensureSupabase();

  let query = supabase
    .from('models')
    .select(MODEL_ADMIN_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (modelId) {
    query = query.eq('id', modelId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveModel(model) {
  ensureSupabase();

  const payload = toModelPayload(model);

  if (model.id) {
    const { data, error } = await supabase
      .from('models')
      .update(payload)
      .eq('id', model.id)
      .select(MODEL_ADMIN_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('models')
    .insert({
      ...payload,
      id: makeId('model'),
      created_at: new Date().toISOString(),
    })
    .select(MODEL_ADMIN_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function archiveModel(modelId) {
  ensureSupabase();

  const { error } = await supabase
    .from('models')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', modelId);

  if (error) {
    throw error;
  }
}

export async function listGalleryImages(modelSlug) {
  ensureSupabase();

  if (!modelSlug) {
    return [];
  }

  const { data, error } = await supabase
    .from('gallery_images')
    .select('id, model_slug, src, alt, sort_order, created_at')
    .eq('model_slug', modelSlug)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveGalleryImage(image) {
  ensureSupabase();

  const payload = {
    model_slug: image.model_slug,
    src: image.src?.trim() ?? '',
    alt: image.alt?.trim() ?? '',
    sort_order: toSortOrder(image.sort_order),
  };

  if (image.id) {
    const { data, error } = await supabase
      .from('gallery_images')
      .update(payload)
      .eq('id', image.id)
      .select('id, model_slug, src, alt, sort_order, created_at')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('gallery_images')
    .insert({
      ...payload,
      id: makeId('image'),
    })
    .select('id, model_slug, src, alt, sort_order, created_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteGalleryImage(imageId) {
  ensureSupabase();

  const { error } = await supabase.from('gallery_images').delete().eq('id', imageId);

  if (error) {
    throw error;
  }
}

export async function listCategoriesAdmin() {
  ensureSupabase();

  const { data, error } = await supabase
    .from('categories')
    .select('id, label, sort_order, active')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveCategory(category) {
  ensureSupabase();

  const payload = {
    id: slugify(category.id || category.label),
    label: category.label?.trim() ?? '',
    sort_order: toSortOrder(category.sort_order),
    active: category.active !== false,
  };

  const { data, error } = await supabase
    .from('categories')
    .upsert(payload, { onConflict: 'id' })
    .select('id, label, sort_order, active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCategory(categoryId) {
  ensureSupabase();

  const { error } = await supabase.from('categories').delete().eq('id', categoryId);

  if (error) {
    throw error;
  }
}

export async function listLocationCatalogs() {
  ensureSupabase();

  const [countriesResult, provincesResult, citiesResult] = await Promise.all([
    supabase
      .from('countries')
      .select('id, name, iso_code, active, sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    supabase
      .from('provinces')
      .select('id, country_id, name, active, sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    supabase
      .from('cities')
      .select('id, province_id, name, active, sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
  ]);

  const firstError = countriesResult.error ?? provincesResult.error ?? citiesResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    countries: countriesResult.data ?? [],
    provinces: provincesResult.data ?? [],
    cities: citiesResult.data ?? [],
  };
}

export async function saveCountry(country) {
  ensureSupabase();

  const payload = {
    id: slugify(country.id || country.name),
    name: country.name?.trim() ?? '',
    iso_code: country.iso_code?.trim().toUpperCase() || null,
    active: country.active !== false,
    sort_order: toSortOrder(country.sort_order),
  };

  const { data, error } = await supabase
    .from('countries')
    .upsert(payload, { onConflict: 'id' })
    .select('id, name, iso_code, active, sort_order')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveProvince(province) {
  ensureSupabase();

  const payload = {
    id: slugify(province.id || `${province.country_id}-${province.name}`),
    country_id: province.country_id,
    name: province.name?.trim() ?? '',
    active: province.active !== false,
    sort_order: toSortOrder(province.sort_order),
  };

  const { data, error } = await supabase
    .from('provinces')
    .upsert(payload, { onConflict: 'id' })
    .select('id, country_id, name, active, sort_order')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveCity(city) {
  ensureSupabase();

  const payload = {
    id: slugify(city.id || `${city.province_id}-${city.name}`),
    province_id: city.province_id,
    name: city.name?.trim() ?? '',
    active: city.active !== false,
    sort_order: toSortOrder(city.sort_order),
  };

  const { data, error } = await supabase
    .from('cities')
    .upsert(payload, { onConflict: 'id' })
    .select('id, province_id, name, active, sort_order')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteLocationRecord(table, recordId) {
  ensureSupabase();

  if (!['countries', 'provinces', 'cities'].includes(table)) {
    throw new Error('Tabla de ubicacion no valida.');
  }

  const { error } = await supabase.from(table).delete().eq('id', recordId);

  if (error) {
    throw error;
  }
}

export async function listAppProfiles() {
  ensureSupabase();

  const { data, error } = await supabase
    .from('app_profiles')
    .select('id, email, full_name, avatar_url, role, active, model_id, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAppProfileAdmin(profile) {
  ensureSupabase();

  const { data, error } = await supabase.rpc('admin_update_app_profile', {
    target_user_id: profile.id,
    next_active: profile.active,
    next_full_name: profile.full_name || null,
    next_model_id: profile.model_id || null,
    next_role: profile.role,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function inviteUser({ email, fullName, modelId, role }) {
  ensureSupabase();

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      email,
      fullName,
      modelId: modelId || null,
      role,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function listFavoriteIds(userId) {
  ensureSupabase();

  const { data, error } = await supabase.from('favorites').select('model_id').eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => item.model_id);
}

export async function listPublishedModelsForFavorites() {
  ensureSupabase();

  const { data, error } = await supabase
    .from('models')
    .select(PUBLIC_MODEL_COLUMNS)
    .eq('status', 'published')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapPublicModel);
}

export async function setFavorite(modelId, isFavorite) {
  ensureSupabase();

  if (isFavorite) {
    const { error } = await supabase.from('favorites').insert({ model_id: modelId });

    if (error && error.code !== '23505') {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from('favorites').delete().eq('model_id', modelId);

  if (error) {
    throw error;
  }
}
