'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ArcReactor } from './ArcReactor';
import styles from './ReactorIntro.module.css';

const STORAGE_KEY = 'reactor-seen';

/** Fired on window once the reactor overlay has fully faded out (see Typewriter). */
export const REACTOR_DONE_EVENT = 'reactor:done';

/** The supplied animated reactor (500 x 282, black background, 10 frames, loops). */
const REACTOR_SRC = '/images/about/arc-reactor.webp';

/** How long the reactor stays up once it has started to appear. */
const RUN_MS = 3400;
/** If the file has not loaded by now, give up rather than leave a black screen. */
const GIVE_UP_MS = 6000;

const ease: [number, number, number, number] = [0.65, 0, 0.35, 1];

/**
 * Full-screen reactor sequence shown the first time About Me is opened in a
 * browsing session: black, then the reactor powers up out of the dark. Any click,
 * key or scroll skips it; reduced motion and repeat visits never see it at all.
 */
export function ReactorIntro() {
  // `null` = still deciding on first paint, so repeat visitors never see a flash.
  const [playing, setPlaying] = useState<boolean | null>(null);
  // The reactor is shown once its image is in; if the file is missing, the drawn one stands in.
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
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
    // Mark the page as covered right away (before the Typewriter's observer can fire), so the
    // heading underneath waits for the reactor instead of typing out unseen.
    if (!seen) document.documentElement.dataset.reactor = 'playing';
    setPlaying(!seen);
  }, [reduceMotion]);

  // Skip on any input, and lock scrolling underneath while it plays.
  useEffect(() => {
    if (!playing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const skip = () => finish();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [finish, playing]);

  // The clock starts when the reactor appears, so a slow load never eats the show.
  useEffect(() => {
    if (!playing || !ready) return;
    const timer = window.setTimeout(finish, RUN_MS);
    return () => window.clearTimeout(timer);
  }, [finish, playing, ready]);

  useEffect(() => {
    if (!playing || ready) return;
    const timer = window.setTimeout(finish, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [finish, playing, ready]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        delete document.documentElement.dataset.reactor;
        window.dispatchEvent(new Event(REACTOR_DONE_EVENT));
      }}
    >
      {playing ? (
        <motion.div
          className={styles.overlay}
          role="presentation"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease } }}
        >
          {/* Cyan light that swells behind the reactor as it comes up */}
          <motion.span
            className={styles.bloom}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={ready ? { opacity: [0, 0.85, 0.55], scale: [0.5, 1.1, 1] } : { opacity: 0 }}
            transition={{ duration: 2.4, ease, times: [0, 0.6, 1] }}
          />

          {/* Power-up: out of the dark, from dim and soft to full brightness */}
          <motion.div
            className={styles.stage}
            initial={{ opacity: 0, scale: 0.8, filter: 'brightness(0.15) blur(8px)' }}
            animate={
              ready
                ? { opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }
                : { opacity: 0, scale: 0.8, filter: 'brightness(0.15) blur(8px)' }
            }
            transition={{ duration: 1.9, ease }}
          >
            {missing ? (
              <ArcReactor size="min(62vmin, 440px)" animateIn={false} />
            ) : (
              <Image
                className={styles.reactor}
                src={REACTOR_SRC}
                alt=""
                width={500}
                height={282}
                // Animated WebP: the image optimiser would flatten it to a single frame.
                unoptimized
                priority
                onLoad={() => setReady(true)}
                onError={() => {
                  setMissing(true);
                  setReady(true);
                }}
              />
            )}
          </motion.div>

          {/* Shockwave as it reaches full power */}
          <motion.span
            className={styles.shock}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={ready ? { opacity: [0, 0.8, 0], scale: [0.3, 2.4, 3.2] } : { opacity: 0 }}
            transition={{ delay: 1.5, duration: 1.1, ease }}
          />

          <motion.p
            className={styles.caption}
            initial={{ opacity: 0, y: 10 }}
            animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: 1.9, duration: 0.6 }}
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
