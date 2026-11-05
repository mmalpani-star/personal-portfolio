'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Tilt, useFinePointer } from '@/components/effects';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import type { Project } from '@/data/site-data';
import styles from './Work.module.css';

type ProjectTileProps = {
  project: Project;
  number: string;
  large?: boolean;
};

/** Hardware project card: tilt + spotlight, image zoom, and a video preview on hover where one exists. */
export function ProjectTile({ project, number, large = false }: ProjectTileProps) {
  const finePointer = useFinePointer();
  const [hovered, setHovered] = useState(false);
  const preview = project.showcaseMedia?.find((media) => media.type === 'video');
  const hero = project.heroMedia;

  return (
    <Tilt className={`${styles.tileWrap} ${large ? styles.tileLarge : ''}`} max={3}>
      <Link
        href={`/projects/${project.slug}`}
        className={`${styles.tile} spotlight`}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className={styles.tileMedia}>
          {hero?.type === 'image' ? (
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              sizes={large ? '(max-width: 900px) 100vw, 58vw' : '(max-width: 900px) 100vw, 40vw'}
              className={styles.tileImage}
            />
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
          {preview ? (
            <span className={styles.tileVideoHint}>
              <Icon name="play" size={10} /> Hover for demo
            </span>
          ) : null}
        </div>

        <div className={styles.tileBody}>
          <div className={styles.tileHead}>
            <span className="label">{project.category.split(' / ')[0]}</span>
            <StatusBadge status={project.status} />
          </div>
          <h3 className={styles.tileTitle}>{project.title}</h3>
          <p className={styles.tileSummary}>{project.summary}</p>
          <div className={styles.tileFoot}>
            <div className="tag-list">
              {project.technologies.slice(0, 3).map((tech) => (
                <span key={tech} className="tag">
                  {tech}
                </span>
              ))}
            </div>
            <span className={styles.tileArrow} aria-hidden="true">
              <Icon name="arrow-up-right" size={18} />
            </span>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}
