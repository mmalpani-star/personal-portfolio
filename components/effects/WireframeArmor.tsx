'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import styles from './WireframeArmor.module.css';

const INSET = 9;
const CHAMFER = 24;

/** Segment paths for a box of w × h px: an outer chamfered shell, inner corner plates, ribs and crests. */
function build(w: number, h: number) {
  const m = INSET;
  const c = CHAMFER;
  const i = m + 9; // inner shell inset
  const k = c - 4; // inner chamfer
  const arm = Math.min(70, w * 0.16); // length of each inner corner arm
  const crest = Math.min(46, w * 0.1);
  const cx = w / 2;

  return {
    // The shell is drawn as two halves that meet at opposite corners.
    shell: [
      `M${m} ${h / 2}V${m + c}L${m + c} ${m}H${w - m - c}L${w - m} ${m + c}V${h / 2}`,
      `M${w - m} ${h / 2}V${h - m - c}L${w - m - c} ${h - m}H${m + c}L${m} ${h - m - c}V${h / 2}`,
    ],
    plates: [
      `M${i} ${i + k + arm}V${i + k}L${i + k} ${i}H${i + k + arm}`,
      `M${w - i - k - arm} ${i}H${w - i - k}L${w - i} ${i + k}V${i + k + arm}`,
      `M${w - i} ${h - i - k - arm}V${h - i - k}L${w - i - k} ${h - i}H${w - i - k - arm}`,
      `M${i + k + arm} ${h - i}H${i + k}L${i} ${h - i - k}V${h - i - k - arm}`,
    ],
    ribs: [0.36, 0.5, 0.64].flatMap((f) => [`M${m} ${h * f}h13`, `M${w - m} ${h * f}h-13`]),
    crests: [
      `M${cx - crest} ${m}l14 11H${cx + crest - 14}l14 -11`,
      `M${cx - crest} ${h - m}l14 -11H${cx + crest - 14}l14 11`,
    ],
    gussets: [
      `M${m} ${m + c}L${m + c} ${m}L${i + k} ${i}L${i} ${i + k}Z`,
      `M${w - m - c} ${m}L${w - m} ${m + c}L${w - i} ${i + k}L${w - i - k} ${i}Z`,
      `M${w - m} ${h - m - c}L${w - m - c} ${h - m}L${w - i - k} ${h - i}L${w - i} ${h - i - k}Z`,
      `M${m + c} ${h - m}L${m} ${h - m - c}L${i} ${h - i - k}L${i + k} ${h - i}Z`,
    ],
  };
}

const drawEase: [number, number, number, number] = [0.65, 0, 0.35, 1];

const draw = (delay: number, duration: number): Variants => ({
  hidden: { pathLength: 0, opacity: 0 },
  shown: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { delay, duration, ease: drawEase }, opacity: { delay, duration: 0.01 } },
  },
});

const fade = (delay: number): Variants => ({
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { delay, duration: 0.5 } },
});

/**
 * A translucent wireframe that assembles around the image it overlays the first
 * time it scrolls into view, then stays. Place it inside a positioned media box.
 * Under reduced motion it is simply drawn.
 */
export function WireframeArmor() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const paths = size && size.w > 120 && size.h > 120 ? build(size.w, size.h) : null;

  return (
    <div ref={ref} className={styles.armor} aria-hidden="true">
      {paths && size ? (
        <motion.svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="shown"
          viewport={{ once: true, amount: 0.55 }}
        >
          {paths.gussets.map((d, index) => (
            <motion.path key={d} d={d} className={styles.gusset} variants={fade(1.15 + index * 0.06)} />
          ))}
          {paths.shell.map((d) => (
            <motion.path key={d} d={d} className={styles.shell} variants={draw(0.1, 1)} />
          ))}
          {paths.plates.map((d, index) => (
            <motion.path key={d} d={d} className={styles.plate} variants={draw(0.5 + index * 0.1, 0.6)} />
          ))}
          {paths.ribs.map((d, index) => (
            <motion.path key={d} d={d} className={styles.plate} variants={draw(0.95 + index * 0.04, 0.25)} />
          ))}
          {paths.crests.map((d) => (
            <motion.path key={d} d={d} className={styles.shell} variants={draw(1.05, 0.45)} />
          ))}
        </motion.svg>
      ) : null}
    </div>
  );
}
