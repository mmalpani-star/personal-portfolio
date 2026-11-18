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
  // Read after mount, not during render: the server always renders the animated source,
  // and React keeps the server's `src` when a hydrating client disagrees with it.
  const [reduceMotion, setReduceMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || failed) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

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

  // A GIF cannot be paused, so reduced-motion visitors get its still frame instead.
  const src = reduceMotion && media.poster ? media.poster : media.src;
  // Animated GIFs must be served untouched or the optimiser flattens them to one frame.
  const animatedGif = src.toLowerCase().endsWith('.gif');

  return (
    <span
      className={`${styles.photo} ${media.fit === 'contain' ? styles.photoContain : ''} ${media.ink ? styles.photoInk : ''} ${media.color ? styles.photoColor : ''}`.trim()}
    >
      {media.kind === 'video' ? (
        <video
          ref={videoRef}
          className={styles.video}
          style={{ objectFit: media.fit ?? 'cover', objectPosition: media.position ?? '50% 50%' }}
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
          src={src}
          alt=""
          unoptimized={animatedGif}
          fill
          sizes="(max-width: 900px) 100vw, 70vw"
          style={{ objectFit: media.fit ?? 'cover', objectPosition: media.position ?? '50% 50%' }}
          onError={() => setFailed(true)}
        />
      )}
      {media.halftone ? <span className={styles.halftone} /> : null}
      <span className={styles.scrim} />
    </span>
  );
}
