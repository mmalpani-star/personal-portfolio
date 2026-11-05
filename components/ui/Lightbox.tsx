'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import styles from './Lightbox.module.css';

export type LightboxItem = {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

type LightboxProps = {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/** Full-screen image viewer: Esc / arrow keys, focus moved in and restored on close. */
export function Lightbox({ items, index, onClose, onNavigate }: LightboxProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = index !== null;
  const item = open ? items[index] : null;

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

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onNavigate((index + 1) % items.length);
      if (event.key === 'ArrowLeft') onNavigate((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {item && index !== null ? (
        <motion.div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label={item.caption ?? item.alt}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <div className={styles.bar} onClick={(event) => event.stopPropagation()}>
            <span className={styles.counter}>
              {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
            </span>
            <button ref={closeRef} type="button" className={styles.control} onClick={onClose} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>

          <motion.figure
            key={item.src}
            className={styles.figure}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.imageWrap} style={{ aspectRatio: `${item.width} / ${item.height}` }}>
              <Image src={item.src} alt={item.alt} fill sizes="90vw" style={{ objectFit: 'contain' }} />
            </div>
            {item.caption ? <figcaption className={styles.caption}>{item.caption}</figcaption> : null}
          </motion.figure>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.control} ${styles.prev}`}
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  onNavigate((index - 1 + items.length) % items.length);
                }}
              >
                <Icon name="arrow-left" size={18} />
              </button>
              <button
                type="button"
                className={`${styles.control} ${styles.next}`}
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  onNavigate((index + 1) % items.length);
                }}
              >
                <Icon name="arrow-right" size={18} />
              </button>
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
