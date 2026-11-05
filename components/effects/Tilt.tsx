'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { useFinePointer } from './useFinePointer';

type TiltProps = {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees. */
  max?: number;
};

/** Subtle 3D tilt toward the pointer. Static on touch devices and under reduced motion. */
export function Tilt({ children, className, max = 4 }: TiltProps) {
  const enabled = useFinePointer();
  const rect = useRef<DOMRect | null>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 160, damping: 20, mass: 0.6 };
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring);

  const onEnter = (event: PointerEvent<HTMLDivElement>) => {
    rect.current = event.currentTarget.getBoundingClientRect();
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const r = rect.current;
    if (!r) return;
    px.set((event.clientX - r.left) / r.width - 0.5);
    py.set((event.clientY - r.top) / r.height - 0.5);
  };

  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
