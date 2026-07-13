import test from 'node:test';
import assert from 'node:assert/strict';
import { getBundledHeroImageUrl, selectHeroMedia } from '../src/utils/heroMedia.js';

const settings = {
  hero_desktop_image: 'desktop-image',
  hero_mobile_image: 'mobile-image',
  hero_desktop_video: 'desktop-video',
  hero_mobile_video: 'mobile-video',
};

const resolveMediaUrl = (value) => value ? `https://media.test/${value}` : '';
const fallbackImageUrl = '/images/portada.png';

test('desktop prioritizes its video and uses its image as poster', () => {
  assert.deepEqual(selectHeroMedia({ settings, resolveMediaUrl, fallbackImageUrl }), {
    fallbacks: [fallbackImageUrl],
    kind: 'video',
    poster: 'https://media.test/desktop-image',
    src: 'https://media.test/desktop-video',
  });
});

test('mobile prioritizes mobile-specific media', () => {
  assert.deepEqual(selectHeroMedia({ settings, isMobile: true, resolveMediaUrl, fallbackImageUrl }), {
    fallbacks: ['https://media.test/desktop-image', fallbackImageUrl],
    kind: 'video',
    poster: 'https://media.test/mobile-image',
    src: 'https://media.test/mobile-video',
  });
});

test('mobile image falls back through desktop image and bundled cover', () => {
  const desktopFallback = selectHeroMedia({
    settings: { hero_desktop_image: 'desktop-image' },
    isMobile: true,
    resolveMediaUrl,
    fallbackImageUrl,
  });
  const bundledFallback = selectHeroMedia({
    settings: {},
    isMobile: true,
    resolveMediaUrl,
    fallbackImageUrl,
  });

  assert.equal(desktopFallback.src, 'https://media.test/desktop-image');
  assert.equal(bundledFallback.src, fallbackImageUrl);
});

test('video errors and reduced motion use the matching image', () => {
  const failed = selectHeroMedia({ settings, videoFailed: true, resolveMediaUrl, fallbackImageUrl });
  const reducedMotion = selectHeroMedia({ settings, allowVideo: false, resolveMediaUrl, fallbackImageUrl });

  assert.deepEqual(failed, {
    fallbacks: [fallbackImageUrl],
    kind: 'image',
    poster: '',
    src: 'https://media.test/desktop-image',
  });
  assert.deepEqual(reducedMotion, failed);
});

test('bundled cover respects the configured Vite base path', () => {
  assert.equal(getBundledHeroImageUrl('/catalogo/'), '/catalogo/images/portada.png');
  assert.equal(getBundledHeroImageUrl('/catalogo'), '/catalogo/images/portada.png');
});
