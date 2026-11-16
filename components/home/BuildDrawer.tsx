'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Quest } from './SideQuests';
import styles from './SideQuests.module.css';

type BuildDrawerProps = {
  quest: Quest | null;
  onClose: () => void;
};

const focusable = 'a[href], button:not([disabled])';

/** Detail drawer for a Side Quest: Esc closes, focus is held inside and restored on close. */
export function BuildDrawer({ quest, onClose }: BuildDrawerProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = quest !== null;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusable));
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <AnimatePresence>
      {quest ? (
        <motion.div
          className={styles.backdrop}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            initial={reduceMotion ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 48, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className={styles.drawerBar}>
              <span className="label">{quest.category}</span>
              <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close details">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className={styles.drawerScroll}>
              {quest.image ? (
                <div
                  className={`${styles.drawerMedia} ${quest.render ? styles.drawerMediaRender : ''}`}
                  style={{ aspectRatio: `${quest.image.width} / ${quest.image.height}` }}
                >
                  <Image
                    src={quest.image.src}
                    alt={quest.image.alt}
                    fill
                    sizes="(max-width: 720px) 100vw, 520px"
                    style={{ objectFit: quest.render ? 'contain' : 'cover' }}
                  />
                </div>
              ) : null}

              <div className={styles.drawerBody}>
                <div className={styles.drawerHead}>
                  <h3 id="drawer-title" className={styles.drawerTitle}>
                    {quest.name}
                  </h3>
                  {quest.status ? <StatusBadge status={quest.status} /> : null}
                </div>

                {quest.achievement ? (
                  <p className={styles.achievement}>
                    <strong>{quest.achievement.detail}</strong>
                    <span>{quest.achievement.label}</span>
                  </p>
                ) : null}

                <p className={styles.drawerSummary}>{quest.summary ?? quest.teaser}</p>

                <ul className={styles.points}>
                  {quest.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>

                {quest.technologies.length ? (
                  <div className="tag-list">
                    {quest.technologies.map((tech) => (
                      <span key={tech} className="tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : null}

                {quest.statusNote ? <p className={styles.note}>{quest.statusNote}</p> : null}

                {quest.slug || quest.github ? (
                  <div className={`cta-row ${styles.drawerActions}`}>
                    {quest.slug ? (
                      <Link href={`/projects/${quest.slug}`} className="button button-primary">
                        Full case study
                        <Icon name="arrow-right" size={15} />
                      </Link>
                    ) : null}
                    {quest.github ? (
                      <a href={quest.github} className="button button-secondary" target="_blank" rel="noreferrer">
                        <Icon name="github" size={15} />
                        GitHub
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
