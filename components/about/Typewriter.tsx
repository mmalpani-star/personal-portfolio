'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/app/about/About.module.css';
import { REACTOR_DONE_EVENT } from './ReactorIntro';

/** Time per character, plus a beat after punctuation so the sentence reads like it is being typed. */
const CHAR_MS = 45;
const PAUSE_MS: Record<string, number> = { ',': 160, '.': 260, ';': 200, ':': 200 };
/** Small breath after the reactor overlay has gone before the first letter appears. */
const START_DELAY_MS = 350;

/**
 * Types the heading out once, the first time it is on screen and nothing covers it (the About
 * reactor intro). The untyped rest of the sentence is laid out but invisible, so the centred
 * lines never shift or re-wrap as the letters arrive.
 */
export function Typewriter({ text, className }: { text: string; className?: string }) {
  const [chars, setChars] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setChars(text.length);
      return;
    }

    let timer = 0;
    let started = false;
    let visible = false;

    const type = (i: number) => {
      setChars(i);
      if (i >= text.length) return;
      timer = window.setTimeout(() => type(i + 1), CHAR_MS + (PAUSE_MS[text[i - 1]] ?? 0));
    };
    const tryStart = () => {
      if (started || !visible || document.documentElement.dataset.reactor) return;
      started = true;
      observer.disconnect();
      timer = window.setTimeout(() => type(1), START_DELAY_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        tryStart();
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    window.addEventListener(REACTOR_DONE_EVENT, tryStart);

    return () => {
      observer.disconnect();
      window.removeEventListener(REACTOR_DONE_EVENT, tryStart);
      window.clearTimeout(timer);
    };
  }, [text]);

  const done = chars >= text.length;

  return (
    <h1 ref={ref} className={className} aria-label={text}>
      <span aria-hidden="true">
        {text.slice(0, chars)}
        {!done && <span className={styles.cursor} />}
        <span className={styles.untyped}>{text.slice(chars)}</span>
      </span>
    </h1>
  );
}
