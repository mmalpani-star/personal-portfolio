'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import styles from './ArcReactor.module.css';

type ArcReactorProps = {
  /** Any CSS length. Drives the whole assembly, which is otherwise unitless. */
  size?: string;
  className?: string;
  /** Skips the entrance animation when the reactor is already on screen. */
  animateIn?: boolean;
};

const COILS = 10;
const TICKS = 60;
const BOLTS = 8;

const polar = (r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [100 + Math.cos(rad) * r, 100 + Math.sin(rad) * r];
};

const fmt = ([x, y]: number[]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** One coil segment: a trapezoid spanning `spread` degrees between two radii. */
function coilPath(deg: number, inner: number, outer: number, spread: number) {
  return [
    `M${fmt(polar(inner, deg - spread))}`,
    `L${fmt(polar(outer, deg - spread * 0.72))}`,
    `L${fmt(polar(outer, deg + spread * 0.72))}`,
    `L${fmt(polar(inner, deg + spread))}`,
    'Z',
  ].join('');
}

/** Equilateral triangle of circumradius `r`, rotated by `rot` degrees. */
function trianglePath(r: number, rot = 0) {
  return [0, 120, 240].map((d, i) => `${i ? 'L' : 'M'}${fmt(polar(r, d + rot))}`).join('') + 'Z';
}

/**
 * An original arc reactor: concentric machined rings, radial coils and a
 * triangular core, lit ice-blue. Rings turn at independent speeds and
 * directions in CSS; Framer Motion handles entrance and hover only.
 */
export function ArcReactor({ size = 'min(62vmin, 460px)', className = '', animateIn = true }: ArcReactorProps) {
  const reduceMotion = useReducedMotion();
  const [hot, setHot] = useState(false);

  return (
    <motion.div
      className={`${styles.wrap} ${className}`.trim()}
      style={{ width: size }}
      data-hot={hot}
      data-still={Boolean(reduceMotion)}
      initial={animateIn && !reduceMotion ? { opacity: 0, scale: 0.86 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHot(true)}
      onHoverEnd={() => setHot(false)}
    >
      <svg viewBox="0 0 200 200" className={styles.svg} aria-hidden="true">
        <defs>
          {/* Brushed metal: lit from the upper left */}
          <linearGradient id="ar-metal" x1="18%" y1="2%" x2="82%" y2="98%">
            <stop offset="0%" stopColor="#f2f6fa" />
            <stop offset="34%" stopColor="#b9c6d3" />
            <stop offset="62%" stopColor="#6d7c8b" />
            <stop offset="100%" stopColor="#38434f" />
          </linearGradient>
          <linearGradient id="ar-metal-rev" x1="82%" y1="98%" x2="18%" y2="2%">
            <stop offset="0%" stopColor="#e6edf4" />
            <stop offset="45%" stopColor="#8d9bab" />
            <stop offset="100%" stopColor="#2f3942" />
          </linearGradient>
          <linearGradient id="ar-bezel" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#c6d2de" />
            <stop offset="70%" stopColor="#5e6b79" />
            <stop offset="100%" stopColor="#222b33" />
          </linearGradient>

          {/* Energy */}
          <radialGradient id="ar-core">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="34%" stopColor="#d9f6ff" />
            <stop offset="66%" stopColor="#5fd2f5" />
            <stop offset="100%" stopColor="#1b8fc4" />
          </radialGradient>
          <radialGradient id="ar-halo">
            <stop offset="0%" stopColor="#8fe6ff" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#3fb9e8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1b8fc4" stopOpacity="0" />
          </radialGradient>

          <filter id="ar-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ar-soft" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* Ambient halo behind everything */}
        <circle className={styles.halo} cx="100" cy="100" r="86" fill="url(#ar-halo)" />

        {/* Outer bezel with machined bolts */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="url(#ar-bezel)" strokeWidth="8" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="#161d24" strokeWidth="1" opacity="0.6" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="url(#ar-metal-rev)" strokeWidth="3" />
        {Array.from({ length: BOLTS }, (_, i) => {
          const [x, y] = polar(92, (i * 360) / BOLTS + 22.5);
          return (
            <g key={`bolt-${i}`}>
              <circle cx={x} cy={y} r="3.4" fill="url(#ar-metal)" stroke="#1b232b" strokeWidth="0.6" />
              <circle cx={x} cy={y} r="1.3" fill="#2a343d" />
            </g>
          );
        })}

        {/* Tick ring: slow, clockwise */}
        <g className={styles.ringSlow}>
          <circle cx="100" cy="100" r="78" fill="none" stroke="url(#ar-metal)" strokeWidth="6" />
          {Array.from({ length: TICKS }, (_, i) => {
            const deg = (i * 360) / TICKS;
            const major = i % 5 === 0;
            const [x1, y1] = polar(major ? 73 : 75.5, deg);
            const [x2, y2] = polar(81, deg);
            return (
              <line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={major ? styles.tickMajor : styles.tick}
              />
            );
          })}
        </g>

        {/* Coil assembly: faster, anticlockwise */}
        <g className={styles.ringFast}>
          <circle cx="100" cy="100" r="66" fill="none" stroke="url(#ar-metal-rev)" strokeWidth="2" />
          {Array.from({ length: COILS }, (_, i) => {
            const deg = (i * 360) / COILS;
            return (
              <g key={`coil-${i}`}>
                <path d={coilPath(deg, 42, 63, 15)} className={styles.coilBody} />
                <path d={coilPath(deg, 46, 59, 10)} className={styles.coilLight} />
              </g>
            );
          })}
        </g>

        {/* Inner race: slow, anticlockwise */}
        <g className={styles.raceSpin}>
          <circle cx="100" cy="100" r="38" fill="none" stroke="url(#ar-bezel)" strokeWidth="5" />
          {Array.from({ length: 3 }, (_, i) => (
            <path key={`arc-${i}`} d={trianglePath(33, i * 120 + 18)} className={styles.innerArc} />
          ))}
        </g>

        {/* Core */}
        <circle className={styles.coreBloom} cx="100" cy="100" r="30" fill="#7fe3ff" filter="url(#ar-soft)" />
        <circle cx="100" cy="100" r="26" fill="#10161c" stroke="url(#ar-metal)" strokeWidth="2" />
        <path d={trianglePath(21)} className={styles.coreTriangle} filter="url(#ar-glow)" />
        <path d={trianglePath(13, 180)} className={styles.coreInner} />
        <circle className={styles.coreHot} cx="100" cy="100" r="6.5" fill="url(#ar-core)" filter="url(#ar-glow)" />

        {/* Specular sweep over the glass */}
        <ellipse className={styles.sheen} cx="78" cy="68" rx="34" ry="19" transform="rotate(-32 78 68)" />
      </svg>
    </motion.div>
  );
}
