'use client';

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import styles from './Navbar.module.css';

const links = [
  { href: '/#work', id: 'work', label: 'Work' },
  { href: '/#experience', id: 'experience', label: 'Experience' },
  { href: '/about', id: 'about', label: 'About' },
  { href: '/#contact', id: 'contact', label: 'Contact' },
];

export function Navbar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 24));

  // Track the homepage section in view (one observer, no scroll handlers).
  useEffect(() => {
    if (pathname !== '/') {
      setActive(pathname.startsWith('/about') ? 'about' : pathname.startsWith('/projects') ? 'work' : null);
      return;
    }
    const tracked = new Set(links.map((link) => link.id));
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(tracked.has(entry.target.id) ? entry.target.id : null);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  // Mobile menu: lock scroll, close on Escape, restore focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const toggle = toggleRef.current;
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      toggle?.focus();
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={styles.header} data-scrolled={scrolled || open}>
      <div className={`page-shell ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="Madhav Malpani — home">
          <span className={styles.monogram} aria-hidden="true">
            MM
          </span>
          <span className={styles.brandName}>Madhav Malpani</span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={styles.link}
              aria-current={active === link.id ? 'true' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <a className={`button button-secondary ${styles.resume}`} href="/documents/resume.pdf" target="_blank" rel="noopener noreferrer">
            Resume
            <Icon name="arrow-up-right" size={14} />
          </a>
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className={styles.sheet}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <nav aria-label="Mobile navigation" className={`page-shell ${styles.sheetNav}`}>
              {[...links, { href: '/documents/resume.pdf', id: 'resume', label: 'Resume' }].map((link, index) => (
                <motion.div
                  key={link.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 + index * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className={styles.sheetLink}
                    onClick={() => setOpen(false)}
                    autoFocus={index === 0}
                    {...(link.id === 'resume' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <span className={styles.sheetIndex}>{String(index + 1).padStart(2, '0')}</span>
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
