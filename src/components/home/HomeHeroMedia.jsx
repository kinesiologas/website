import { useEffect, useMemo, useState } from 'react';
import {
  getBundledHeroImageUrl,
  HERO_MOBILE_BREAKPOINT,
  selectHeroMedia,
} from '../../utils/heroMedia.js';

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

export function HomeHeroMedia({ settings, resolveMediaUrl }) {
  const isMobile = useMediaQuery(`(max-width: ${HERO_MOBILE_BREAKPOINT - 1}px)`);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [videoFailed, setVideoFailed] = useState(false);
  const fallbackImageUrl = getBundledHeroImageUrl(import.meta.env.BASE_URL || '/');
  const allowVideo = !prefersReducedMotion && !prefersDataSavings();

  const media = useMemo(
    () => selectHeroMedia({
      settings,
      isMobile,
      allowVideo,
      videoFailed,
      resolveMediaUrl,
      fallbackImageUrl,
    }),
    [allowVideo, fallbackImageUrl, isMobile, resolveMediaUrl, settings, videoFailed],
  );

  useEffect(() => {
    setVideoFailed(false);
  }, [isMobile, settings?.hero_desktop_video, settings?.hero_mobile_video]);

  if (media.kind === 'video') {
    return (
      <video
        key={media.src}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        src={media.src}
        poster={media.poster}
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
      className="absolute inset-0 h-full w-full object-cover opacity-70"
      src={media.src}
      alt=""
      fetchPriority="high"
      onError={(event) => {
        const nextIndex = Number(event.currentTarget.dataset.fallbackIndex ?? -1) + 1;
        const nextFallback = media.fallbacks[nextIndex];

        if (!nextFallback) return;
        event.currentTarget.dataset.fallbackIndex = String(nextIndex);
        event.currentTarget.src = nextFallback;
      }}
    />
  );
}
