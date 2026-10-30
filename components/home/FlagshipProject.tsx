'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ImageReveal, Reveal } from '@/components/animation';
import { Magnetic, Parallax } from '@/components/effects';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Project, ProjectMediaItem } from '@/data/site-data';
import styles from './Work.module.css';

type ImageMedia = Extract<ProjectMediaItem, { type: 'image' }>;

type FlagshipProjectProps = {
  project: Project;
  number: string;
  reverse?: boolean;
};

/** Crop only when the image is close to the stage's shape; otherwise show it whole. */
function fitFor(media: ImageMedia, stageRatio: number) {
  return Math.abs(Math.log(media.width / media.height / stageRatio)) > 0.35 ? 'contain' : 'cover';
}

export function FlagshipProject({ project, number, reverse = false }: FlagshipProjectProps) {
  const images = [project.heroMedia, ...(project.galleryImages ?? [])]
    .filter((media): media is ImageMedia => media?.type === 'image')
    .slice(0, 4);
  const [active, setActive] = useState(0);

  const hero = images[0];
  if (!hero) return null;

  const portrait = hero.height > hero.width;
  const stageRatio = portrait ? 4 / 5 : 4 / 3;
  const current = images[active] ?? hero;
  const href = `/projects/${project.slug}`;

  return (
    <article className={`${styles.flagship} ${reverse ? styles.flagshipReverse : ''}`} aria-labelledby={`${project.slug}-title`}>
      <div className={`${styles.flagshipMedia} ${portrait ? styles.flagshipMediaPortrait : ''}`}>
        <div className="corners">
          <Link href={href} className={styles.stageLink} aria-label={`View the ${project.title} case study`}>
            <ImageReveal className={styles.stage} style={{ aspectRatio: portrait ? '4 / 5' : '4 / 3' }}>
              <Parallax style={{ position: 'absolute', inset: 0 }} amount={5}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={current.src}
                    className={styles.stageImage}
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Image
                      src={current.src}
                      alt={current.alt}
                      fill
                      sizes="(max-width: 900px) 100vw, 60vw"
                      style={{ objectFit: fitFor(current, stageRatio) }}
                    />
                  </motion.div>
                </AnimatePresence>
              </Parallax>
              <span className={styles.stageShade} aria-hidden="true" />
              <span className={styles.stageCta} aria-hidden="true">
                Open case study <Icon name="arrow-up-right" size={14} />
              </span>
            </ImageReveal>
          </Link>
        </div>

        <div className={styles.stageMeta}>
          <span className={styles.figCaption}>
            <span className={styles.figIndex}>
              FIG. {number}.{active + 1}
            </span>
            {current.caption ?? current.alt}
          </span>
          {images.length > 1 ? (
            <div className={styles.thumbs} role="group" aria-label={`${project.shortTitle} images`}>
              {images.map((media, index) => (
                <button
                  key={media.src}
                  type="button"
                  className={styles.thumb}
                  aria-pressed={index === active}
                  aria-label={`Show ${media.caption ?? media.alt}`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                >
                  <Image src={media.src} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Reveal className={styles.flagshipInfo} delay={0.1}>
        <div className={styles.flagshipTop}>
          <span className={styles.bigIndex}>{number}</span>
          <StatusBadge status={project.status} />
        </div>
        <span className="label">{project.category}</span>
        <h3 id={`${project.slug}-title`} className={styles.flagshipTitle}>
          <Link href={href}>{project.title}</Link>
        </h3>
        <p className={styles.flagshipSummary}>{project.summary}</p>

        <dl className={styles.specGrid}>
          {project.highlights.map((highlight, index) => (
            <div key={highlight} className={styles.spec}>
              <dt>{String(index + 1).padStart(2, '0')}</dt>
              <dd>{highlight}</dd>
            </div>
          ))}
        </dl>

        <p className={styles.statusNote}>{project.statusNote}</p>

        <div className={`cta-row ${styles.flagshipActions}`}>
          <Magnetic>
            <Link href={href} className="button button-primary">
              View case study
              <Icon name="arrow-right" size={15} />
            </Link>
          </Magnetic>
          {project.github ? (
            <a href={project.github} className="button button-text" target="_blank" rel="noreferrer">
              <Icon name="github" size={15} />
              GitHub
            </a>
          ) : null}
        </div>
      </Reveal>
    </article>
  );
}
