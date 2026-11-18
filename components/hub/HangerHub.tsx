'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HUB_TAGS, type HubTag } from '@/lib/hub/tags';
import { createTransitionMedia, preloadMedia, type TransitionMedia } from '@/lib/hub/media-cache';
import { rackMemory, sectionForHash, useHubUrl, useLocationKey } from '@/lib/hub/store';
import type { RackHandle } from '@/lib/three/hanger-rack';
import { TransitionOverlay } from './TransitionOverlay';
import styles from './HangerHub.module.css';

type Phase = 'closed' | 'open' | 'selecting' | 'leaving';
type Tip = { index: number; x: number; y: number } | null;
/** The clip that is currently covering the screen. `key` makes every showing a brand-new element. */
type Showing = { tag: HubTag; media: TransitionMedia; key: number };

const LEAVE_MS = 520;
const NAVIGATION_TIMEOUT_MS = 8000;

/** Jump straight to an in-page section under the fading hub, without the site's smooth scroll. */
function jumpToHash(hash: string) {
  if (!hash) return;
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  target.scrollIntoView({ block: 'start' });
  html.style.scrollBehavior = previous;
}

function readFonts() {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    display: pick('--font-inter-tight', 'system-ui, sans-serif'),
    body: pick('--font-inter', 'system-ui, sans-serif'),
    mono: pick('--font-jetbrains-mono', 'ui-monospace, monospace'),
  };
}

/**
 * The landing hanger: a full-screen layer that is shown whenever the URL is `/` with no hash.
 * It lives in the root layout so the rack keeps its rotation while the visitor is inside a
 * section, and Back to Hanger simply navigates to `/`.
 */
export function HangerHub() {
  const router = useRouter();
  const hubUrl = useHubUrl();
  const locationKey = useLocationKey();

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RackHandle | null>(null);
  const phaseRef = useRef<Phase>('closed');
  const leaveTimer = useRef<number>(0);
  const safetyTimer = useRef<number>(0);
  const reducedRef = useRef(false);

  const [phase, setPhaseState] = useState<Phase>('closed');
  const [everOpened, setEverOpened] = useState(false);
  const [gl, setGl] = useState<'pending' | 'ok' | 'off'>('pending');
  const [ready, setReady] = useState(false);
  const [front, setFront] = useState(0);
  const [kb, setKb] = useState(-1);
  const [tip, setTip] = useState<Tip>(null);
  const [paused, setPaused] = useState(rackMemory.paused);
  const [reduced, setReduced] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showing, setShowing] = useState<Showing | null>(null);
  const showingRef = useRef<Showing | null>(null);
  const showingSeq = useRef(0);
  const pendingFocus = useRef<string | null>(null);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  /* ----- reduced motion ----- */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedRef.current = query.matches;
      setReduced(query.matches);
      handleRef.current?.setReducedMotion(query.matches);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  /* ----- go to the chosen section ----- */
  const navigate = useCallback(
    (tag: HubTag) => {
      if (tag.href.startsWith('/#')) router.push(tag.href, { scroll: false });
      else router.push(tag.href);
    },
    [router],
  );

  /** Remove the full-screen clip and hand focus to the section underneath. */
  const finishShowing = useCallback(() => {
    const current = showingRef.current;
    showingRef.current = null;
    setShowing(null);
    current?.media.release();
    const selector = pendingFocus.current;
    pendingFocus.current = null;
    if (!selector) return;
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      // Move assistive-tech focus to the section's heading without drawing a ring on it.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.setAttribute('data-hub-focus', '');
      target.focus({ preventScroll: true });
    });
  }, []);

  /* ----- choose a tag ----- */
  const pick = useCallback(
    (index: number) => {
      const handle = handleRef.current;
      // One selection at a time: while a tag is being brought forward or its clip is playing, ignore clicks.
      if (!handle || phaseRef.current !== 'open' || showingRef.current) return;
      const tag = HUB_TAGS[index];
      setPhase('selecting');
      setTip(null);
      setTouched(true);
      rackMemory.selected = index;
      pendingFocus.current = tag.focusSelector;
      // The hanger's own intro stands in for the About page's reactor intro when arriving this way.
      if (tag.id === 'about') {
        try {
          sessionStorage.setItem('reactor-seen', '1');
        } catch {
          // storage blocked: the About intro simply plays as it always did
        }
      }
      // Under reduced motion there is no full-screen clip; otherwise start preparing a fresh copy of it now,
      // while the rack turns, so it is ready the instant it is needed.
      const prepared = reducedRef.current ? null : createTransitionMedia(tag.media.src);
      handle.select(index).then(async () => {
        rackMemory.phi = handle.getState().phi;
        if (!prepared) {
          navigate(tag);
          return;
        }
        let media: TransitionMedia;
        try {
          media = await prepared;
        } catch {
          navigate(tag); // the clip could not be loaded: go straight to the section
          return;
        }
        showingSeq.current += 1;
        const next = { tag, media, key: showingSeq.current };
        showingRef.current = next;
        setShowing(next);
      });
      // If the route never lands, put the rack back rather than leave it stuck mid-air.
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => {
        if (phaseRef.current !== 'selecting') return;
        handle.cancelSelect();
        rackMemory.selected = -1;
        pendingFocus.current = null;
        if (showingRef.current) finishShowing();
        setPhase('open');
      }, NAVIGATION_TIMEOUT_MS);
    },
    [navigate, finishShowing, setPhase],
  );
  const pickRef = useRef(pick);
  pickRef.current = pick;

  /* ----- build the scene the first time the hanger is shown ----- */
  useEffect(() => {
    if (!everOpened) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: RackHandle | null = null;
    import('@/lib/three/hanger-rack')
      .then(({ createHangerRack }) => {
        if (cancelled) return;
        handle = createHangerRack({
          canvas,
          tags: HUB_TAGS,
          reducedMotion: reducedRef.current,
          fonts: readFonts(),
          initial: { phi: rackMemory.phi, paused: rackMemory.paused },
          events: {
            onPick: (i) => pickRef.current(i),
            onHover: (i, x, y) => setTip(i >= 0 ? { index: i, x, y } : null),
            onFront: (i) => setFront(i),
            onReady: () => setReady(true),
            onError: () => setGl('off'),
          },
        });
        handleRef.current = handle;
        setGl((current) => (current === 'off' ? current : 'ok'));
        // Fetch all five clips in the background (the tag textures use the same downloads).
        if (!reducedRef.current) preloadMedia(HUB_TAGS.map((tag) => tag.media.src));
        const shown = phaseRef.current === 'open' || phaseRef.current === 'selecting';
        if (!shown) handle.setActive(false);
        if (rackMemory.selected >= 0 && shown) {
          handle.arrive(rackMemory.selected);
          rackMemory.selected = -1;
        }
      })
      .catch(() => setGl('off'));
    return () => {
      cancelled = true;
      if (handle) {
        rackMemory.phi = handle.getState().phi;
        handle.dispose();
      }
      handleRef.current = null;
    };
  }, [everOpened]);

  /* ----- one section at a time: the home page shows only the section the URL names ----- */
  useEffect(() => {
    if (locationKey === null) return;
    const html = document.documentElement;
    if (window.location.pathname !== '/') {
      delete html.dataset.section;
      return;
    }
    const hash = window.location.hash;
    if (hash === '' || hash === '#') {
      delete html.dataset.section; // the hanger itself: nothing to isolate
      return;
    }
    const section = sectionForHash(hash);
    if (section) html.dataset.section = section; // any other hash (e.g. #top) leaves the current section as it is
  }, [locationKey]);

  /* ----- the URL decides whether the hanger is showing ----- */
  useEffect(() => {
    if (hubUrl === null) return;
    const html = document.documentElement;
    window.clearTimeout(leaveTimer.current);

    if (hubUrl) {
      window.clearTimeout(safetyTimer.current);
      if (showingRef.current) finishShowing(); // e.g. the browser's Back button during the clip
      pendingFocus.current = null;
      setEverOpened(true);
      if (phaseRef.current === 'open') return;
      const wasClosed = phaseRef.current === 'closed' || phaseRef.current === 'leaving';
      setPhase('open');
      html.dataset.hub = 'open';
      const handle = handleRef.current;
      if (handle && wasClosed) {
        handle.setActive(true);
        if (rackMemory.selected >= 0) handle.arrive(rackMemory.selected);
      }
      rackMemory.selected = -1;
      window.requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true }));
      return;
    }

    // Leaving the hanger.
    window.clearTimeout(safetyTimer.current);
    const wasSelecting = phaseRef.current === 'selecting';
    if (phaseRef.current === 'closed') {
      html.dataset.hub = 'closed';
      return;
    }
    const tag = rackMemory.selected >= 0 ? HUB_TAGS[rackMemory.selected] : null;
    if (wasSelecting) {
      jumpToHash(window.location.hash);
      handleRef.current?.finish();
    }
    setPhase('leaving');
    html.dataset.hub = 'leaving';
    leaveTimer.current = window.setTimeout(
      () => {
        setPhase('closed');
        html.dataset.hub = 'closed';
        const handle = handleRef.current;
        if (handle) {
          rackMemory.phi = handle.getState().phi;
          handle.setActive(false);
        }
        // With a clip covering the screen, focus moves when the clip finishes instead.
        if (tag && !showingRef.current) {
          const target = document.querySelector<HTMLElement>(tag.focusSelector);
          if (target) {
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.setAttribute('data-hub-focus', '');
            target.focus({ preventScroll: true });
          }
          pendingFocus.current = null;
        }
      },
      reducedRef.current ? 160 : LEAVE_MS,
    );
  }, [hubUrl, setPhase, finishShowing]);

  /* ----- while the hanger is up, nothing behind it can be reached ----- */
  const clipUp = showing !== null;
  useEffect(() => {
    if (phase !== 'open' && phase !== 'selecting' && !clipUp) return;
    const blocked: HTMLElement[] = [];
    Array.from(document.body.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.hasAttribute('data-hub-keep') || el.tagName === 'SCRIPT' || el.tagName.toLowerCase() === 'next-route-announcer') return;
      if (!el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        blocked.push(el);
      }
    });
    return () => blocked.forEach((el) => el.removeAttribute('inert'));
  }, [phase, clipUp]);

  useEffect(
    () => () => {
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(safetyTimer.current);
    },
    [],
  );

  /* ----- keyboard, buttons ----- */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (phaseRef.current !== 'open') return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleRef.current?.step(1);
      setTouched(true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleRef.current?.step(-1);
      setTouched(true);
    }
  };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    rackMemory.paused = next;
    handleRef.current?.setPaused(next);
  };

  const shown = tip ? tip.index : kb >= 0 ? kb : front;
  const current = HUB_TAGS[shown] ?? HUB_TAGS[0];
  const interactive = phase === 'open';
  const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  return (
    <>
    <div
      ref={rootRef}
      data-hub-keep=""
      className={styles.hub}
      data-state={phase}
      data-gl={gl}
      data-ready={ready}
      role="region"
      aria-label="Portfolio navigation"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.brand} aria-hidden="true">
        <span className={styles.monogram}>MM</span>
        <span className={styles.brandName}>Madhav Malpani</span>
      </div>


      {/* Real links: the keyboard and screen-reader route, and the no-WebGL route. */}
      <ul className={styles.links}>
        {HUB_TAGS.map((tag, i) => (
          <li key={tag.id}>
            <a
              href={tag.href}
              className={styles.link}
              onFocus={() => {
                setKb(i);
                handleRef.current?.setKeyboardFocus(i);
              }}
              onBlur={() => {
                setKb(-1);
                handleRef.current?.setKeyboardFocus(-1);
              }}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                if (gl === 'off') return; // fall back to ordinary navigation
                event.preventDefault();
                pick(i);
              }}
            >
              {String(i + 1).padStart(2, '0')} {tag.label}
              <span className={styles.srOnly}>: {tag.blurb}</span>
            </a>
          </li>
        ))}
      </ul>

      {!reduced && gl !== 'off' ? (
        <button type="button" className={styles.pause} aria-pressed={paused} onClick={togglePause} disabled={!interactive}>
          {paused ? 'Resume rotation' : 'Pause rotation'}
        </button>
      ) : null}

      {gl === 'off' ? (
        <div className={styles.fallback} aria-hidden="true">
          {HUB_TAGS.map((tag) => (
            <span key={tag.id} className={styles.fallbackTag}>
              <span className={styles.fallbackLabel}>{tag.label}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.dock} aria-hidden={!interactive}>
          <button
            type="button"
            className={styles.step}
            aria-label="Previous section"
            tabIndex={-1}
            disabled={!interactive}
            onClick={() => {
              handleRef.current?.step(-1);
              setTouched(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className={styles.caption}>
            <span className={styles.kicker}>
              {String(shown + 1).padStart(2, '0')} / {String(HUB_TAGS.length).padStart(2, '0')}
            </span>
            <span className={styles.title}>{current.label}</span>
            <span className={styles.blurb}>{current.blurb}</span>
            <button type="button" className={styles.open} tabIndex={-1} disabled={!interactive} onClick={() => pick(shown)}>
              Open {current.label}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className={styles.step}
            aria-label="Next section"
            tabIndex={-1}
            disabled={!interactive}
            onClick={() => {
              handleRef.current?.step(1);
              setTouched(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {gl !== 'off' ? (
        <p className={styles.hint} data-hidden={touched} aria-hidden="true">
          <span className={styles.hintFine}>Drag or scroll to turn the rack · select a tag to open it</span>
          <span className={styles.hintTouch}>Drag to turn the rack · tap a tag to open it</span>
        </p>
      ) : null}

      {tip && fine && interactive ? (
        <span className={styles.tip} aria-hidden="true" style={{ transform: `translate3d(${tip.x + 16}px, ${tip.y + 20}px, 0)` }}>
          {HUB_TAGS[tip.index].label}
          <span className={styles.tipArrow}>↗</span>
        </span>
      ) : null}
    </div>

    {showing ? (
      <TransitionOverlay
        key={showing.key}
        tag={showing.tag}
        media={showing.media}
        navigated={hubUrl === false}
        onCovered={() => navigate(showing.tag)}
        onFinish={finishShowing}
      />
    ) : null}
    </>
  );
}
