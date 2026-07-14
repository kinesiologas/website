export const PROFILE_HERO_MOBILE_BREAKPOINT = 768;

function compactUnique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function getProfileValue(profile, camelCaseKey, snakeCaseKey) {
  return profile?.[camelCaseKey] ?? profile?.[snakeCaseKey] ?? '';
}

export function selectProfileHeroMedia({
  profile = {},
  isMobile = false,
  allowVideo = true,
  videoFailed = false,
} = {}) {
  const coverImage = getProfileValue(profile, 'coverImage', 'cover_image');
  const profileImage = getProfileValue(profile, 'profileImage', 'profile_image');
  const imageCandidates = compactUnique(isMobile
    ? [
        getProfileValue(profile, 'coverMobileImage', 'cover_mobile_image'),
        coverImage,
        profileImage,
      ]
    : [coverImage, profileImage]);
  const selectedImage = imageCandidates[0] ?? '';
  const selectedVideo = isMobile
    ? getProfileValue(profile, 'coverMobileVideo', 'cover_mobile_video')
    : getProfileValue(profile, 'coverDesktopVideo', 'cover_desktop_video');

  if (allowVideo && !videoFailed && selectedVideo) {
    return {
      fallbacks: imageCandidates.slice(1),
      kind: 'video',
      poster: selectedImage,
      src: selectedVideo,
    };
  }

  return {
    fallbacks: imageCandidates.slice(1),
    kind: 'image',
    poster: '',
    src: selectedImage,
  };
}
