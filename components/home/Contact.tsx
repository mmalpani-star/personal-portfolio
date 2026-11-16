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
      </div>
    </section>
  );
}
