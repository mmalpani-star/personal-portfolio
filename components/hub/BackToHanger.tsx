import Link from 'next/link';
import styles from './BackToHanger.module.css';

/**
 * Small, fixed, always available inside every section. It is only a link to `/`, which is what
 * the hanger hub listens for, so the browser's own back and forward buttons agree with it.
 * `scroll={false}` keeps the section you were reading in place behind the dissolve into the hanger.
 * Hidden by CSS whenever the hanger itself is showing.
 */
export function BackToHanger() {
  return (
    <Link href="/" className={`glass-button ${styles.back}`} prefetch={false} scroll={false} aria-label="Back to Hanger">
      <span aria-hidden="true">←</span>
      <svg className={styles.glyph} width="16" height="14" viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 3a3.5 3.5 0 1 1 3.5 3.5c-1.9 0-3.5 1.4-3.5 3.2v1.3" />
        <path d="M16 11L3 22.5c-.9.8-.3 2.5 1 2.5h24c1.3 0 1.9-1.7 1-2.5L16 11z" />
      </svg>
      <span>Back to Hanger</span>
    </Link>
  );
}
