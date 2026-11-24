'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/app/about/About.module.css';

/** Typewriter reveal driven by scroll progress. */
export function Typewriter({ text, className }: { text: string; className?: string }) {
  const [chars, setChars] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        let i = 0;
        const timer = setInterval(() => {
          setChars(i);
          i += 1;
          if (i > text.length) clearInterval(timer);
        }, 40);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <h1 ref={ref} className={className}>
      {text.slice(0, chars)}{chars < text.length && <span className={styles.cursor} />}
    </h1>
  );
}
