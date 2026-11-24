'use client';

import { projects } from '@/data/site-data';
import { CubesatShowcase } from '@/components/projects/CubesatShowcase';
import { Reveal } from '@/components/animation';
import styles from './ModelSection.module.css';

const project = projects.find((p) => p.slug === 'cubesat-antenna-mechanism');

export function CubeSatSection() {
  if (!project) return null;

  return (
    <section id="cubesat" className={styles.section}>
      <div className={styles.inner}>
        <Reveal className={styles.heading}>
          <span className={styles.eyebrow}>01 — CubeSat</span>
          <h2 className={styles.title}>{project.title}</h2>
        </Reveal>

        <div className={styles.canvasWrapper}>
          <CubesatShowcase project={project} index={1} total={1} />
        </div>

        <p className={styles.description}>{project.summary}</p>
      </div>
    </section>
  );
}
