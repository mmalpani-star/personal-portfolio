import { Reveal } from '@/components/animation';
import { Magnetic } from '@/components/effects/Magnetic';
import { Icon } from '@/components/ui/Icon';
import { contactLinks } from '@/data/site-data';
import styles from './Contact.module.css';

/** LinkedIn and the resume lead; the other profiles follow as secondary links. */
export function Contact() {
  const linkedIn = contactLinks.find((link) => link.label === 'LinkedIn');
  const secondary = contactLinks.filter((link) => link.label !== 'LinkedIn');

  return (
    <section id="contact" className={`section ${styles.section}`} aria-labelledby="contact-title">
      <div className={`page-shell ${styles.inner}`}>
        <div className={styles.lead}>
          <Reveal>
            <span className="section-index">04</span>
            <h2 id="contact-title" className={styles.title}>
              Let’s build something useful.
            </h2>
          </Reveal>
        </div>

        <Reveal className={styles.actions} delay={0.08}>
          <p className={styles.copy}>
            Open to robotics research, internships and hardware projects. LinkedIn is the fastest way to reach me.
          </p>
          <div className="cta-row">
            {linkedIn ? (
              <Magnetic>
                <a href={linkedIn.href} className="button button-primary" target="_blank" rel="noreferrer">
                  Message me on LinkedIn
                  <Icon name="arrow-up-right" size={14} />
                </a>
              </Magnetic>
            ) : null}
            <a href="/documents/resume.pdf" className="button button-secondary" target="_blank" rel="noopener noreferrer">
              <Icon name="document" size={15} />
              Resume (PDF)
            </a>
          </div>
          <ul className={styles.links}>
            {secondary.map((link) => (
              <li key={link.label}>
                <a href={link.href} className={styles.link} target="_blank" rel="noreferrer">
                  {link.label}
                  <Icon name="arrow-up-right" size={13} />
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* The same Tony Stark clip as the Contact tag on the hanger, set as a paper tag of its own. */}
        <Reveal className={styles.figure} delay={0.16}>
          <figure className={styles.tag}>
            <div className={styles.tagBar} aria-hidden="true">
              <span>04 / 04</span>
              <span className={styles.tagMark}>MM</span>
            </div>
            <picture>
              {/* Reduced motion gets the clip's first frame; everyone else gets the animation as-is. */}
              <source media="(prefers-reduced-motion: reduce)" srcSet="/images/about/tony-stark-still.jpg" />
              {/* eslint-disable-next-line @next/next/no-img-element -- an animated GIF must bypass the image optimiser */}
              <img
                className={styles.tagImg}
                src="/images/about/tony-stark.gif"
                width={480}
                height={480}
                alt="Tony Stark in his workshop"
                loading="lazy"
                decoding="async"
              />
            </picture>
            <figcaption className={styles.tagLabel}>Contact</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
