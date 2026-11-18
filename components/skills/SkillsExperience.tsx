'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { verifiedSkills } from '@/data/site-data';
import { flyLogos, type Flight } from '@/lib/skills/burst';
import { SKILL_LOGOS, type SkillGroupId, type SkillLogo } from '@/lib/skills/logos';
import type { BackpackHandle } from '@/lib/three/backpack';
import styles from './Skills.module.css';

type Phase = 'closed' | 'opening' | 'open' | 'repacking';

const GROUPS: Array<{ id: SkillGroupId; title: string }> = [
  { id: 'programming', title: 'Programming' },
  { id: 'engineering', title: 'Engineering' },
  { id: 'software', title: 'Software & Tools' },
];

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * The Skills section: a 3D backpack whose zipper the visitor drags open. As it opens, light spills out and the
 * skills burst from it into their three groups; the pack settles into a corner and Repack puts everything back.
 * The groups are a real list in the page at all times, so assistive technology never needs the animation.
 */
export function SkillsExperience() {
  const stageRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<BackpackHandle | null>(null);
  const flightRef = useRef<Flight | null>(null);
  const phaseRef = useRef<Phase>('closed');
  const reducedRef = useRef(false);

  const [phase, setPhaseState] = useState<Phase>('closed');
  const [ready, setReady] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [gl, setGl] = useState<'pending' | 'ok' | 'off'>('pending');
  const [reduced, setReduced] = useState(false);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // every skill in the data file has a mark; the order follows the data
  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: verifiedSkills[group.id]
          .map((label) => SKILL_LOGOS.find((logo) => logo.label === label && logo.group === group.id))
          .filter((logo): logo is SkillLogo => Boolean(logo)),
      })),
    [],
  );

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

  /* ----- where the backpack sits: centred while closed, a small mark in a corner once open ----- */
  const place = useCallback((mode: 'center' | 'corner') => {
    const stage = stageRef.current;
    const wrap = wrapRef.current;
    if (!stage || !wrap) return;
    const sw = stage.clientWidth;
    const closedH = Math.max(420, window.innerHeight - 64);
    const w = wrap.offsetWidth;
    const h = wrap.offsetHeight;
    const narrow = window.innerWidth < 900;
    let cx = sw / 2;
    let cy = closedH / 2;
    let scale = 1;
    if (mode === 'corner') {
      scale = Math.min(0.42, (narrow ? 124 : 176) / w);
      cx = narrow ? sw - 14 - (w * scale) / 2 : 24 + (w * scale) / 2;
      cy = narrow ? 14 + (h * scale) / 2 : stage.clientHeight - 24 - (h * scale) / 2;
    }
    wrap.style.transform = `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0) scale(${scale})`;
  }, []);

  useIsoLayoutEffect(() => {
    place('center');
    const onResize = () => place(phaseRef.current === 'open' || phaseRef.current === 'opening' ? 'corner' : 'center');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);

  /* ----- the scene ----- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: BackpackHandle | null = null;
    import('@/lib/three/backpack')
      .then(({ createBackpack }) => {
        if (cancelled) return;
        handle = createBackpack({
          canvas,
          reducedMotion: reducedRef.current,
          events: {
            onReady: () => setReady(true),
            onError: () => setGl('off'),
            onGrab: setGrabbing,
            onThreshold: () => {
              if (phaseRef.current === 'closed') setPhase('opening');
            },
            onProgress: (p) => {
              const glow = glowRef.current;
              const stage = stageRef.current;
              if (!glow || !stage || !handle) return;
              const mouth = handle.getMouthPoint();
              const rect = stage.getBoundingClientRect();
              glow.style.setProperty('--open', p.toFixed(3));
              glow.style.setProperty('--mx', `${(mouth.x - rect.left).toFixed(1)}px`);
              glow.style.setProperty('--my', `${(mouth.y - rect.top).toFixed(1)}px`);
            },
          },
        });
        handleRef.current = handle;
        setGl((current) => (current === 'off' ? current : 'ok'));
      })
      .catch(() => setGl('off'));
    return () => {
      cancelled = true;
      flightRef.current?.cancel();
      handle?.dispose();
      handleRef.current = null;
    };
  }, [setPhase]);

  // Without WebGL there is no backpack to unzip, so simply show the skills.
  useEffect(() => {
    if (gl === 'off') setPhase('open');
  }, [gl, setPhase]);

  const collect = () => {
    const stage = stageRef.current;
    if (!stage) return [];
    return Array.from(stage.querySelectorAll<HTMLElement>('[data-logo]')).map((el) => ({ el, color: el.dataset.brand ?? '#ffffff' }));
  };

  /* ----- opening: logos burst out, the pack moves to its corner ----- */
  useIsoLayoutEffect(() => {
    if (phase !== 'opening') return;
    handleRef.current?.setInteractive(false);
    void handleRef.current?.animateTo(1, 650);
    const handle = handleRef.current;
    const trails = trailRef.current;
    if (reducedRef.current || !handle || !trails) {
      place('corner');
      setPhase('open');
      return;
    }
    flightRef.current = flyLogos({ items: collect(), getMouth: () => handle.getMouthPoint(), direction: 'out', trails });
    const move = window.setTimeout(() => place('corner'), 800);
    let alive = true;
    flightRef.current.done.then(() => {
      if (alive && phaseRef.current === 'opening') setPhase('open');
    });
    return () => {
      alive = false;
      window.clearTimeout(move);
    };
  }, [phase, place, setPhase]);

  /* ----- repacking: logos return to the pack, the zipper closes ----- */
  useEffect(() => {
    if (phase !== 'repacking') return;
    let alive = true;
    (async () => {
      const handle = handleRef.current;
      const trails = trailRef.current;
      place('center');
      if (!reducedRef.current && handle && trails) {
        await sleep(520); // let the pack travel back so the logos have somewhere to go
        if (!alive) return;
        flightRef.current = flyLogos({ items: collect(), getMouth: () => handle.getMouthPoint(), direction: 'in', trails });
        await flightRef.current.done;
        if (!alive) return;
      }
      await handle?.animateTo(0, 900);
      if (!alive) return;
      handle?.rearm();
      handle?.setInteractive(true);
      setPhase('closed');
      // the logos were left hidden by the flight: hand them back to the stylesheet
      collect().forEach(({ el }) => {
        el.style.opacity = '';
        el.style.transform = '';
      });
    })();
    return () => {
      alive = false;
    };
  }, [phase, place, setPhase]);

  const unzip = () => {
    if (phaseRef.current !== 'closed') return;
    // Opening by button runs the same zipper animation; the threshold then fires by itself.
    void handleRef.current?.animateTo(1, reducedRef.current ? 1 : 1500);
  };
  const repack = () => {
    if (phaseRef.current === 'open') setPhase('repacking');
  };

  return (
    <section
      ref={stageRef}
      className={styles.stage}
      data-state={phase}
      data-ready={ready}
      data-gl={gl}
      data-grabbing={grabbing}
      data-reduced={reduced}
      aria-labelledby="skills-title"
    >
      <div ref={glowRef} className={styles.glow} aria-hidden="true" />

      <header className={styles.heading}>
        <span className={styles.index}>05</span>
        <h1 id="skills-title" className={styles.title}>
          Skills
        </h1>
        <p className={styles.lead}>Languages, hardware and tools I work with.</p>
      </header>

      <div ref={wrapRef} className={styles.packWrap} data-state={phase}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label="A 3D backpack. Drag its zipper puller to open it, or use the Unzip button."
        />
      </div>

      <div className={styles.cta} data-visible={phase === 'closed' && gl !== 'off'}>
        <p className={styles.hint}>Drag the zipper to open the backpack</p>
        <button type="button" className={styles.unzip} onClick={unzip} disabled={phase !== 'closed'}>
          Unzip it for me
        </button>
      </div>

      <button type="button" className={styles.repack} onClick={repack} disabled={phase !== 'open'} data-visible={phase === 'open' && gl !== 'off'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4" />
        </svg>
        Repack
      </button>

      <div className={styles.groups} data-state={phase}>
        {groups.map((group, index) => (
          <section key={group.id} className={styles.group} aria-labelledby={`skills-${group.id}`}>
            <div className={styles.groupHead}>
              <span className={styles.groupCode}>S.{index + 1}</span>
              <h2 id={`skills-${group.id}`} className={styles.groupTitle}>
                {group.title}
              </h2>
              <span className={styles.groupCount}>{String(group.items.length).padStart(2, '0')}</span>
            </div>
            <ul className={styles.logos}>
              {group.items.map((logo, i) => (
                <li
                  key={logo.label}
                  className={styles.item}
                  data-logo=""
                  data-brand={logo.c1}
                  style={{ '--b1': logo.c1, '--b2': logo.c2 ?? logo.c1, '--d': `${-(i * 0.9 + index * 0.5)}s` } as CSSProperties}
                >
                  <span className={styles.bob}>
                    <svg className={styles.logoBox} viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: logo.svg }} />
                    <span className={styles.label}>{logo.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <canvas ref={trailRef} className={styles.trails} aria-hidden="true" />
    </section>
  );
}
