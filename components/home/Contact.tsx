import { Reveal } from '@/components/animation';
import { Magnetic } from '@/components/effects';
import { Icon } from '@/components/ui/Icon';
import { contactLinks } from '@/data/site-data';
import styles from './Contact.module.css';

const descriptions: Record<string, string> = {
  GitHub: 'Code for the quadruped, air-quality monitor and more',
  LinkedIn: 'Background, experience and updates',
  Handshake: 'UC San Diego student profile',
};

export function Contact() {
  return (
    <section id="contact" className={`section ${styles.section}`} aria-labelledby="contact-title">
      <div className={`page-shell ${styles.inner}`}>
        <div className={styles.lead}>
          <Reveal>
            <span className="label">05 — Contact</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="contact-title" className={styles.title}>
              Let’s build something useful.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={styles.copy}>
              I’m interested in robotics, AI, embedded systems, and physical engineering work that creates real
              utility. If you’re working on something in that space, I’d like to hear about it.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <Magnetic>
              <a href="/documents/resume.pdf" className="button button-primary" target="_blank" rel="noopener noreferrer">
                <Icon name="document" size={15} />
                Download resume
              </a>
            </Magnetic>
          </Reveal>
        </div>

        <ul className={styles.links}>
          {contactLinks.map((link, index) => (
            <Reveal as="li" key={link.label} delay={0.08 * index}>
              <a href={link.href} className={`${styles.link} spotlight`} target="_blank" rel="noreferrer">
                <span className={styles.linkIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.linkText}>
                  <span className={styles.linkLabel}>{link.label}</span>
                  {descriptions[link.label] ? (
                    <span className={styles.linkDescription}>{descriptions[link.label]}</span>
                  ) : null}
                </span>
                <span className={styles.linkArrow} aria-hidden="true">
                  <Icon name="arrow-up-right" size={20} />
                </span>
              </a>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
