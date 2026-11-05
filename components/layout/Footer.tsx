import Link from 'next/link';
import { contactLinks } from '@/data/site-data';
import styles from './Footer.module.css';

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
            <span className={styles.heading}>Site</span>
            <Link href="/#work">Work</Link>
            <Link href="/#experience">Experience</Link>
            <Link href="/about">About</Link>
            <Link href="/#contact">Contact</Link>
          </div>
          <div className={styles.column}>
            <span className={styles.heading}>Elsewhere</span>
            {contactLinks.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
            <a href="/documents/resume.pdf" target="_blank" rel="noopener noreferrer">
              Resume
            </a>
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
