'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type ParallaxProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Travel as a percentage of the inner layer's height. */
  amount?: number;
};

/**
 * Clips its child and drifts it vertically as the frame crosses the viewport.
 * The inner layer is oversized so edges never show. Static under reduced motion.
 */
export function Parallax({ children, className, style, amount = 8 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${amount}%`, `${amount}%`]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <motion.div
        style={{
          position: 'absolute',
          inset: `-${amount}% 0`,
          y: reduceMotion ? 0 : y,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
