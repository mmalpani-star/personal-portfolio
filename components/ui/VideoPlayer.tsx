'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type VideoPlayerProps = {
  src: string;
  label: string;
  poster?: string;
  /**
   * `player`: full playback with native controls. Nothing beyond the poster
   * loads until the viewer presses play.
   * `preview`: muted, looping, no controls. Plays only while on screen and
   * never autoplays when the viewer prefers reduced motion.
   */
  mode?: 'player' | 'preview';
  className?: string;
  style?: CSSProperties;
};

export function VideoPlayer({ src, label, poster, mode = 'player', className = '', style }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (mode !== 'preview' || !video || reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay can be blocked (e.g. low-power mode); the poster remains.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [mode, reduceMotion]);

  if (mode === 'preview') {
    return (
      <video
        ref={ref}
        className={className || undefined}
        style={style}
        src={src}
        poster={poster}
        aria-label={label}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
      />
    );
  }

  return (
    <video
      ref={ref}
      className={`video-player ${className}`.trim()}
      style={style}
      src={src}
      poster={poster}
      aria-label={label}
      controls
      playsInline
      preload={poster ? 'none' : 'metadata'}
    />
  );
}
