import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/animation';
import { AqmShowcase, HexapodShowcase } from '@/components/projects/ModelShowcase';
import { Viewfinder } from '@/components/effects/Viewfinder';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { displayProjects } from '@/data/site-data';
import type { Project } from '@/data/site-data';
import styles from './Projects.module.css';

function ProjectCard({ project, index, feature }: { project: Project; index: number; feature: boolean }) {
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;

  return (
    <Reveal
      as="article"
      className={`${styles.card} ${feature ? styles.cardFeature : ''}`}
      delay={feature ? 0 : (index % 2) * 0.06}
    >
      <Link href={`/projects/${project.slug}`} className={`${styles.link} vf-host`}>
        <div className={styles.media}>
          {hero ? (
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              sizes={feature ? '(max-width: 960px) 100vw, 1200px' : '(max-width: 960px) 100vw, 50vw'}
              quality={feature ? 70 : 72}
              className={`${styles.image} vf-target`}
            />
          ) : null}
          <Viewfinder brackets={false} />
          <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
        </div>

        <div className={`${styles.body} glass`}>
          <div className={styles.head}>
            <span className="label">{project.category.split(' / ')[0]}</span>
            <StatusBadge status={project.status} />
          </div>
          <h3 className={styles.title}>{project.title}</h3>
          <p className={styles.teaser}>{project.teaser}</p>
          <div className={styles.foot}>
            <div className="tag-list">
              {project.chips.map((chip) => (
                <span key={chip} className="tag">
                  {chip}
                </span>
              ))}
            </div>
            <span className={styles.cta}>
              Case study
              <Icon name="arrow-right" size={14} />
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

export function Projects() {
  const hexapod = displayProjects.find((p) => p.slug === 'hexapod');
  const airQuality = displayProjects.find((p) => p.slug === 'air-quality-monitor');
  return (
    <section id="projects" className={`section ${styles.section}`} aria-labelledby="projects-title">
      <div className="page-shell">
        <Reveal className={styles.heading}>
          <span className="section-index">02</span>
          <h2 id="projects-title">Projects</h2>
          <p>Robots, boards and apps I designed, built and broke.</p>
        </Reveal>
      </div>

      {/* Interactive CAD scenes for the two projects that have full 3D models */}
      {hexapod ? <HexapodShowcase project={hexapod} /> : null}
      {airQuality ? <AqmShowcase project={airQuality} /> : null}

      <div className="page-shell">
        <Reveal className={styles.gridHeading}>
          <span className="label">All projects</span>
        </Reveal>
        <div className={styles.grid}>
          {displayProjects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} feature={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
