'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styles from './Overlays.module.css';

// Greet once per page load, not once per mount.
let greeted = false;

const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/**
 * The site's one hidden extra: the Konami code switches "blueprint mode" on
 * and off (a brighter grid and cyan-tinted drawings; see globals.css). Also
 * leaves a note in the console for people who open it.
 */
export function EasterEggs() {
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!greeted) {
      greeted = true;
      console.log(
        '%cHi, fellow inspector of source code.%c\nThe robots are real; the bugs are mostly fixed.\n→ https://github.com/mmalpani-star',
        'font: 600 14px system-ui; color: #ffb547',
        'font: 12px ui-monospace, monospace; color: #95918a',
      );
    }

    let progress = 0;
    let timer = 0;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      progress = key === konami[progress] ? progress + 1 : key === konami[0] ? 1 : 0;
      if (progress < konami.length) return;
      progress = 0;
      const root = document.documentElement;
      const on = root.dataset.blueprint !== 'on';
      if (on) root.dataset.blueprint = 'on';
      else delete root.dataset.blueprint;
      setToast(on ? '+30 lives. The hexapod still has six legs.' : 'Blueprint mode off. Lives not refunded.');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 4200);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast}
          className={styles.toast}
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className={styles.toastTag}>Cheat accepted</span>
          {toast}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
