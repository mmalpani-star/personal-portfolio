'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Ocean } from '@/lib/three/ocean';
import styles from './OceanZone.module.css';

/**
 * Puts the sea behind its children: a layer the full height of the zone whose canvas sticks to the viewport,
 * so the opening and "Interested about" scroll over one continuous ocean. Runs only while on screen.
 */
export function OceanZone({ children, crew = [] }: { children: ReactNode; crew?: string[] }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const zone = zoneRef.current;
    const canvas = canvasRef.current;
    if (!zone || !canvas) return;
    let ocean: Ocean | null = null;
    let visible = false;
    let cancelled = false;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; ocean?.setActive(visible); });
    io.observe(zone);
    const theme = new MutationObserver(() => ocean?.setLight(document.documentElement.dataset.theme === 'light'));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    import('@/lib/three/ocean').then(({ createOcean }) => {
      if (cancelled) return;
      ocean = createOcean({
        canvas,
        light: document.documentElement.dataset.theme === 'light',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        // the ship model is ~7.9 MB: phones get the open sea only
        shipSrc: window.innerWidth >= 768 ? '/models/about/thousand-sunny.glb' : null,
        crew,
      });
      if (!ocean) return;
      setReady(true);
      ocean.setActive(visible);
    });
    return () => { cancelled = true; io.disconnect(); theme.disconnect(); ocean?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the crew list is fixed for the page's lifetime
  }, []);

  return (
    <div ref={zoneRef} className={styles.zone} data-ready={ready}>
      <div className={styles.layer} aria-hidden="true">
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <div className={styles.content}>{children}</div>
      <p className={styles.credit}>
        Thousand Sunny model by{' '}
        <a href="https://sketchfab.com/3d-models/hw-xyz-school-detailing-l-l-3-ef8de71cdacb48ce9bf401d63c5c678d" target="_blank" rel="noreferrer">AlinaDracheva</a>,{' '}
        <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
      </p>
    </div>
  );
}
