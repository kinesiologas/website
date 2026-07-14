import { useEffect, useMemo, useState } from 'react';
import {
  PROFILE_HERO_MOBILE_BREAKPOINT,
  selectProfileHeroMedia,
} from '../../utils/profileHeroMedia.js';

function subscribeToMediaQuery(query, onChange) {
  if (query.addEventListener) {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }

  query.addListener?.(onChange);
  return () => query.removeListener?.(onChange);
}

function useMediaQuery(queryText) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(queryText).matches : false
  ));

  useEffect(() => {
    const query = window.matchMedia(queryText);
    const handleChange = () => setMatches(query.matches);

    handleChange();
    return subscribeToMediaQuery(query, handleChange);
  }, [queryText]);

  return matches;
}

function prefersDataSavings() {
  return typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData);
}

export function ProfileHeroMedia({ profile }) {
  const isMobile = useMediaQuery(`(max-width: ${PROFILE_HERO_MOBILE_BREAKPOINT - 1}px)`);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [videoFailed, setVideoFailed] = useState(false);
  const allowVideo = !prefersReducedMotion && !prefersDataSavings();
  const media = useMemo(
    () => selectProfileHeroMedia({ profile, isMobile, allowVideo, videoFailed }),
    [allowVideo, isMobile, profile, videoFailed],
  );

  useEffect(() => {
    setVideoFailed(false);
  }, [
    isMobile,
    profile?.coverDesktopVideo,
    profile?.coverMobileVideo,
  ]);

  if (!media.src) {
    return null;
  }

  if (media.kind === 'video') {
    return (
      <video
        key={media.src}
        className="absolute inset-0 h-full w-full object-cover opacity-68"
        src={media.src}
        poster={media.poster || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onError={() => setVideoFailed(true)}
      />
    );
  }

  return (
    <img
      key={media.src}
      className="absolute inset-0 h-full w-full object-cover opacity-68"
      src={media.src}
      alt=""
      aria-hidden="true"
      fetchPriority="high"
      onError={(event) => {
        const nextIndex = Number(event.currentTarget.dataset.fallbackIndex ?? -1) + 1;
        const nextFallback = media.fallbacks[nextIndex];

        if (!nextFallback) {
          event.currentTarget.hidden = true;
          return;
        }

        event.currentTarget.dataset.fallbackIndex = String(nextIndex);
        event.currentTarget.src = nextFallback;
      }}
    />
  );
}
