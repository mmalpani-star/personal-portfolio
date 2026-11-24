import { contactLinks } from '@/data/site-data';
import styles from './Footer.module.css';

/** Only these four social profiles appear in Elsewhere. */
const SOCIAL_LABELS = new Set(['GitHub', 'LinkedIn', 'Instagram', 'Handshake']);

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`page-shell ${styles.inner}`}>
        <div className={styles.identity}>
          <span className={styles.name}>Madhav Malpani</span>
          <span className="label">AI × Robotics × Physical systems</span>
        </div>

        <nav className={styles.columns} aria-label="Footer">
          <div className={styles.column}>
            <span className={styles.heading}>Elsewhere</span>
            <div className={styles.iconRow}>
              {contactLinks
                .filter((link) => SOCIAL_LABELS.has(link.label))
                .map((link) => {
                  const src = `/images/logos/${link.label.toLowerCase()}.svg`;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      className={styles.iconLink}
                    >
                      <img
                        src={src}
                        alt={link.label}
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  );
                })}
            </div>
          </div>
        </nav>
      </div>
      <div className={`page-shell ${styles.base}`}>
        <span>© {new Date().getFullYear()} Madhav Malpani</span>
        <span>UC San Diego · B.S. Artificial Intelligence</span>
        <a href="#top" className={styles.top}>
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
