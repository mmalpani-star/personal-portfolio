'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { aboutPanels } from '@/data/site-data';
import type { AboutPanel } from '@/data/site-data';
import { Basketball } from './Basketball';
import styles from './MangaPanels.module.css';

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Radiating impact lines, as used behind a manga reaction shot. */
function SpeedLines() {
  return <span className={styles.speed} aria-hidden="true" />;
}

/** Manga sound type. Shares its panel's grid area but is never clipped, so it breaks the border. */
function Sfx({ panel }: { panel: AboutPanel }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={styles.sfxSlot} data-panel={panel.id} aria-hidden="true">
      <motion.span
        className={styles.sfx}
        initial={{ opacity: 0, scale: 0.6, rotate: -14 }}
        whileInView={{ opacity: 1, scale: 1, rotate: -8 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
      >
        {panel.sfx}
      </motion.span>
    </span>
  );
}

function Panel({ panel, index }: { panel: AboutPanel; index: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className={styles.panel}
      data-panel={panel.id}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.65, ease, delay: (index % 3) * 0.08 }}
    >
      <span className={styles.bg} aria-hidden="true">
        <span className={styles.tone} />
        {panel.id === 'anime' || panel.id === 'basketball' ? <SpeedLines /> : null}
        {panel.image ? (
          <span className={styles.photo}>
            <Image
              src={panel.image.src}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 100vw"
              style={{ objectFit: 'cover' }}
            />
            <span className={styles.scrim} />
          </span>
        ) : null}
      </span>

      {panel.id === 'basketball' ? <Basketball /> : null}

      <div className={styles.content}>
        <h3 className={styles.title}>{panel.title}</h3>
        {panel.tag ? <span className={styles.tag}>{panel.tag}</span> : null}
        <p className={styles.line}>{panel.line}</p>

        {panel.stats ? (
          <dl className={styles.stats}>
            {panel.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.figure}</dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {panel.id === 'basketball' ? <span className={styles.hint}>Click the panel to throw it again</span> : null}
      </div>
    </motion.article>
  );
}

export function MangaPanels() {
  return (
    <section className={`section ${styles.section}`} aria-labelledby="panels-title">
      <div className="page-shell">
        <div className={styles.heading}>
          <span className="section-index">02</span>
          <h2 id="panels-title">Off the clock</h2>
          <p>The parts that are not robots.</p>
        </div>

        <div className={styles.grid}>
          {aboutPanels.map((panel, index) => (
            <Panel key={panel.id} panel={panel} index={index} />
          ))}
          {aboutPanels.map((panel) => (
            <Sfx key={`sfx-${panel.id}`} panel={panel} />
          ))}
          <span className={styles.wedgeA} aria-hidden="true" />
          <span className={styles.wedgeB} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
