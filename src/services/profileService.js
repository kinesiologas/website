import models from '../data/models.json';
import { resolveAssetUrl } from '../utils/assetUrl.js';

function mapProfile(profile) {
  return {
    ...profile,
    coverImage: resolveAssetUrl(profile.coverImage),
    profileImage: resolveAssetUrl(profile.profileImage),
  };
}

export function getProfiles() {
  return models.map(mapProfile);
}

export function getFeaturedProfiles(limit = 3) {
  return getProfiles()
    .filter((profile) => profile.featured)
    .slice(0, limit);
}

export function getProfileBySlug(slug) {
  const profile = models.find((item) => item.slug === slug);

  return profile ? mapProfile(profile) : null;
}
