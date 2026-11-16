import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/animation';
import { Viewfinder } from '@/components/effects';
import { ArcHeading } from '@/components/ui/ArcHeading';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { displayProjects } from '@/data/site-data';
import type { Project } from '@/data/site-data';
import styles from './Work.module.css';

function MissionCard({ project, index }: { project: Project; index: number }) {
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;
  const lead = index === 0;

  return (
    <Reveal as="article" className={`${styles.mission} ${lead ? styles.missionLead : ''}`} delay={index * 0.08}>
      <Link
        href={`/projects/${project.slug}`}
        className={`${styles.card} spotlight vf-host`}
        aria-labelledby={`${project.slug}-title`}
      >
        <div className={styles.media}>
          {hero ? (
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              sizes="(max-width: 960px) 100vw, 50vw"
              className={`${styles.image} vf-target`}
            />
          ) : null}
          <Viewfinder />
          <span className={styles.index}>M.{String(index + 1).padStart(2, '0')}</span>
        </div>

        <div className={styles.body}>
          <div className={styles.head}>
            <span className="label">{project.category}</span>
            <StatusBadge status={project.status} />
          </div>
          <h3 id={`${project.slug}-title`} className={styles.title}>
            {project.title}
          </h3>
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

export function Work() {
  const flagship = displayProjects.filter((project) => project.tier === 'flagship');

  return (
    <section id="work" className={`section ${styles.section}`} aria-labelledby="work-title">
      <div className="page-shell">
        <Reveal>
          <ArcHeading
            arc="01"
            id="work-title"
            title="Flagship Missions"
            description="Two legged robots and one live app. Open any of them for the full case study."
          />
        </Reveal>

        <div className={styles.missions}>
          {flagship.map((project, index) => (
            <MissionCard key={project.slug} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
