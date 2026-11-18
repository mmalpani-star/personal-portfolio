'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** A showcase slides in from one side of the screen as it comes into view; the sides alternate down the page. */
export function SideEnter({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: side === 'left' ? '-14vw' : '14vw' }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
