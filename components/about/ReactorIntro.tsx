'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { ArcReactor } from './ArcReactor';
import styles from './ReactorIntro.module.css';

const STORAGE_KEY = 'reactor-seen';
const RUN_MS = 3200;

const ease: [number, number, number, number] = [0.65, 0, 0.35, 1];

/**
 * Full-screen reactor sequence shown the first time About Me is opened in a
 * browsing session. Any click, key or scroll skips it; reduced motion and
 * repeat visits never see it at all.
 */
export function ReactorIntro() {
  // `null` = still deciding on first paint, so repeat visitors never see a flash.
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
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease } }}
        >
          {/* Power-up: the housing arrives, then the energy comes online */}
          <motion.div
            className={styles.stage}
            initial={{ opacity: 0, scale: 0.42, rotate: -24, filter: 'brightness(0.25)' }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'brightness(1)' }}
            transition={{ duration: 2, ease, filter: { delay: 0.9, duration: 1.2 } }}
          >
            <ArcReactor size="min(62vmin, 440px)" animateIn={false} />
          </motion.div>

          {/* Shockwave as the core tops out */}
          <motion.span
            className={styles.shock}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.75, 0], scale: [0.3, 2.6, 3.4] }}
            transition={{ delay: 2.1, duration: 1, ease }}
          />

          <motion.p
            className={styles.caption}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.4, duration: 0.5 }}
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
