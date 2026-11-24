'use client';

import { useMotionValueEvent, useScroll } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { BackToHanger } from '@/components/hub/BackToHanger';
import { Icon } from '@/components/ui/Icon';
import styles from './Navbar.module.css';

/**
 * Brand, a way back to the hanger, and the résumé. There is deliberately no section selector here:
 * the landing hanger is the only way to choose a section, so inside one you read it, then go back.
 */
export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 24));

  return (
    <header className={styles.header} data-scrolled={scrolled}>
      <div className={`page-shell ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.monogram} aria-hidden="true">
            MM
          </span>
          <span className={styles.brandName}>Madhav Malpani</span>
        </Link>

        <div className={styles.back}>
          <BackToHanger />
        </div>

        <div className={styles.actions}>
          <a className={`glass-button ${styles.resume}`} href="/documents/resume.pdf" target="_blank" rel="noopener noreferrer">
            Resume
            <Icon name="arrow-up-right" size={14} />
          </a>
        </div>
      </div>
    </header>
  );
}
