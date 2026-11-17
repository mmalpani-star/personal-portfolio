'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { aboutPanels } from '@/data/site-data';
import type { AboutPanel } from '@/data/site-data';
import { Basketball } from './Basketball';
import styles from './MangaPanels.module.css';

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Panels that get radiating impact lines behind their copy. */
const withSpeedLines = new Set(['naruto', 'basketball', 'onepiece']);

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
  const gallery = panel.images ?? [];
  const isSketchbook = panel.id === 'sketchbook';

  return (
    <motion.article
      className={styles.panel}
      data-panel={panel.id}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.65, ease, delay: (index % 3) * 0.07 }}
    >
      <span className={styles.bg} aria-hidden="true">
        <span className={styles.tone} />
        {withSpeedLines.has(panel.id) ? <span className={styles.speed} /> : null}
        {/* A single photo fills the frame; the sketchbook lays its drawings out instead. */}
        {!isSketchbook && gallery[0] ? (
          <span className={styles.photo}>
            <Image
              src={gallery[0].src}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 70vw"
              style={{ objectFit: 'cover', objectPosition: gallery[0].position ?? '50% 50%' }}
            />
            <span className={styles.scrim} />
          </span>
        ) : null}
      </span>

      {panel.id === 'basketball' ? <Basketball /> : null}

      {isSketchbook && gallery.length ? (
        <div className={styles.sketches}>
          {gallery.map((img) => (
            <figure key={img.src} className={styles.sketch}>
              <Image
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                sizes="(max-width: 900px) 42vw, 22vw"
              />
            </figure>
          ))}
        </div>
      ) : null}

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

        <div className={styles.actions}>
          {panel.link ? (
            <a className={styles.linkButton} href={panel.link.href} target="_blank" rel="noreferrer">
              {panel.link.label}
              <Icon name="arrow-up-right" size={13} />
            </a>
          ) : null}
          {panel.id === 'basketball' ? <span className={styles.hint}>Click the panel to throw it</span> : null}
        </div>
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
