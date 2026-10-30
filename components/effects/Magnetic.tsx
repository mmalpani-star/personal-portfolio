'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';
import { useFinePointer } from './useFinePointer';

type MagneticProps = {
  children: ReactNode;
  /** Fraction of the pointer offset the element follows. */
  strength?: number;
  className?: string;
};

/** Pulls its child gently toward the pointer. Inline wrapper; no-op on touch / reduced motion. */
export function Magnetic({ children, strength = 0.22, className }: MagneticProps) {
  const enabled = useFinePointer();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.5 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.5 });

  const onMove = (event: PointerEvent<HTMLSpanElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (r.left + r.width / 2)) * strength);
    y.set((event.clientY - (r.top + r.height / 2)) * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (!enabled) return <span className={className} style={{ display: 'inline-flex' }}>{children}</span>;

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-flex', x, y }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.span>
  );
}
