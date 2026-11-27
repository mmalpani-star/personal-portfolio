'use client';

import { useSyncExternalStore } from 'react';
import { getServerTheme, getTheme, setTheme, subscribeTheme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';

/** Sliding light/dark switch. The knob carries the icon of the theme that is on. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`${styles.toggle} ${className ?? ''}`}
      data-theme-state={theme}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <span className={styles.track} aria-hidden="true">
        <svg className={`${styles.icon} ${styles.sunGhost}`} viewBox="0 0 24 24" width="14" height="14">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg className={`${styles.icon} ${styles.moonGhost}`} viewBox="0 0 24 24" width="14" height="14">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
        <span className={styles.knob}>
          <svg className={`${styles.icon} ${styles.sun}`} viewBox="0 0 24 24" width="14" height="14">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg className={`${styles.icon} ${styles.moon}`} viewBox="0 0 24 24" width="14" height="14">
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
