'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from '@/components/animation';
import { ArcHeading } from '@/components/ui/ArcHeading';
import { offTheClock } from '@/data/site-data';
import type { OffClockMotif } from '@/data/site-data';
import styles from './OffTheClock.module.css';

/** Original line drawings, one per hobby. Each animates on hover and once on first view. */
const motifs: Record<OffClockMotif, JSX.Element> = {
  basketball: (
    <svg viewBox="0 0 120 72" className={styles.art} aria-hidden="true">
      <path className={styles.guide} d="M12 62 Q 58 -14 102 30" />
      <path className={styles.line} d="M96 30h16M112 16v22" />
      <path className={styles.line} d="M12 62h18M12 62l13-13" />
      <text className={styles.note} x="30" y="58">
        θ
      </text>
      <text className={styles.note} x="50" y="14">
        apex
      </text>
      <circle className={styles.ball} r="5" />
    </svg>
  ),
  film: (
    <svg viewBox="0 0 120 72" className={styles.art} aria-hidden="true">
      <path className={styles.line} d="M8 20V8h12M100 8h12v12M112 52v12h-12M20 64H8V52" />
      <rect className={`${styles.line} ${styles.focus}`} x="44" y="22" width="32" height="28" />
      <path className={styles.guide} d="M60 30v12M54 36h12" />
      <circle className={styles.rec} cx="18" cy="18" r="3" />
      <text className={styles.note} x="25" y="21">
        REC
      </text>
    </svg>
  ),
  gaming: (
    <svg viewBox="0 0 120 72" className={styles.art} aria-hidden="true">
      <g className={styles.cross}>
        <path className={`${styles.line} ${styles.crossN}`} d="M60 12v14" />
        <path className={`${styles.line} ${styles.crossS}`} d="M60 46v14" />
        <path className={`${styles.line} ${styles.crossW}`} d="M36 36h14" />
        <path className={`${styles.line} ${styles.crossE}`} d="M70 36h14" />
      </g>
      <circle className={styles.dot} cx="60" cy="36" r="1.6" />
      <path className={`${styles.line} ${styles.hit}`} d="M50 26l5 5M70 26l-5 5M50 46l5-5M70 46l-5-5" />
    </svg>
  ),
  anime: (
    <svg viewBox="0 0 120 72" className={styles.art} aria-hidden="true">
      <g className={styles.speed}>
        <path className={styles.line} d="M6 14h52" />
        <path className={styles.line} d="M22 25h74" />
        <path className={styles.line} d="M10 36h40" />
        <path className={styles.line} d="M34 47h78" />
        <path className={styles.line} d="M14 58h46" />
      </g>
      <path className={styles.spark} d="M92 22l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
    </svg>
  ),
};

export function OffTheClock() {
  const reduceMotion = useReducedMotion();
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  return (
    <section id="off-the-clock" className="section section--raised" aria-labelledby="off-the-clock-title">
      <div className="page-shell">
        <Reveal>
          <ArcHeading
            arc="05"
            id="off-the-clock-title"
            title="Off the Clock"
            description="The parts of the build that are not robots."
          />
        </Reveal>

        <ul className={styles.grid}>
          {offTheClock.map((item, index) => (
            <motion.li
              key={item.motif}
              className={`${styles.tile} spotlight`}
              data-motif={item.motif}
              data-play={!reduceMotion && Boolean(seen[item.motif])}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
              onViewportEnter={() => setSeen((value) => (value[item.motif] ? value : { ...value, [item.motif]: true }))}
            >
              <div className={styles.stage}>{motifs[item.motif]}</div>
              <div className={styles.body}>
                <div className={styles.head}>
                  <h3 className={styles.title}>{item.title}</h3>
                  <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                </div>
                {item.tag ? <span className={styles.tag}>{item.tag}</span> : null}
                <p className={styles.copy}>{item.line}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
