import models from '../data/models.json';
import { supabase } from '../lib/supabaseClient.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';

const MODEL_COLUMNS = [
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
].join(', ');

const modelsTable = import.meta.env.VITE_SUPABASE_MODELS_TABLE || 'models';

function mapProfile(profile) {
  const coverImage = profile.coverImage ?? profile.cover_image;
  const profileImage = profile.profileImage ?? profile.profile_image;

  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    city: profile.city,
    age: profile.age,
    category: profile.category,
    featured: Boolean(profile.featured),
    shortDescription: profile.shortDescription ?? profile.short_description ?? '',
    description: profile.description ?? '',
    coverImage: resolveAssetUrl(coverImage),
    profileImage: resolveAssetUrl(profileImage),
    whatsappNumber: profile.whatsappNumber ?? profile.whatsapp_number ?? '',
    instagramUrl: profile.instagramUrl ?? profile.instagram_url ?? '',
  };
}

function getLocalProfiles() {
  return models.map(mapProfile);
}

export async function getProfiles() {
  if (!supabase) {
    return getLocalProfiles();
  }

  try {
    const { data, error } = await supabase
      .from(modelsTable)
      .select(MODEL_COLUMNS)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return data?.length ? data.map(mapProfile) : getLocalProfiles();
  } catch (error) {
    console.warn('Supabase profiles unavailable. Using local data.', error);
    return getLocalProfiles();
  }
}

export async function getFeaturedProfiles(limit = 3) {
  const profiles = await getProfiles();

  return profiles
    .filter((profile) => profile.featured)
    .slice(0, limit);
}

export async function getProfileBySlug(slug) {
  if (!slug) {
    return null;
  }

  const localProfile = getLocalProfiles().find((item) => item.slug === slug) ?? null;

  if (!supabase) {
    return localProfile;
  }

  try {
    const { data, error } = await supabase
      .from(modelsTable)
      .select(MODEL_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapProfile(data) : localProfile;
  } catch (error) {
    console.warn(`Supabase profile "${slug}" unavailable. Using local data.`, error);
    return localProfile;
  }
}
