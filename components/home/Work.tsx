import { Reveal } from '@/components/animation';
import { SectionHeading } from '@/components/ui';
import { displayProjects } from '@/data/site-data';
import { FlagshipProject } from './FlagshipProject';
import { ProjectTile } from './ProjectTile';
import { SoftwareProject } from './SoftwareProject';
import styles from './Work.module.css';

const pad = (value: number) => String(value).padStart(2, '0');

export function Work() {
  const numbered = displayProjects.map((project, index) => ({ project, number: pad(index + 1) }));
  const flagship = numbered.filter(({ project }) => project.tier === 'flagship');
  const hardware = numbered.filter(({ project }) => project.tier === 'hardware');
  const software = numbered.filter(({ project }) => project.tier === 'software');

  return (
    <section id="work" className={`section ${styles.section}`} aria-labelledby="work-title">
      <div className="page-shell">
        <Reveal>
          <SectionHeading
            eyebrow="02 — Selected work"
            title={<span id="work-title">Systems I’ve built and explored.</span>}
            description="Legged robots, space hardware, embedded sensing and physical prototypes — hands-on builds at every stage, from first assembly to completed prototype."
          />
        </Reveal>

        <div className={`${styles.tierHead} ${styles.tierHeadFirst}`}>
          <span className="label">Robotics</span>
          <span className={styles.tierCount}>{pad(flagship.length)} flagship builds</span>
        </div>
        <div className={styles.flagships}>
          {flagship.map(({ project, number }, index) => (
            <FlagshipProject key={project.slug} project={project} number={number} reverse={index % 2 === 1} />
          ))}
        </div>

        <div className={styles.tierHead}>
          <span className="label">Hardware & prototypes</span>
          <span className={styles.tierCount}>{pad(hardware.length)} projects</span>
        </div>
        <div className={styles.tiles}>
          {hardware.map(({ project, number }, index) => (
            <ProjectTile key={project.slug} project={project} number={number} large={index === 0} />
          ))}
        </div>

        {software.length ? (
          <>
            <div className={styles.tierHead}>
              <span className="label">Software & hackathons</span>
              <span className={styles.tierCount}>{pad(software.length)} project</span>
            </div>
            {software.map(({ project, number }) => (
              <Reveal key={project.slug}>
                <SoftwareProject project={project} number={number} />
              </Reveal>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
