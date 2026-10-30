import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/animation';
import { Magnetic, Tilt } from '@/components/effects';
import { Skills } from '@/components/home/Skills';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { currentlyBuilding, displayProjects, education, technicalInterests } from '@/data/site-data';
import styles from './About.module.css';

export const metadata: Metadata = {
  title: 'About',
  description: 'Undergraduate Artificial Intelligence student at UC San Diego focused on robotics, AI and physical systems.',
};

const applications = ['Warehouse automation', 'Search and rescue', 'Ocean exploration', 'Household automation', 'Industrial systems'];

export default function AboutPage() {
  const university = education[0];
  const builds = displayProjects.filter((project) => project.tier !== 'software').slice(0, 4);

  return (
    <main>
      <section className={`page-top ${styles.intro}`}>
        <div className={`page-shell ${styles.introGrid}`}>
          <div className={styles.introCopy}>
            <span className="label reveal-eager">About</span>
            <h1 className={`${styles.title} reveal-eager`} style={{ animationDelay: '0.06s' }}>
              Student engineer building physical systems.
            </h1>
            <p className={`${styles.lead} reveal-eager`} style={{ animationDelay: '0.12s' }}>
              I am an undergraduate student at UC San Diego pursuing a B.S. in Artificial Intelligence, with a strong
              interest in robotics, artificial intelligence, physical AI, and autonomous systems. I am interested in
              engineering systems that extend human capability and tackle dangerous, repetitive, difficult, or
              demanding work.
            </p>
            <div className={`cta-row reveal-eager`} style={{ animationDelay: '0.18s' }}>
              <Magnetic>
                <Link href="/#work" className="button button-primary">
                  See the work
                  <Icon name="arrow-right" size={15} />
                </Link>
              </Magnetic>
              <a href="/documents/resume.pdf" className="button button-secondary" target="_blank" rel="noopener noreferrer">
                Resume
                <Icon name="arrow-up-right" size={14} />
              </a>
            </div>
          </div>

          <div className="reveal-eager" style={{ animationDelay: '0.2s' }}>
          <Tilt max={3}>
            <dl className={`${styles.profile} spotlight`}>
              <div className={styles.profileHead}>
                <span className={styles.monogram} aria-hidden="true">
                  MM
                </span>
                <span>
                  <span className={styles.profileName}>Madhav Malpani</span>
                  <span className={styles.profileRole}>AI × Robotics × Hardware</span>
                </span>
              </div>
              <div>
                <dt>Program</dt>
                <dd>{university.degree}</dd>
              </div>
              <div>
                <dt>University</dt>
                <dd>{university.institution}</dd>
              </div>
              <div>
                <dt>Graduation</dt>
                <dd>Expected {university.expectedGraduation}</dd>
              </div>
              <div>
                <dt>Now</dt>
                <dd>
                  <span className={styles.live} aria-hidden="true" />
                  {currentlyBuilding.organization} — {currentlyBuilding.team}
                </dd>
              </div>
            </dl>
          </Tilt>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-shell">
          <div className={styles.philosophy}>
            <Reveal>
              <span className="label">Philosophy</span>
              <blockquote className={styles.quote}>
                Building robots that extend human capability.
                <span> One iteration at a time.</span>
              </blockquote>
            </Reveal>
            <Reveal delay={0.08} className={styles.philosophyBody}>
              <p>
                Some tasks are dangerous, repetitive, physically demanding, or simply not worth human time. I am
                interested in building systems that improve productivity without losing the human element at the
                center of the work.
              </p>
              <p>
                My work lives at the intersection of mechanical design, electronics, embedded systems, and intelligent
                control.
              </p>
              <ul className={styles.chips} aria-label="Applications I care about">
                {applications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className={styles.builds}>
            {builds.map((project, index) => (
              <Reveal key={project.slug} delay={index * 0.06}>
                <Link href={`/projects/${project.slug}`} className={styles.build}>
                  {project.heroMedia?.type === 'image' ? (
                    <Image src={project.heroMedia.src} alt={project.heroMedia.alt} fill sizes="(max-width: 760px) 50vw, 25vw" />
                  ) : null}
                  <span className={styles.buildLabel}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {project.shortTitle}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--raised">
        <div className="page-shell">
          <Reveal>
            <SectionHeading
              eyebrow="Education"
              title="Where I’m learning."
              description="Formal study alongside the projects — mathematics, physics, computer science and now AI."
            />
          </Reveal>
          <div className={styles.schools}>
            {education.map((item, index) => (
              <Reveal key={item.institution} delay={index * 0.08} className={`${styles.school} spotlight`}>
                <span className={styles.schoolDates}>
                  {item.expectedGraduation ? `Expected ${item.expectedGraduation}` : item.dates}
                </span>
                <h3>{item.institution}</h3>
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
      </section>

      <section className="section">
        <div className="page-shell">
          <Reveal>
            <SectionHeading eyebrow="Focus & tools" title="What I’m exploring, and what I use." />
          </Reveal>
          <ol className={styles.interests}>
            {technicalInterests.map((interest, index) => (
              <Reveal as="li" key={interest} delay={index * 0.04} className={styles.interest}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {interest}
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <Skills />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
