'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFinePointer } from '@/components/effects/useFinePointer';
import { ModelCanvas } from '@/components/three/ModelCanvas';

import styles from './ModelSection.module.css';

export type ModelSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  model: string;
  accent: string;
  /** Static fallback content when WebGL is unavailable or motion is reduced. */
  fallback?: React.ReactNode;
  /** Twinkling white starfield behind the 3D model. */
  stars?: boolean;
  /** Shooting star streaking from bottom-left to top-right. */
  shootingStar?: boolean;
};

/**
 * Shared section wrapper for each 3D model.
 *
 * - Reveals heading + canvas on scroll (Framer Motion, honours reduced motion).
 * - Renders ModelCanvas, which self-mounts only when the section is near the
 *   viewport and unmounts when far.
 * - Falls back to a static card on coarse pointers / reduced motion / no WebGL.
 */
export function ModelSection({
  id,
  eyebrow,
  title,
  description,
  model,
  accent,
  fallback,
  stars = false,
  shootingStar = false,
}: ModelSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const fine = useFinePointer();
  const [webgl, setWebgl] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const canvas = document.createElement('canvas');
    let gl = false;
    try {
      gl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {}
    setWebgl(gl);
  }, []);

  // Defer to after mount so SSR and the first client render agree (no hydration mismatch).
  const showCanvas = ready && webgl && fine && !reduceMotion;

  return (
    <section id={id} ref={sectionRef} className={styles.section}>
      <div className={styles.inner}>
        <motion.div
          className={styles.heading}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.7, ease: 'easeOut' },
          }}
          viewport={{ once: true, margin: '-140px' }}
        >
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 className={styles.title}>{title}</h2>
        </motion.div>

        <div className={styles.canvasWrapper}>
          {showCanvas ? (
            <ModelCanvas model={model} accent={accent} label={title} stars={stars} />
          ) : (
            fallback ?? <div className={styles.fallback}>{title}</div>
          )}
          {shootingStar && <div className={styles.shootingStar} aria-hidden="true" />}
        </div>

        <p className={styles.description}>{description}</p>
      </div>
    </section>
  );
}
