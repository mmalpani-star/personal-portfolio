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

/**
 * One showcase per project, in presentation order. Projects with a CAD model
 * get a scroll-driven 3D scene; the rest use their project photo in the same
 * format. Each project appears exactly once.
 */
const scenes: Record<string, (props: ShowcaseProps) => JSX.Element> = {
  'quadruped-leg-kinematics': QuadrupedShowcase,
  hexapod: HexapodShowcase,
  'air-quality-monitor': AqmShowcase,
  hydrosafe: HydroSafeShowcase,
  'cubesat-antenna-mechanism': CubesatShowcase,
};

/**
 * Three rows of two. The side each tile slides in from is set by the brief, not by its column: row one's quadruped
 * comes from the right and the hexapod from the left, row two's TritonSpend from the left and BorderPulse from the
 * right, row three's HydroSafe from the right and the air quality monitor from the left. The CubeSat follows, untouched.
 */
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
