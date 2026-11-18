import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/animation';
import { PcbViewer } from '@/components/experience/PcbViewer';
import { CollabSection } from '@/components/shared/CollabSection';
import { Icon } from '@/components/ui/Icon';
import { experienceStory } from '@/data/experience-story';
import type { StoryEntry } from '@/data/experience-story';
import styles from './Experience.module.css';

const pad = (n: number) => String(n).padStart(2, '0');

/** A photo with its caption beneath: no frame, no card. */
function Figure({ src, alt, w, h, caption, sizes, className = '', priority = false }: { src: string; alt: string; w: number; h: number; caption?: string; sizes: string; className?: string; priority?: boolean }) {
  return (
    <figure className={`${styles.figure} ${className}`}>
      <Image src={src} alt={alt} width={w} height={h} sizes={sizes} quality={78} priority={priority} className={styles.img} />
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

/** The pictures and models for one entry. Each is arranged for what it shows, not poured into a grid. */
function Media({ entry }: { entry: StoryEntry }) {
  switch (entry.id) {
    case 'triton':
      return (
        <div className={styles.triton}>
          <Reveal className={styles.pcbMain}>
            <PcbViewer label="Interactive 3D model of the CAN FD transceiver breakout board. Drag to rotate." />
            <p className={styles.caption}>
              The finished CAN FD transceiver breakout board: the actual 3D model exported from EasyEDA (<code>PCB_caps_4</code>).
            </p>
          </Reveal>
          <Reveal className={styles.pcbViews} delay={0.06}>
            <Figure src="/images/experience/pcb/pcb-3d-2.jpg" alt="Top of the finished board in EasyEDA's 3D view: CAN connector, SOIC chip, capacitors and a five-pin header" w={820} h={770} caption="Top, in the 3D view" sizes="(max-width: 900px) 46vw, 300px" />
            <Figure src="/images/experience/pcb/pcb-3d-4.jpg" alt="Back of the finished board in EasyEDA's 3D view, with its bottom-layer artwork" w={820} h={770} caption="Back, in the 3D view" sizes="(max-width: 900px) 46vw, 300px" />
          </Reveal>

          <div className={styles.steps}>
            <Reveal className={styles.step}>
              <span className={styles.stepNo}>Week 1 &amp; 3</span>
              <h4 className={styles.stepTitle}>LM555 timer</h4>
              <div className={styles.stepMedia}>
                <Figure src="/images/experience/lm555.jpg" alt="LM555 timer circuit prototype on a perfboard" w={827} h={1536} sizes="(max-width: 900px) 40vw, 200px" className={styles.tall} />
                <video className={styles.video} controls muted playsInline preload="none" poster="/images/experience/lm555-demo-poster.jpg" aria-label="LM555 timer demonstration">
                  <source src="/videos/experience/lm555 demo.mp4" type="video/mp4" />
                </video>
              </div>
            </Reveal>
            <Reveal className={styles.step} delay={0.06}>
              <span className={styles.stepNo}>Capstone · V1 → V3</span>
              <h4 className={styles.stepTitle}>From first layout to final</h4>
              <div className={styles.stepMedia}>
                <Figure src="/images/experience/caps_1.png" alt="CAN FD breakout board PCB Version 1 layout" w={1064} h={1128} caption="PCB V1" sizes="(max-width: 900px) 40vw, 200px" />
                <span className={styles.arrow} aria-hidden="true"><Icon name="arrow-right" size={20} /></span>
                <Figure src="/images/experience/caps_3.png" alt="CAN FD breakout board PCB Version 3 layout" w={498} h={792} caption="PCB V3" sizes="(max-width: 900px) 40vw, 200px" />
              </div>
            </Reveal>
          </div>
        </div>
      );
    case 'starlabs':
      return (
        <Reveal className={styles.starlabs}>
          <Figure src="/images/experience/starlabs-team.jpeg" alt="The StarLabs team standing in front of a rocket" w={2048} h={1152} caption="The StarLabs team" sizes="(max-width: 900px) 92vw, 640px" className={styles.starTeam} />
          <Figure src="/images/experience/starlabs-all-teams.jpeg" alt="All the StarLabs teams together in the workshop, holding a rocket body" w={1280} h={960} caption="All the teams" sizes="(max-width: 900px) 60vw, 360px" className={styles.starAll} />
        </Reveal>
      );
    case 'sandhacks':
      return (
        <Reveal>
          <Figure src="/images/experience/sand-hacks-team.jpg" alt="The Sitwise team at SanD Hacks in front of the winners' slide" w={2524} h={1684} caption="The Sitwise team at SanD Hacks" sizes="(max-width: 900px) 92vw, 760px" />
        </Reveal>
      );
    case 'borderpulse':
      return (
        <Reveal className={styles.bp}>
          <Figure src="/images/projects/borderpulse/borderpulse-presentation-wide.jpeg" alt="The BorderPulse team presenting on the cOmpiled-16 stage" w={2000} h={1333} caption="Presenting BorderPulse on the cOmpiled-16 stage" sizes="(max-width: 900px) 92vw, 760px" className={styles.bpMain} />
          <div className={styles.pair}>
            <Figure src="/images/projects/borderpulse/borderpulse-demo-poster.jpg" alt="BorderPulse project demonstration" w={1600} h={900} caption="The demo" sizes="(max-width: 900px) 92vw, 380px" />
            <Figure src="/images/projects/borderpulse/borderpulse-demo-walkthrough.jpeg" alt="The BorderPulse product walkthrough projected during the hackathon" w={2000} h={1333} caption="Product walkthrough" sizes="(max-width: 900px) 92vw, 380px" />
          </div>
        </Reveal>
      );
    case 'iitk':
      return (
        <Reveal>
          <Figure src="/images/experience/iitk-python-ai-ml-certificate.jpg" alt="IIT Kanpur certificate for the Certification Program on Python for Artificial Intelligence, Machine Learning, and Deep Learning" w={1400} h={939} caption="Python for AI, ML & Deep Learning certificate" sizes="(max-width: 900px) 92vw, 560px" />
        </Reveal>
      );
  }
}

function Entry({ entry, index }: { entry: StoryEntry; index: number }) {
  return (
    <article className={styles.entry} aria-labelledby={`exp-${entry.id}`}>
      <header className={styles.rail}>
        <Reveal>
          <span className={styles.no}>{pad(index + 1)}</span>
          {entry.dates ? (
            <span className={styles.dates}>
              {entry.current ? <span className={styles.live} aria-hidden="true" /> : null}
              {entry.dates}
            </span>
          ) : null}
          <h3 id={`exp-${entry.id}`} className={styles.title}>
            {entry.title}
          </h3>
          <p className={styles.org}>
            {entry.organization}
            {entry.descriptor ? <span> · {entry.descriptor}</span> : null}
          </p>
        </Reveal>
      </header>

      <div className={styles.body}>
        <Reveal>
          <p className={styles.intro}>{entry.intro}</p>
        </Reveal>

        {entry.achievement ? (
          <Reveal>
            <p className={styles.win}>
              <span className={styles.winMark} aria-hidden="true" />
              {entry.achievement}
            </p>
          </Reveal>
        ) : null}

        <Media entry={entry} />

        <div className={styles.text}>
          <Reveal>
            <h4 className={styles.label}>{entry.project ? 'My part' : 'What I did'}</h4>
            <ol className={styles.points}>
              {entry.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          </Reveal>
          {entry.project ? (
            <Reveal delay={0.05}>
              <h4 className={styles.label}>{entry.project.heading}</h4>
              <ul className={styles.points}>
                {entry.project.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Reveal>
          ) : null}
        </div>

        {entry.links?.length ? (
          <Reveal>
            <ul className={styles.links}>
              {entry.links.map((link) => (
                <li key={link.href}>
                  {link.internal ? (
                    <Link href={link.href} className={styles.link}>
                      {link.label}
                      <Icon name="arrow-right" size={13} />
                    </Link>
                  ) : (
                    <a href={link.href} className={styles.link} target="_blank" rel="noreferrer">
                      {link.label}
                      <Icon name="arrow-up-right" size={13} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Experience as an editorial timeline: each entry has a rail (role, organization, dates) and a story beside it
 * (introduction, what I did, then the pictures, models and links that belong to it). Nothing expands or hides.
 */
export function Experience() {
  return (
    <section id="experience" className={`section ${styles.section}`} aria-labelledby="experience-title">
      <div className="page-shell">
        <Reveal className={styles.heading}>
          <span className="section-index">01</span>
          <h2 id="experience-title">Experience</h2>
          <p>Teams, internships and hackathons, with the boards, models and photos that go with them.</p>
        </Reveal>

        {experienceStory.map((entry, index) => (
          <Entry key={entry.id} entry={entry} index={index} />
        ))}
      </div>

      <CollabSection idPrefix="experience-collab" />
    </section>
  );
}
