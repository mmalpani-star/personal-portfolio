import Image from 'next/image';
import { Reveal } from '@/components/animation';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { currentlyBuilding, education, experience } from '@/data/site-data';
import type { Experience as ExperienceItem } from '@/data/site-data';
import { IterationStrip } from './IterationStrip';
import styles from './Experience.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sort key from the start of a "Mon YYYY – …" range. */
function startKey(item: ExperienceItem) {
  const [month, year] = (item.dates ?? '').split(' ');
  return Number(year) * 12 + Math.max(0, months.indexOf(month));
}

export function Experience() {
  const sorted = [...experience].sort((a, b) => startKey(b) - startKey(a));
  const current = sorted.find((item) => item.isCurrent);
  const timeline = sorted.filter((item) => item !== current);

  return (
    <section id="experience" className={`section section--raised ${styles.section}`} aria-labelledby="experience-title">
      <div className="page-shell">
        <Reveal>
          <SectionHeading
            eyebrow="03 — Experience"
            title={<span id="experience-title">Where I’ve been building.</span>}
            description="Robotics teams, internships, training programs and community work — newest first."
          />
        </Reveal>

        {current ? (
          <Reveal>
            <article className={`${styles.current} spotlight`} aria-labelledby="current-title">
              <div className={styles.currentInfo}>
                <div className={styles.currentTop}>
                  <StatusBadge status={currentlyBuilding.status} />
                  <span className={styles.dates}>{current.dates}</span>
                </div>
                <h3 id="current-title" className={styles.currentTitle}>
                  {current.organization}
                </h3>
                <p className={styles.role}>
                  {current.title} · {current.location}
                </p>
                <p className={styles.currentDescription}>{currentlyBuilding.description}</p>
                {current.details ? (
                  <ul className={styles.checklist}>
                    {current.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className={styles.currentMedia}>
                <span className="label">Iteration log</span>
                <IterationStrip images={current.images} videos={current.videos} />
              </div>
            </article>
          </Reveal>
        ) : null}

        <ol className={styles.timeline}>
          {timeline.map((item, index) => (
            <Reveal as="li" key={`${item.organization}-${item.title}`} className={styles.entry} delay={index * 0.05}>
              <div className={styles.rail}>
                <span className={styles.node} aria-hidden="true" />
                <span className={styles.dates}>{item.dates}</span>
              </div>
              <div className={styles.entryHead}>
                <h3 className={styles.entryTitle}>{item.title}</h3>
                <p className={styles.entryOrg}>{item.organization}</p>
                {item.socialLink ? (
                  <a href={item.socialLink.href} className={styles.social} target="_blank" rel="noreferrer">
                    {item.socialLink.label}
                    <Icon name="arrow-up-right" size={13} />
                  </a>
                ) : null}
              </div>
              <div className={styles.entryBody}>
                {item.details ? (
                  <ul>
                    {item.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {item.images?.length ? (
                <div className={styles.entryMedia}>
                  {item.images.map((image) => (
                    <figure key={image.src} className={styles.entryFigure}>
                      <Image
                        src={image.src}
                        alt={image.alt}
                        width={image.width}
                        height={image.height}
                        sizes="160px"
                      />
                      {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : null}
            </Reveal>
          ))}
        </ol>

        <div className={styles.education}>
          <div className={styles.educationHead}>
            <span className="label">Education</span>
          </div>
          <div className={styles.educationGrid}>
            {education.map((item) => (
              <Reveal key={item.institution} className={styles.school}>
                <span className={styles.dates}>{item.expectedGraduation ? `Expected ${item.expectedGraduation}` : item.dates}</span>
                <h3 className={styles.schoolName}>{item.institution}</h3>
                <p className={styles.schoolDegree}>{item.degree}</p>
                {item.details ? (
                  <ul>
                    {item.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
