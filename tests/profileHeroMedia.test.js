import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_HERO_MOBILE_BREAKPOINT,
  selectProfileHeroMedia,
} from '../src/utils/profileHeroMedia.js';

const profile = {
  coverImage: 'desktop-image',
  coverMobileImage: 'mobile-image',
  coverDesktopVideo: 'desktop-video',
  coverMobileVideo: 'mobile-video',
  profileImage: 'profile-image',
};

test('profile hero breakpoint starts desktop layout at 768 pixels', () => {
  assert.equal(PROFILE_HERO_MOBILE_BREAKPOINT, 768);
});

test('desktop prioritizes its video and uses the desktop image as poster', () => {
  assert.deepEqual(selectProfileHeroMedia({ profile }), {
    fallbacks: ['profile-image'],
    kind: 'video',
    poster: 'desktop-image',
    src: 'desktop-video',
  });
});

test('mobile prioritizes its video and mobile image', () => {
  assert.deepEqual(selectProfileHeroMedia({ profile, isMobile: true }), {
    fallbacks: ['desktop-image', 'profile-image'],
    kind: 'video',
    poster: 'mobile-image',
    src: 'mobile-video',
  });
});

test('mobile image falls back through desktop cover and profile photo', () => {
  assert.deepEqual(selectProfileHeroMedia({
    profile: { coverImage: 'desktop-image', profileImage: 'profile-image' },
    isMobile: true,
  }), {
    fallbacks: ['profile-image'],
    kind: 'image',
    poster: '',
    src: 'desktop-image',
  });

  assert.deepEqual(selectProfileHeroMedia({
    profile: { profileImage: 'profile-image' },
    isMobile: true,
  }), {
    fallbacks: [],
    kind: 'image',
    poster: '',
    src: 'profile-image',
  });
});

test('video error, reduced motion and data saving select the matching image', () => {
  const failed = selectProfileHeroMedia({ profile, videoFailed: true });
  const motionReduced = selectProfileHeroMedia({ profile, allowVideo: false });

  assert.deepEqual(failed, {
    fallbacks: ['profile-image'],
    kind: 'image',
    poster: '',
    src: 'desktop-image',
  });
  assert.deepEqual(motionReduced, failed);
});

test('snake case records and duplicate image paths are supported safely', () => {
  assert.deepEqual(selectProfileHeroMedia({
    profile: {
      cover_image: 'same-image',
      cover_mobile_image: 'same-image',
      cover_mobile_video: 'mobile-video',
      profile_image: 'profile-image',
    },
    isMobile: true,
  }), {
    fallbacks: ['profile-image'],
    kind: 'video',
    poster: 'same-image',
    src: 'mobile-video',
  });
});
