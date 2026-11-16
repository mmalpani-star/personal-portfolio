'use client';

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ApertureRevealProps = {
  children: ReactNode;
  className?: string;
  /** Vertical centre of the iris, in px from the top of the content. */
  focusY?: number;
};

type Box = { w: number; h: number; radius: number };

/** Six-sided iris opening: `open` 0 → 1 grows the hexagon and rotates it shut-to-open. */
function hexagon(open: number, box: Box, focusY: number) {
  const rotation = (1 - open) * (Math.PI / 3) - Math.PI / 2;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = rotation + (i * Math.PI) / 3;
    return [box.w / 2 + Math.cos(angle) * box.radius * open, focusY + Math.sin(angle) * box.radius * open];
  });
}

/**
 * Opens its content like a camera aperture the first time it scrolls into view.
 * The content is unclipped in the server HTML, under reduced motion, and when the
 * page loads with it already on screen, so it can never get stuck hidden.
 */
export function ApertureReveal({ children, className, focusY = 200 }: ApertureRevealProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -22% 0px' });
  const open = useMotionValue(1);
  const [box, setBox] = useState<Box | null>(null);

  // Arm the effect only if the content starts below the fold.
  useEffect(() => {
    const node = ref.current;
    if (!node || reduceMotion) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.78) return;
    const reach = Math.hypot(rect.width / 2, Math.max(focusY, rect.height - focusY));
    open.set(0);
    setBox({ w: rect.width, h: rect.height, radius: reach / Math.cos(Math.PI / 6) });
  }, [focusY, open, reduceMotion]);

  useEffect(() => {
    if (!inView || !box) return;
    const controls = animate(open, 1, { duration: 1.15, ease: [0.65, 0, 0.35, 1] });
    return () => controls.stop();
  }, [box, inView, open]);

  const clipPath = useTransform(open, (value) => {
    if (!box || value >= 1) return 'none';
    return `polygon(${hexagon(value, box, focusY)
      .map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`)
      .join(', ')})`;
  });
  const ringPoints = useTransform(open, (value) =>
    box
      ? hexagon(value, box, focusY)
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(' ')
      : '',
  );
  const ringOpacity = useTransform(open, [0, 0.08, 0.7, 1], [0, 1, 0.6, 0]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative' }}>
      <motion.div style={{ clipPath }}>{children}</motion.div>
      {box ? (
        <svg
          aria-hidden="true"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <motion.polygon
            points={ringPoints}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            style={{ opacity: ringOpacity }}
          />
        </svg>
      ) : null}
    </div>
  );
}
