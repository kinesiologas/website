import galleries from '../data/galleries.json';
import { resolveAssetUrl } from '../utils/assetUrl.js';

function mapImage(image, modelSlug) {
  return {
    ...image,
    modelSlug,
    src: resolveAssetUrl(image.src),
  };
}

function mapGallery(gallery) {
  return {
    ...gallery,
    images: gallery.images.map((image) => mapImage(image, gallery.modelSlug)),
  };
}

export function getGalleryByModelSlug(modelSlug) {
  const gallery = galleries.find((item) => item.modelSlug === modelSlug);

  return gallery ? mapGallery(gallery) : { modelSlug, images: [] };
}

export function getGalleryPreviewImages(limit = 6) {
  return galleries
    .flatMap((gallery) => gallery.images.map((image) => mapImage(image, gallery.modelSlug)))
    .slice(0, limit);
}
