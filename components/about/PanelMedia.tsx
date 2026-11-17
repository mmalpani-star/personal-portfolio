'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { AboutMedia } from '@/data/site-data';
import styles from './MangaPanels.module.css';

/**
 * Full-bleed media behind a panel's copy.
 *
 * The source file may not be in the repo yet, so anything that fails to load
 * removes itself and the panel falls back to halftone and type. Video plays
 * only while the panel is on screen, and never under reduced motion.
 */
export function PanelMedia({ media }: { media: AboutMedia }) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || failed) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void node.play().catch(() => undefined);
        else node.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [failed]);

  if (failed) return null;

  return (
    <span className={styles.photo}>
      {media.kind === 'video' ? (
        <video
          ref={videoRef}
          className={styles.video}
          style={{ objectPosition: media.position ?? '50% 50%' }}
          src={media.src}
          poster={media.poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={media.alt}
          onError={() => setFailed(true)}
        />
      ) : (
        <Image
          src={media.src}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 70vw"
          style={{ objectFit: 'cover', objectPosition: media.position ?? '50% 50%' }}
          onError={() => setFailed(true)}
        />
      )}
      <span className={styles.scrim} />
    </span>
  );
}
