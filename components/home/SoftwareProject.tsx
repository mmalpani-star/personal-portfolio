'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useFinePointer } from '@/components/effects';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import type { Project } from '@/data/site-data';
import styles from './Work.module.css';

/** Lower-key row for software and hackathon work, led by its achievement. */
export function SoftwareProject({ project, number }: { project: Project; number: string }) {
  const finePointer = useFinePointer();
  const [hovered, setHovered] = useState(false);
  const preview = project.showcaseMedia?.find((media) => media.type === 'video');
  const hero = project.heroMedia;
  const [headline, ...facts] = project.achievement?.detail.split(' · ') ?? [];
  const href = `/projects/${project.slug}`;

  return (
    <article
      className={`${styles.software} spotlight`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-labelledby={`${project.slug}-title`}
    >
      <Link href={href} className={styles.softwareMedia} tabIndex={-1} aria-hidden="true">
        {hero?.type === 'image' ? (
          <Image src={hero.src} alt="" fill sizes="(max-width: 900px) 100vw, 34vw" className={styles.tileImage} />
        ) : null}
        {preview?.type === 'video' && finePointer ? (
          <div className={styles.tileVideo} data-visible={hovered}>
            <VideoPlayer
              src={preview.previewSrc ?? preview.src}
              poster={preview.poster}
              label={preview.alt}
              mode="preview"
              playing={hovered}
            />
          </div>
        ) : null}
        <span className={styles.tileIndex}>{number}</span>
      </Link>

      {project.achievement ? (
        <div className={styles.softwareStat}>
          <span className={styles.statFigure}>{headline}</span>
          <span className={styles.statFacts}>{facts.join(' · ')}</span>
          <span className={styles.statLabel}>{project.achievement.label}</span>
        </div>
      ) : null}

      <div className={styles.softwareBody}>
        <div className={styles.tileHead}>
          <span className="label">{project.category}</span>
          <StatusBadge status={project.status} />
        </div>
        <h3 id={`${project.slug}-title`} className={styles.tileTitle}>
          <Link href={href}>{project.title}</Link>
        </h3>
        <p className={styles.tileSummary}>{project.summary}</p>
        <div className="cta-row">
          <Link href={href} className="button button-secondary">
            View project
            <Icon name="arrow-right" size={15} />
          </Link>
          {project.github ? (
            <a href={project.github} className="button button-text" target="_blank" rel="noreferrer">
              <Icon name="github" size={15} />
              GitHub
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
