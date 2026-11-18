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

export function Projects() {
  const total = displayProjects.length;
  return (
    <section id="projects" className={`section ${styles.section}`} aria-labelledby="projects-title">
      <div className="page-shell">
        <Reveal className={styles.heading}>
          <span className="section-index">02</span>
          <h2 id="projects-title">Projects</h2>
          <p>Robots, boards and apps I designed, built and broke.</p>
        </Reveal>
      </div>

      {(() => {
        let side = 0; // alternates across the showcases that slide in; the CubeSat is left exactly as it was
        return displayProjects.map((project, i) => {
          const Scene = scenes[project.slug] ?? PhotoShowcase;
          const node = <Scene key={project.slug} project={project} index={i + 1} total={total} />;
          if (project.slug === 'cubesat-antenna-mechanism') return node;
          const dir = side++ % 2 === 0 ? 'left' : 'right';
          return (
            <SideEnter key={project.slug} side={dir}>
              {node}
            </SideEnter>
          );
        });
      })()}

      <CollabSection idPrefix="projects-collab" />
    </section>
  );
}
