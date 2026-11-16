'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { recordMission } from './missions';
import styles from './Overlays.module.css';

type AceTrackerProps = {
  /** The flagship project being viewed. */
  slug: string;
  /** Every flagship slug; the banner fires once all have been opened. */
  all: string[];
};

/** Counts flagship case-study visits and shows a one-time banner when all are done. */
export function AceTracker({ slug, all }: AceTrackerProps) {
  const reduceMotion = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!recordMission(slug, all)) return;
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 9000);
    return () => window.clearTimeout(timer);
  }, [all, slug]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className={styles.ace}
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -40, scaleX: 0.6 }}
          animate={{ opacity: 1, y: 0, scaleX: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        >
          <span className={styles.aceWord}>ACE</span>
          <span className={styles.aceText}>
            <strong>
              {all.length}/{all.length} flagship missions inspected
            </strong>
            <span>That is all of them. Thanks for reading the whole thing.</span>
          </span>
          <Link href="/#contact" className={styles.aceLink}>
            Say hi
            <Icon name="arrow-right" size={13} />
          </Link>
          <button type="button" className={styles.aceClose} onClick={() => setShow(false)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
