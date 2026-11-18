'use client';

import { useEffect, useRef, useState } from 'react';
import type { HubTag } from '@/lib/hub/tags';
import type { TransitionMedia } from '@/lib/hub/media-cache';
import styles from './TransitionOverlay.module.css';

/** Fade up to full cover, hold the clip, fade out into the section: about 3.6 s in all. */
export const FADE_IN_MS = 450;
export const HOLD_MS = 3000;
export const FADE_OUT_MS = 650;

type Props = {
  tag: HubTag;
  /** A brand-new object URL for this one showing, so the clip starts at its first frame. */
  media: TransitionMedia;
  /** True once the browser has actually arrived at the section underneath. */
  navigated: boolean;
  /** The clip fully covers the screen: time to switch the page underneath. */
  onCovered: () => void;
  /** The overlay has faded out completely. */
  onFinish: () => void;
};

/**
 * The selected hanger's own clip, edge to edge. It covers everything (the rack, the header, the section
 * being opened) and is mounted fresh for every selection, so it plays from its start every single time.
 */
export function TransitionOverlay({ tag, media, navigated, onCovered, onFinish }: Props) {
  const [stage, setStage] = useState<'enter' | 'in' | 'out'>('enter');
  const [heldLongEnough, setHeldLongEnough] = useState(false);
  const covered = useRef(onCovered);
  const finished = useRef(onFinish);
  covered.current = onCovered;
  finished.current = onFinish;

  // Start fading in on the next frame so the transition runs from opacity 0.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStage('in'));
    const cover = window.setTimeout(() => covered.current(), FADE_IN_MS + 40);
    const hold = window.setTimeout(() => setHeldLongEnough(true), HOLD_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(cover);
      window.clearTimeout(hold);
    };
  }, []);

  // Fade out only once the hold time is up AND the section is really there: never back to the rack.
  useEffect(() => {
    if (heldLongEnough && navigated) setStage('out');
  }, [heldLongEnough, navigated]);

  useEffect(() => {
    if (stage !== 'out') return;
    const done = window.setTimeout(() => finished.current(), FADE_OUT_MS + 60);
    return () => window.clearTimeout(done);
  }, [stage]);

  const [fx, fy] = tag.media.focus;
  return (
    <div className={styles.overlay} data-stage={stage} data-hub-keep="" data-tag={tag.id} role="status" aria-live="polite">
      <span className={styles.srOnly}>Opening {tag.label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fresh element per showing: the clip must restart */}
      <img
        className={styles.media}
        src={media.src}
        alt=""
        draggable={false}
        style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }}
        data-transition-img=""
      />
      <span className={styles.vignette} aria-hidden="true" />
    </div>
  );
}
