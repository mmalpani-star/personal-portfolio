import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MangaPanels } from '@/components/about/MangaPanels';
import { ReactorIntro } from '@/components/about/ReactorIntro';
import { Reveal } from '@/components/animation';
import { CollabSection } from '@/components/shared/CollabSection';
import { Magnetic } from '@/components/effects/Magnetic';
import { Icon } from '@/components/ui/Icon';
import { Typewriter } from '@/components/about/Typewriter';
import { InterestBuoys } from '@/components/about/InterestBuoys';
import { OceanZone } from '@/components/about/OceanZone';
import { aboutPanels, technicalInterests } from '@/data/site-data';
import styles from './About.module.css';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Madhav Malpani — robotics and AI student at UC San Diego. Builder, basketball captain, community organiser, and a long-running anime habit.',
};

/** Every model saved in public/models/about/crew/, in file-name order (name them 01-luffy.glb, 02-zoro.glb, ...). */
function crewModels() {
  const dir = path.join(process.cwd(), 'public', 'models', 'about', 'crew');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(glb|gltf)$/i.test(f))
    .sort()
    .map((f) => `/models/about/crew/${encodeURIComponent(f)}`);
}

function availableMedia() {
  return aboutPanels
    .flatMap((panel) => [panel.media?.src, ...(panel.images ?? []).map((image) => image.src)])
    .filter((src): src is string => Boolean(src) && existsSync(path.join(process.cwd(), 'public', src!)));
}

const INTEREST_CHIPS = [
  'Tesla FSD (Fully Self Driving)',
  "NVIDIA World Language Action (WLA) Research",
  'Neural Network',
  'Machine Learning',
  'Reinforcement Learning',
  'Computer Vision',
];

export default function AboutPage() {
  const media = availableMedia();

  return (
    <main>
      <ReactorIntro />

      <OceanZone crew={crewModels()}>
      {/* ---------- Opening ---------- */}
      <section className={`page-top ${styles.intro}`}>
        <div className={`page-shell ${styles.introGrid} ${styles.introCentered}`}>
          <div className={styles.introCopy}>
            <span className="label reveal-eager">About me</span>
            <Typewriter
              text="I am interested in consumer robots and want to make generalised robots to help humans with manual day to day chores."
              className={`${styles.typewriter} reveal-eager`}
            />
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
        </div>
      </section>

      {/* ---------- Interested about ---------- */}
      <section className={`section ${styles.method}`} aria-labelledby="method-title">
        <div className="page-shell">
          <Reveal className={styles.heading}>
            <span className="section-index">01</span>
            <h2 id="method-title">Interested about</h2>
          </Reveal>

          <InterestBuoys items={INTEREST_CHIPS} />
        </div>
      </section>
      </OceanZone>

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

      <CollabSection idPrefix="about-collab" />
    </main>
  );
}
