'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

type RevealElement = 'div' | 'section' | 'article' | 'span' | 'li';

type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  as?: RevealElement;
  /**
   * For above-the-fold content. Uses a CSS entrance animation instead of
   * Framer Motion so the content is visible in the server-rendered HTML and
   * never waits on hydration (protects LCP). Reduced motion is handled in CSS.
   */
  eager?: boolean;
};

const ElementMap = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  span: motion.span,
  li: motion.li,
} as const;

export function Reveal({ children, className, style, delay = 0, as = 'div', eager = false }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (eager) {
    const Tag = as;
    return (
      <Tag
        className={`reveal-eager ${className ?? ''}`.trim()}
        style={delay ? { ...style, animationDelay: `${delay}s` } : style}
      >
        {children}
      </Tag>
    );
  }

  const Component = ElementMap[as];

  return (
    <Component
      className={className}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </Component>
  );
}

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={reduceMotion ? undefined : { opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35 }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
