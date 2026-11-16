'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import styles from './EnergyOrb.module.css';

// three + R3F live in this chunk; it is only requested on desktop (see below).
const OrbCanvas = dynamic(() => import('./OrbCanvas'), { ssr: false });

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Static orb: the server-rendered default, and the only version on phones and under reduced motion. */
function StaticOrb() {
  return (
    <svg viewBox="0 0 200 200" className={styles.static} aria-hidden="true">
      <defs>
        <radialGradient id="orb-glow">
          <stop offset="0" stopColor="#ffb547" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#ffb547" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#orb-glow)" />
      <g className={styles.rings}>
        <circle cx="100" cy="100" r="58" />
        <ellipse cx="100" cy="100" rx="58" ry="20" />
        <ellipse cx="100" cy="100" rx="58" ry="40" />
        <ellipse cx="100" cy="100" rx="20" ry="58" />
        <ellipse cx="100" cy="100" rx="40" ry="58" />
        <ellipse cx="100" cy="100" rx="58" ry="24" transform="rotate(45 100 100)" />
        <ellipse cx="100" cy="100" rx="58" ry="24" transform="rotate(-45 100 100)" />
      </g>
      <circle cx="100" cy="100" r="5" fill="#fff1d6" />
    </svg>
  );
}

/**
 * Hero → Arc 01 transition: a particle sphere that spins up and bursts once.
 * The WebGL version is fetched only on wide, hover-capable screens with motion
 * allowed, data saver off and WebGL available, and only once the band is on screen.
 */
export function EnergyOrb() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true });
  const active = useInView(ref, { once: true, amount: 0.75 });
  const [capable, setCapable] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setCapable(
      !reduceMotion &&
        !saveData &&
        window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches &&
        supportsWebGL(),
    );
  }, [reduceMotion]);

  const live = capable && near;

  return (
    <div ref={ref} className={styles.band} data-live={live && ready}>
      <div className={styles.stage}>
        <StaticOrb />
        {live ? (
          <div className={styles.canvas}>
            <OrbCanvas active={active} onReady={() => setReady(true)} onDone={() => setDone(true)} />
          </div>
        ) : null}
      </div>
      <p className={styles.label}>
        <span className="label">{live && ready && !done ? 'Arc 01 · charging' : 'Arc 01 · unlocked'}</span>
      </p>
    </div>
  );
}
