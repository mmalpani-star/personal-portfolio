import { contactLinks } from '@/data/site-data';
import styles from './Footer.module.css';

/** Official brand colours used on hover/focus. GitHub stays white (its black mark
   is invisible on dark). Instagram uses its gradient. */
const BRAND: Record<string, string> = {
  GitHub: '#fff',
  LinkedIn: '#0a66c2',
  Handshake: '#7c3aed',
  Instagram: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
};

/** Inline SVG mark per social label. Falls back to the link text when none exists. */
const IconMark: Record<string, JSX.Element> = {
  GitHub: (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.987 0-1.331.465-2.379 1.237-3.22-.137-.338-.677-1.371-1.13-1.646-.04-.125-.13-.529-.13-.529s-1.118-.299-2.235-.227c-2.448-.166-4.397 1.19-4.397 1.19-1.471.838-.749 1.808-.749 1.808 1.485.222 2.273 1.532 2.273 1.532 1.438 2.27 3.547 1.617 4.407 1.237.137-.781.289-1.625.49-2.392-2.167-.375-4.45-.982-4.45-4.389 0-.97.346-1.759.958-2.372-.157-.302-.361-1.292.07-1.787 0 0 .812-.262 2.665 1.053.816-.217 1.678-.326 2.555-.326.877 0 1.739.109 2.555.326 1.853-1.315 2.665-1.053 2.665-1.053.431.495.227 1.485.07 1.787.612.613.958 1.402.958 2.372 0 3.408-2.283 4.013-4.451 4.388.355.24.662.678.662 1.396v3.614c0 .316.194.69.794.577 4.87-1.587 8.207-6.086 8.207-11.387 0-6.627-5.374-12-12-12z" />
    </svg>
  ),
  LinkedIn: (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5.36v7.98h5.36v-9.02zm-5.36-1h-2.97v7.98h2.97v-7.98zM14.15 9v-.01c0-1.53-1.01-2.77-2.31-2.77-1.38 0-2.44 1.13-2.44 2.43v9.06h5.35v-6.02c0-.75.13-1.57.6-2.12.42-.5 1.1-.72 1.99-.72 1.42 0 1.96.79 1.96 1.67v5.79h5.35v-8.94c0-3.29-1.95-4.99-4.11-4.99z" />
    </svg>
  ),
  Instagram: (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="16.5" cy="7.5" r="1.5" />
    </svg>
  ),
  Handshake: (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 400 400"
      focusable="false"
    >
      <g transform="translate(0,400) scale(0.1,-0.1)">
        <path d="M1545 3178 c-3 -13 -50 -277 -104 -588 -88 -494 -168 -947 -285 -1608 l-32 -182 230 2 231 3 57 328 58 328 33 29 c119 104 432 350 435 342 2 -8 -148 -880 -174 -1005 l-6 -27 231 0 c127 0 231 2 231 4 0 3 45 261 101 573 256 1447 319 1806 319 1814 0 5 -101 9 -228 9 l-228 0 -37 -212 c-54 -313 -116 -660 -122 -684 -4 -18 -436 -382 -466 -392 -6 -2 -8 6 -5 20 3 12 53 293 111 623 58 330 107 610 110 623 l5 22 -230 0 -230 0 -5 -22z" />
      </g>
    </svg>
  ),
};

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
              {contactLinks.map((link) => {
                const mark = IconMark[link.label];
                const brand = BRAND[link.label];
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    className={`${styles.iconLink} ${styles[`${link.label}Link` as keyof typeof styles] || ''}`}
                    style={brand ? ({ '--brand': brand } as React.CSSProperties) : undefined}
                  >
                    {mark ?? link.label}
                  </a>
                );
              })}
            </div>
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
