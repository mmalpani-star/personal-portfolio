'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * A project slides in from one side of the screen as its row comes into view. It only moves the tile: whatever is
 * inside (the walking robots, the 3D models) runs on its own clock and is not affected.
 */
export function SideEnter({ side, slug, children }: { side: 'left' | 'right'; slug: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-enter-from={side}
      data-project={slug}
      initial={reduce ? false : { opacity: 0, x: side === 'left' ? '-12vw' : '12vw' }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{ minWidth: 0 }}
    >
      {children}
    </motion.div>
  );
}
