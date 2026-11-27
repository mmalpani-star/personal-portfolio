'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { verifiedSkills } from '@/data/site-data';
import { SKILL_LOGOS, type SkillGroupId, type SkillLogo } from '@/lib/skills/logos';
import type { DotBust } from '@/lib/three/dot-bust';
import styles from './Skills.module.css';

const GROUPS: Array<{ id: SkillGroupId; title: string }> = [
  { id: 'programming', title: 'Programming' },
  { id: 'engineering', title: 'Engineering' },
  { id: 'software', title: 'Software & Tools' },
];

/** Width / height of the whole bust (model bounds 1.49 x 1.90). */
const BUST_ASPECT = 1.491 / 1.899;
/** Where each group's marks sit on the ellipse around the bust, in degrees (0 = right, 90 = down). */
const ARCS: Record<SkillGroupId, [number, number]> = {
  programming: [222, 142],   // left side, top to bottom
  engineering: [-42, 42],    // right side, top to bottom
  software: [122, 58],       // along the bottom, in front of the shoulders, left to right
};
const WIDE = 900;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The Skills section: a head-and-shoulders bust drawn from 66,000 dots (lib/three/dot-bust.ts) that turns to look
 * at the cursor, with the skill marks arranged around it. The marks are a real list in the page, grouped under
 * headings, so assistive technology never needs the picture.
 */
export function SkillsExperience() {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bustRef = useRef<DotBust | null>(null);
  const layoutRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [gl, setGl] = useState<'pending' | 'ok' | 'off'>('pending');

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

  /* ----- layout: size the bust to the stage, then put the marks on an ellipse around it ----- */
  useIsoLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const layout = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const wide = window.innerWidth >= WIDE;
      let fit: number;
      if (wide) {
        const room = W / 2 - 300;                                          // keep a band each side for the marks
        fit = Math.max(0.45, Math.min(0.86, (2 * room) / (H * BUST_ASPECT)));
        const halfW = (fit * H * BUST_ASPECT) / 2;
        const halfH = (fit * H) / 2;
        const rx = halfW + 125;
        const ry = halfH * 0.94;
        const cx = W / 2;
        const cy = H / 2;
        for (const group of GROUPS) {
          const items = Array.from(stage.querySelectorAll<HTMLElement>(`[data-group="${group.id}"] [data-logo]`));
          const [a0, a1] = ARCS[group.id];
          items.forEach((el, i) => {
            const f = items.length > 1 ? i / (items.length - 1) : 0.5;
            const a = toRad(a0 + (a1 - a0) * f);
            el.style.setProperty('--x', `${(cx + Math.cos(a) * rx).toFixed(1)}px`);
            el.style.setProperty('--y', `${(cy + Math.sin(a) * ry).toFixed(1)}px`);
          });
          const head = stage.querySelector<HTMLElement>(`[data-group="${group.id}"] [data-head]`);
          if (head && items[0]) {
            const x = parseFloat(items[0].style.getPropertyValue('--x'));
            const y = parseFloat(items[0].style.getPropertyValue('--y'));
            // software starts low on the left, under Programming's last mark: its name goes to the left instead of above
            const left = group.id === 'software';
            head.style.setProperty('--x', `${left ? x - 130 : x}px`);
            head.style.setProperty('--y', `${left ? y : y - 62}px`);
          }
        }
      } else {
        const canvas = canvasRef.current;
        const ch = canvas?.clientHeight ?? H;
        fit = Math.max(0.4, Math.min(0.9, (W * 0.88) / (ch * BUST_ASPECT)));
      }
      bustRef.current?.setFit(fit);
    };
    layoutRef.current = layout;
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  /* ----- the scene ----- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let cancelled = false;
    let bust: DotBust | null = null;
    let visible = false;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      bust?.setActive(visible);
    });
    io.observe(stage);
    const theme = new MutationObserver(() => bust?.setLight(document.documentElement.dataset.theme === 'light'));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    import('@/lib/three/dot-bust')
      .then(({ createDotBust }) => {
        if (cancelled) return;
        bust = createDotBust({
          canvas,
          src: '/models/skills/bust.glb',
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          light: document.documentElement.dataset.theme === 'light',
          onReady: () => {
            if (cancelled) return;
            setGl('ok');
            setReady(true);
          },
          onError: () => !cancelled && setGl('off'),
        });
        bustRef.current = bust;
        layoutRef.current(); // the layout ran before the scene existed: give it its fit now
        bust.setActive(visible);
      })
      .catch(() => setGl('off'));
    return () => {
      cancelled = true;
      io.disconnect();
      theme.disconnect();
      bust?.dispose();
      bustRef.current = null;
    };
  }, []);

  let n = 0;
  return (
    <section
      ref={stageRef}
      className={styles.stage}
      data-ready={ready}
      data-gl={gl}
      aria-labelledby="skills-title"
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label="A head-and-shoulders bust drawn from thousands of small glowing dots. It turns to look at the cursor."
      />

      <header className={styles.heading}>
        <span className={styles.index}>05</span>
        <h1 id="skills-title" className={styles.title}>
          Skills
        </h1>
        <p className={styles.lead}>Languages, hardware and tools I work with.</p>
      </header>

      <div className={styles.groups}>
        {groups.map((group, index) => (
          <section key={group.id} className={styles.group} data-group={group.id} aria-labelledby={`skills-${group.id}`}>
            <h2 id={`skills-${group.id}`} className={styles.groupTitle} data-head="">
              <span className={styles.groupCode}>S.{index + 1}</span> {group.title}
            </h2>
            <ul className={styles.logos}>
              {group.items.map((logo, i) => {
                n += 1;
                return (
                  <li
                    key={logo.label}
                    className={styles.item}
                    data-logo=""
                    style={{ '--d': `${-(i * 0.9 + index * 0.5)}s`, '--i': n } as CSSProperties}
                  >
                    <span className={styles.bob}>
                      {logo.src ? (
                        <span
                          className={`${styles.logoBox} ${styles.mask}`}
                          style={{ WebkitMaskImage: `url(${logo.src})`, maskImage: `url(${logo.src})` }}
                          aria-hidden="true"
                        />
                      ) : (
                        <svg className={styles.logoBox} viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: logo.svg }} />
                      )}
                      <span className={styles.label}>{logo.label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
