'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './InterestBuoys.module.css';

/**
 * The interests as buoys on the sea: they surface one after another the first time the list comes into view,
 * then keep bobbing, each a little out of step with its neighbours, like floats on the same swell.
 */
export function InterestBuoys({ items }: { items: string[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ul ref={ref} className={styles.buoys} data-in={inView}>
      {items.map((item, i) => (
        <li key={item} className={styles.buoy} style={{ '--i': i, '--phase': `${-(i * 0.73) % 4}s`, '--tilt': `${i % 2 ? 1 : -1}` } as CSSProperties}>
          <span className={styles.float}>
            <span className={styles.ring} aria-hidden="true" />
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
