import { Reveal } from '@/components/animation';
import { CollabSection } from '@/components/shared/CollabSection';
import { SideEnter } from '@/components/projects/SideEnter';
import { CubesatShowcase } from '@/components/projects/CubesatShowcase';
import {
  AqmShowcase,
  HexapodShowcase,
  HydroSafeShowcase,
  PhotoShowcase,
  QuadrupedShowcase,
} from '@/components/projects/ModelShowcase';
import { displayProjects } from '@/data/site-data';
import type { Project } from '@/data/site-data';
import styles from './Projects.module.css';

type ShowcaseProps = { project: Project; index: number; total: number };

const scenes: Record<string, (props: ShowcaseProps) => JSX.Element> = {
  'quadruped-leg-kinematics': QuadrupedShowcase,
  hexapod: HexapodShowcase,
  'air-quality-monitor': AqmShowcase,
  hydrosafe: HydroSafeShowcase,
  'cubesat-antenna-mechanism': CubesatShowcase,
};

const rows: { slug: string; from: 'left' | 'right' }[][] = [
  [
    { slug: 'quadruped-leg-kinematics', from: 'right' },
    { slug: 'hexapod', from: 'left' },
  ],
  [
    { slug: 'tritonspend-ai', from: 'left' },
    { slug: 'borderpulse', from: 'right' },
  ],
  [
    { slug: 'hydrosafe', from: 'right' },
    { slug: 'air-quality-monitor', from: 'left' },
  ],
];

const bySlug = new Map(displayProjects.map((p) => [p.slug, p]));

export function Projects() {
  const total = displayProjects.length;
  let n = 0;
  const cubesat = bySlug.get('cubesat-antenna-mechanism');
  return (
    <section id="projects" className={`section ${styles.section}`} aria-labelledby="projects-title">
      <div className={styles.stars} aria-hidden="true" />
      <div className="page-shell">
        <Reveal className={styles.heading}>
          <span className="section-index">02</span>
          <h2 id="projects-title">Projects</h2>
          <p>Robots, boards and apps I designed, built and broke.</p>
        </Reveal>

        <div className={styles.rows}>
          {rows.map((row, r) => (
            <div key={r} className={styles.row} data-row={r + 1}>
              {row.map(({ slug, from }) => {
                const project = bySlug.get(slug);
                if (!project) return null;
                const Scene = scenes[slug] ?? PhotoShowcase;
                n += 1;
                return (
                  <SideEnter key={slug} side={from} slug={slug}>
                    <Scene project={project} index={n} total={total} />
                  </SideEnter>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {cubesat ? <CubesatShowcase project={cubesat} index={total} total={total} /> : null}

      <CollabSection idPrefix="projects-collab" />
    </section>
  );
}
