'use client';

import { useEffect, useRef, useState } from 'react';
import type { HubTag } from '@/lib/hub/tags';
import type { TransitionMedia } from '@/lib/hub/media-cache';
import styles from './TransitionOverlay.module.css';

/** Fade up to full cover, hold the clip, fade out into the section: about 2.5 s in all. */
export const FADE_IN_MS = 450;
export const HOLD_MS = 1400;
export const FADE_OUT_MS = 650;
const SKIP_FADE_MS = 280;
/** Fill the screen by cropping only when little of the picture is lost; otherwise show it whole. */
const MAX_CROP = 0.2;

type Props = {
  tag: HubTag;
  /** A brand-new object URL for this one showing, so the clip starts at its first frame. */
  media: TransitionMedia;
  /** True once the browser has actually arrived at the section underneath. */
  navigated: boolean;
  /** The clip fully covers the screen (or Skip was pressed): time to switch the page underneath. */
  onCovered: () => void;
  /** The overlay has faded out completely. */
  onFinish: () => void;
};

/** How the picture meets the screen: `cover` fills edge to edge; `contain` keeps all of it in view. */
function fitFor(media: TransitionMedia): 'cover' | 'contain' {
  if (!media.width || !media.height) return 'contain'; // size unknown: never risk cropping
  const a = media.width / media.height;
  const b = window.innerWidth / window.innerHeight;
  const lost = 1 - Math.min(a / b, b / a);
  return lost <= MAX_CROP ? 'cover' : 'contain';
}

/**
 * The selected hanger's own clip, filling the screen. It covers everything (the rack, the header, the section
 * being opened) and is mounted fresh for every selection, so it plays from its start every single time.
 * Skip is always there: it switches to the section at once.
 */
export function TransitionOverlay({ tag, media, navigated, onCovered, onFinish }: Props) {
  const [stage, setStage] = useState<'enter' | 'in' | 'out'>('enter');
  const [heldLongEnough, setHeldLongEnough] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [fit] = useState(() => fitFor(media));
  const covered = useRef(onCovered);
  const finished = useRef(onFinish);
  const alreadyCovered = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  covered.current = onCovered;
  finished.current = onFinish;

  const cover = () => {
    if (alreadyCovered.current) return;
    alreadyCovered.current = true;
    covered.current();
  };

  // Start fading in on the next frame so the transition runs from opacity 0.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStage('in'));
    const coverTimer = window.setTimeout(cover, FADE_IN_MS + 40);
    const hold = window.setTimeout(() => setHeldLongEnough(true), HOLD_MS);
    skipRef.current?.focus({ preventScroll: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(coverTimer);
      window.clearTimeout(hold);
    };
  }, []);

  // Fade out only once the hold time is up (or Skip was pressed) AND the section is really there.
  useEffect(() => {
    if ((heldLongEnough || skipped) && navigated) setStage('out');
  }, [heldLongEnough, skipped, navigated]);

  useEffect(() => {
    if (stage !== 'out') return;
    const done = window.setTimeout(() => finished.current(), (skipped ? SKIP_FADE_MS : FADE_OUT_MS) + 60);
    return () => window.clearTimeout(done);
  }, [stage, skipped]);

  const skip = () => {
    setSkipped(true);
    cover(); // go to the section right now
  };

  const [fx, fy] = tag.media.focus;
  const position = `${fx * 100}% ${fy * 100}%`;
  return (
    <div
      className={styles.overlay}
      data-stage={stage}
      data-skipped={skipped}
      data-fit={fit}
      data-hub-keep=""
      data-tag={tag.id}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${tag.label}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') skip();
      }}
    >
      {fit === 'contain' ? (
        // The same clip, enlarged and blurred, fills what the whole picture leaves over (in step: same URL).
        // eslint-disable-next-line @next/next/no-img-element -- a fresh element per showing: the clip must restart
        <img className={styles.backdrop} src={media.src} alt="" draggable={false} aria-hidden="true" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a fresh element per showing: the clip must restart */}
      <img
        className={styles.media}
        src={media.src}
        alt=""
        draggable={false}
        style={{ objectFit: fit, objectPosition: fit === 'cover' ? position : 'center' }}
        data-transition-img=""
      />
      <span className={styles.vignette} aria-hidden="true" />
      <button ref={skipRef} type="button" className={styles.skip} onClick={skip} disabled={skipped}>
        Skip
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 5l7 7-7 7M13 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
