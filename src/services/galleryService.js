import galleries from '../data/galleries.json';
import { supabase } from '../lib/supabaseClient.js';
import { runSupabaseQuery } from '../lib/supabaseQuery.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';

const IMAGE_COLUMNS = ['id', 'model_slug', 'src', 'alt', 'sort_order'].join(', ');

const galleryImagesTable = import.meta.env.VITE_SUPABASE_GALLERY_IMAGES_TABLE || 'gallery_images';

function mapImage(image, modelSlug) {
  return {
    id: image.id,
    alt: image.alt ?? '',
    modelSlug: modelSlug ?? image.modelSlug ?? image.model_slug,
    src: resolveAssetUrl(image.src),
  };
}

function mapGallery(gallery) {
  return {
    ...gallery,
    images: gallery.images.map((image) => mapImage(image, gallery.modelSlug)),
  };
}

function getLocalGalleryByModelSlug(modelSlug) {
  const gallery = galleries.find((item) => item.modelSlug === modelSlug);

  return gallery ? mapGallery(gallery) : { modelSlug, images: [] };
}

function getLocalGalleryPreviewImages(limit = 6) {
  return galleries
    .flatMap((gallery) => gallery.images.map((image) => mapImage(image, gallery.modelSlug)))
    .slice(0, limit);
}

export async function getGalleryByModelSlug(modelSlug) {
  if (!supabase) {
    return getLocalGalleryByModelSlug(modelSlug);
  }

  try {
    const { data, error } = await runSupabaseQuery(
      supabase
        .from(galleryImagesTable)
        .select(IMAGE_COLUMNS)
        .eq('model_slug', modelSlug)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true }),
      `Supabase gallery "${modelSlug}"`,
    );

    if (error) {
      throw error;
    }

    return {
      modelSlug,
      images: (data ?? []).map((image) => mapImage(image, modelSlug)),
    };
  } catch (error) {
    console.warn(`Supabase gallery "${modelSlug}" unavailable. Returning an empty gallery.`, error);
    return { modelSlug, images: [] };
  }
}

export async function getGalleryPreviewImages(limit = 6) {
  if (!supabase) {
    return getLocalGalleryPreviewImages(limit);
  }

  try {
    const { data, error } = await runSupabaseQuery(
      supabase
        .from(galleryImagesTable)
        .select(IMAGE_COLUMNS)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(limit),
      'Supabase gallery preview',
    );

    if (error) {
      throw error;
    }

    return (data ?? []).map((image) => mapImage(image));
  } catch (error) {
    console.warn('Supabase gallery preview unavailable. Returning no images.', error);
    return [];
  }
}
