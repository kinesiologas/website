export const HERO_MOBILE_BREAKPOINT = 768;

export function getBundledHeroImageUrl(baseUrl = '/') {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return `${normalizedBase}images/portada.png`;
}

export function selectHeroMedia({
  settings = {},
  isMobile = false,
  allowVideo = true,
  videoFailed = false,
  resolveMediaUrl = (value) => value || '',
  fallbackImageUrl = getBundledHeroImageUrl(),
} = {}) {
  const customDesktopImage = resolveMediaUrl(settings.hero_desktop_image);
  const desktopImage = customDesktopImage || fallbackImageUrl;
  const customMobileImage = isMobile ? resolveMediaUrl(settings.hero_mobile_image) : '';
  const selectedImage = customMobileImage || desktopImage;
  const selectedVideo = isMobile
    ? resolveMediaUrl(settings.hero_mobile_video)
    : resolveMediaUrl(settings.hero_desktop_video);
  const imageFallbacks = [];

  if (customMobileImage && desktopImage !== selectedImage) {
    imageFallbacks.push(desktopImage);
  }

  if (selectedImage !== fallbackImageUrl && !imageFallbacks.includes(fallbackImageUrl)) {
    imageFallbacks.push(fallbackImageUrl);
  }

  if (allowVideo && !videoFailed && selectedVideo) {
    return {
      fallbacks: imageFallbacks,
      kind: 'video',
      poster: selectedImage,
      src: selectedVideo,
    };
  }

  return {
    fallbacks: imageFallbacks,
    kind: 'image',
    poster: '',
    src: selectedImage,
  };
}
