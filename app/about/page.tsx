import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MangaPanels } from '@/components/about/MangaPanels';
import { ReactorIntro } from '@/components/about/ReactorIntro';
import { Reveal } from '@/components/animation';
import { Magnetic } from '@/components/effects/Magnetic';
import { Icon } from '@/components/ui/Icon';
import { aboutPanels, currentlyBuilding, education, technicalInterests } from '@/data/site-data';
import styles from './About.module.css';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Madhav Malpani — robotics and AI student at UC San Diego. Builder, basketball captain, community organiser, and a long-running anime habit.',
};

const loop = [
  { title: 'Understand', detail: 'Take the system apart: mechanics, electronics, control.' },
  { title: 'Prototype', detail: 'Build a physical version, however rough.' },
  { title: 'Experiment', detail: 'Run it, measure it, find where it breaks.' },
  { title: 'Iterate', detail: 'Fix, rebuild, go around again.' },
];

/**
 * Panel media is dropped into `public/` by hand and may not be there yet, so the
 * page resolves which files actually exist at build time. Anything missing is
 * never requested, which keeps the console and the network panel clean.
 */
function availableMedia() {
  return aboutPanels
    .map((panel) => panel.media?.src)
    .filter((src): src is string => Boolean(src) && existsSync(path.join(process.cwd(), 'public', src!)));
}

export default function AboutPage() {
  const university = education[0];
  const media = availableMedia();

  return (
    <main>
      <ReactorIntro />

      {/* ---------- Opening ---------- */}
      <section className={`page-top ${styles.intro}`}>
        <div className={`page-shell ${styles.introGrid}`}>
          <div className={styles.introCopy}>
            <span className="label reveal-eager">About me</span>
            <h1 className={`${styles.title} reveal-eager`} style={{ animationDelay: '0.06s' }}>
              I build things, then find out where they break.
            </h1>
            <p className={`${styles.lead} reveal-eager`} style={{ animationDelay: '0.12s' }}>
              Robots are the part of me that shows up on a résumé. The rest is a basketball captain who started a
              pickleball community, films everything, argues about anime arcs, and blames every lost round on ping.
            </p>
            <div className="cta-row reveal-eager" style={{ animationDelay: '0.18s' }}>
              <Magnetic>
                <Link href="/#projects" className="button button-primary">
                  See the work
                  <Icon name="arrow-right" size={15} />
                </Link>
              </Magnetic>
              <a
                href="/documents/resume.pdf"
                className="button button-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resume
                <Icon name="arrow-up-right" size={14} />
              </a>
            </div>
          </div>

          <div className={`${styles.profile} glass reveal-eager`} style={{ animationDelay: '0.2s' }}>
            <div className={styles.profileHead}>
              <span className={styles.monogram} aria-hidden="true">
                MM
              </span>
              <span>
                <span className={styles.profileName}>Madhav Malpani</span>
                <span className={styles.profileRole}>AI · Robotics · Hardware</span>
              </span>
            </div>
            <dl className={styles.profileRows}>
              <div>
                <dt>Studying</dt>
                <dd>{university.degree}</dd>
              </div>
              <div>
                <dt>At</dt>
                <dd>{university.institution}</dd>
              </div>
              <div>
                <dt>Graduating</dt>
                <dd>{university.expectedGraduation}</dd>
              </div>
              <div>
                <dt>Now</dt>
                <dd>{currentlyBuilding.organization}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- How I work ---------- */}
      <section className={`section ${styles.method}`} aria-labelledby="method-title">
        <div className="page-shell">
          <Reveal className={styles.heading}>
            <span className="section-index">01</span>
            <h2 id="method-title">How I work</h2>
            <p>Four steps, repeated until the thing actually runs.</p>
          </Reveal>

          <ol className={styles.stages}>
            {loop.map((stage, index) => (
              <Reveal as="li" key={stage.title} className={styles.stage} delay={index * 0.07}>
                <span className={styles.stageIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.stageTitle}>{stage.title}</span>
                <span className={styles.stageDetail}>{stage.detail}</span>
              </Reveal>
            ))}
          </ol>

          <Reveal className={styles.interests}>
            <span className="label">Currently curious about</span>
            <ul className="tag-list">
              {technicalInterests.map((interest) => (
                <li key={interest} className="tag">
                  {interest}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ---------- Off the clock ---------- */}
      <MangaPanels availableMedia={media} />

      {/* ---------- Close ---------- */}
      <section className={`section ${styles.close}`}>
        <div className={`page-shell ${styles.closeInner}`}>
          <Reveal>
            <h2 className={styles.closeTitle}>That is the whole of it.</h2>
          </Reveal>
          <Reveal delay={0.08} className="cta-row">
            <Magnetic>
              <Link href="/#contact" className="button button-primary">
                Get in touch
                <Icon name="arrow-right" size={15} />
              </Link>
            </Magnetic>
            <Link href="/#projects" className="button button-secondary">
              Back to the work
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
