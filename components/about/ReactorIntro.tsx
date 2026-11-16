'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import styles from './ReactorIntro.module.css';

const STORAGE_KEY = 'reactor-seen';
const RUN_MS = 3000;

const RINGS = 8;
const COILS = 12;

const ease: [number, number, number, number] = [0.65, 0, 0.35, 1];

const drawRing = (delay: number, duration: number): Variants => ({
  hidden: { pathLength: 0, opacity: 0 },
  shown: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { delay, duration, ease }, opacity: { delay, duration: 0.01 } },
  },
});

const popCoil = (delay: number): Variants => ({
  hidden: { opacity: 0, scale: 0.55 },
  shown: { opacity: 1, scale: 1, transition: { delay, duration: 0.45, ease } },
});

/** One coil segment, as a trapezoid sitting `r` from the centre at `angle` degrees. */
function coilPath(angle: number, inner: number, outer: number, spread: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (r: number, deg: number) => `${(100 + Math.cos(rad(deg)) * r).toFixed(2)} ${(100 + Math.sin(rad(deg)) * r).toFixed(2)}`;
  return `M${pt(inner, angle - spread)}L${pt(outer, angle - spread * 0.68)}L${pt(outer, angle + spread * 0.68)}L${pt(inner, angle + spread)}Z`;
}

/**
 * Full-screen reactor sequence shown the first time About Me is opened in a
 * browsing session. Any click, key or scroll skips it; reduced motion and
 * repeat visits never see it at all.
 */
export function ReactorIntro() {
  // `null` = still deciding (first paint), so the overlay never flashes for repeat visitors.
  const [playing, setPlaying] = useState<boolean | null>(null);
  const reduceMotion = useReducedMotion();

  const finish = useCallback(() => {
    setPlaying(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage can be blocked; the intro simply plays again next time.
    }
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setPlaying(false);
      return;
    }
    let seen = false;
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      seen = false;
    }
    setPlaying(!seen);
  }, [reduceMotion]);

  useEffect(() => {
    if (!playing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(finish, RUN_MS);
    const skip = () => finish();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [finish, playing]);

  return (
    <AnimatePresence>
      {playing ? (
        <motion.div
          className={styles.overlay}
          role="presentation"
          initial="hidden"
          animate="shown"
          exit={{ opacity: 0, transition: { duration: 0.5, ease } }}
        >
          <motion.svg
            className={styles.reactor}
            viewBox="0 0 200 200"
            aria-hidden="true"
            variants={{ hidden: {}, shown: {} }}
          >
            {/* Outer housing, drawn first */}
            <motion.circle
              cx="100"
              cy="100"
              r="88"
              className={styles.housing}
              variants={drawRing(0.1, 0.8)}
            />

            {/* Tick ring: counter-rotates once it has drawn */}
            <motion.g
              className={styles.spinSlow}
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { delay: 0.5, duration: 0.4 } } }}
            >
              {Array.from({ length: RINGS * 6 }, (_, i) => {
                const angle = (i * 360) / (RINGS * 6);
                const long = i % 6 === 0;
                return (
                  <line
                    key={angle}
                    x1="100"
                    y1={long ? 12 : 15}
                    x2="100"
                    y2="20"
                    className={long ? styles.tickLong : styles.tick}
                    transform={`rotate(${angle} 100 100)`}
                  />
                );
              })}
            </motion.g>

            {/* Coil segments pop in one by one */}
            <g className={styles.spinFast}>
              {Array.from({ length: COILS }, (_, i) => {
                const angle = (i * 360) / COILS - 90;
                return (
                  <motion.path
                    key={angle}
                    d={coilPath(angle, 38, 62, 13)}
                    className={styles.coil}
                    style={{ transformOrigin: '100px 100px' }}
                    variants={popCoil(0.75 + i * 0.045)}
                  />
                );
              })}
            </g>

            {/* Inner race */}
            <motion.circle cx="100" cy="100" r="33" className={styles.race} variants={drawRing(0.9, 0.6)} />
            <motion.circle cx="100" cy="100" r="68" className={styles.race} variants={drawRing(0.35, 0.7)} />

            {/* Core ignites last */}
            <motion.g
              variants={{
                hidden: { opacity: 0, scale: 0.2 },
                shown: { opacity: 1, scale: 1, transition: { delay: 1.5, duration: 0.7, ease } },
              }}
              style={{ transformOrigin: '100px 100px' }}
            >
              <circle cx="100" cy="100" r="26" className={styles.coreGlow} />
              <circle cx="100" cy="100" r="17" className={styles.core} />
              <circle cx="100" cy="100" r="9" className={styles.coreHot} />
            </motion.g>

            {/* Bloom flash as the sequence tops out */}
            <motion.circle
              cx="100"
              cy="100"
              r="30"
              className={styles.flash}
              variants={{
                hidden: { opacity: 0, scale: 0.4 },
                shown: { opacity: [0, 0.9, 0], scale: [0.4, 3.4, 4.2], transition: { delay: 2.15, duration: 0.85, ease } },
              }}
              style={{ transformOrigin: '100px 100px' }}
            />
          </motion.svg>

          <motion.p
            className={styles.caption}
            variants={{
              hidden: { opacity: 0 },
              shown: { opacity: 1, transition: { delay: 2.3, duration: 0.5 } },
            }}
          >
            About Me
          </motion.p>

          <button type="button" className={styles.skip} onClick={finish}>
            Skip
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
