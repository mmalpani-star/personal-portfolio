'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Newsreader } from 'next/font/google';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { HardwareViewer } from '@/components/experience/HardwareViewer';
import { PcbViewer } from '@/components/experience/PcbViewer';
import type { GalleryItem, StoryEntry } from '@/data/experience-story';
import styles from './TapeShelf.module.css';

const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], weight: ['400'], display: 'swap', variable: '--font-newsreader' });

/** Copies of the shelf rendered side by side, so wrapping always happens far off screen. */
const COPIES = 7;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const SHEET_EASE = 'cubic-bezier(.76,0,.18,1)';
const BLOBS: Array<[number, number, number]> = [
  [150, 330, 0], [340, 600, 120], [250, 120, 220], [90, 760, 300], [400, 250, 360], [260, 860, 420], [230, 470, 180],
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const B = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);
const mod = (a: number, n: number) => ((a % n) + n) % n;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

/* ------------------------------------------------------------------ the printed faces */

function Duotone({ entry, className }: { entry: StoryEntry; className?: string }) {
  const { poster, focus, dark, light } = entry.shelf;
  return (
    <span className={`${styles.duo} ${className ?? ''}`} style={{ '--dark': dark, '--light': light } as CSSProperties} aria-hidden="true">
      <img src={poster} alt="" draggable={false} style={{ objectPosition: focus }} />
    </span>
  );
}

function Spine({ entry }: { entry: StoryEntry }) {
  const { short, year, card, type } = entry.shelf;
  return (
    <div className={styles.sp} style={{ '--card': card, '--type': type } as CSSProperties}>
      <Duotone entry={entry} className={styles.spPic} />
      <span className={`${styles.spTitle} ${serif.className}`}>{short}</span>
      <span className={styles.spFoot}>
        <span className={styles.spName}>MALPANI</span>
        <span className={styles.spBadge}>{year}</span>
      </span>
    </div>
  );
}

function Cover({ entry, index, total }: { entry: StoryEntry; index: number; total: number }) {
  const { short, card, type } = entry.shelf;
  return (
    <div className={styles.cv} style={{ '--card': card, '--type': type } as CSSProperties}>
      <span className={styles.cvTop}>A MADHAV MALPANI EXPERIENCE</span>
      <span className={`${styles.cvTitle} ${serif.className}`}>{short}</span>
      <Duotone entry={entry} className={styles.cvPic} />
      <span className={styles.cvFoot}>
        <span className={styles.cvRole}>{entry.title}</span>
        <span className={styles.cvBadge}>
          {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ media around the poster */

/** One photo, clip or model in an equal-sized tile; the caption sits over its foot. */
function Tile({ item, place }: { item: GalleryItem; place: string }) {
  return (
    <figure className={styles.tile} data-kind={item.kind} data-place={place} data-tile="" title={item.caption}>
      {item.kind === 'image' ? (
        <Image src={item.src} alt={item.alt} fill sizes="(max-width: 767px) 46vw, 22vw" quality={78} className={styles.tileMedia} />
      ) : item.kind === 'video' ? (
        <video className={styles.tileMedia} controls muted playsInline preload="none" poster={item.poster} aria-label={item.label}>
          <source src={item.src} type="video/mp4" />
        </video>
      ) : item.kind === 'pcb' ? (
        <div className={styles.tileModel}><PcbViewer label="Interactive 3D model of the CAN FD transceiver breakout board. Drag to rotate." /></div>
      ) : (
        <div className={styles.tileModel}><HardwareViewer label="3D model of the four printed parts of the chair attachment. Drag to rotate." /></div>
      )}
      <figcaption className={styles.tileCap}>{item.caption}</figcaption>
    </figure>
  );
}

/**
 * Arranges an experience's media around its poster so it is mirror-even. With four or more, two stacked tiles go
 * either side of the poster (first half left, second half right) and any extra are centred in a row underneath;
 * with fewer, they all sit in one centred row under the poster, which suits wide photos and 3D models better than
 * tall side tiles. The poster's own photo is not repeated.
 */
function arrange(entry: StoryEntry) {
  const rest = entry.gallery.filter((g) => !(g.kind === 'image' && g.src === entry.shelf.poster));
  const perSide = rest.length >= 4 ? 2 : 0;
  return { left: rest.slice(0, perSide), right: rest.slice(perSide, perSide * 2), below: rest.slice(perSide * 2) };
}

/* ------------------------------------------------------------------ the shelf */

export function TapeShelf({ entries }: { entries: StoryEntry[] }) {
  const N = entries.length;
  const V = N * COPIES;
  const years = useMemo(() => Array.from(new Set(entries.map((e) => e.shelf.year))).sort(), [entries]);
  const uid = useId().replace(/:/g, '');

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tapeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const capRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tabsRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const blobRefs = useRef<Array<SVGCircleElement | null>>([]);
  const linesRef = useRef<HTMLDivElement>(null);

  const start = N - 1 + Math.floor(COPIES / 2) * N; // open on the latest experience, in the middle copy
  const m = useRef({
    s: start, T: start, active: N - 1, hover: -1, lifts: new Float32Array(V),
    mx: -1e4, my: -1e4, inside: false, cx: -1e4, cy: -1e4, tiltX: 0, tiltY: 0, onCover: false,
    H: 400, ws: 68, d: 210, gap: 12, W: 1200, Hs: 800,
    drag: null as null | { x: number; T0: number; moved: boolean }, suppressClick: false,
    wheelTimer: 0, reduced: false, open: false,
  });

  const [active, setActive] = useState(N - 1);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ---- geometry from --H */
  const measure = useCallback(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--H);width:1px;top:0;left:0';
    root.appendChild(probe);
    const H = probe.getBoundingClientRect().height || 400;
    probe.remove();
    const s = m.current;
    s.H = H; s.ws = (H * 142) / 840; s.d = (H * 474) / 900; s.gap = H * 0.03;
    s.W = root.clientWidth; s.Hs = root.clientHeight;
    stage.style.setProperty('--ws', `${s.ws}px`);
    stage.style.setProperty('--d', `${s.d}px`);
    root.style.setProperty('--Hpx', `${H}px`);
  }, []);

  /* ---- caption: a new line slides in through each mask, the old one slides out */
  const swapCaption = useCallback((index: number, dir: number) => {
    const e = entries[index];
    const texts = [e.title, `${e.organization}${e.descriptor ? ` / ${e.descriptor}` : ''}`, e.dates ?? e.shelf.year];
    capRefs.current.forEach((mask, k) => {
      if (!mask) return;
      const span = document.createElement('span');
      span.className = styles.capLine;
      span.textContent = texts[k];
      if (mask.childElementCount) span.style.position = 'absolute';
      mask.appendChild(span);
      if (m.current.reduced) {
        Array.from(mask.children).forEach((c) => { if (c !== span) c.remove(); });
        span.style.position = '';
        return;
      }
      const d = dir || 1;
      span.animate([{ transform: `translateY(${d * 105}%)` }, { transform: 'translateY(0)' }], { duration: 650, easing: EASE, fill: 'both' });
      Array.from(mask.children).forEach((c) => {
        if (c === span || (c as HTMLElement).dataset.leaving) return;
        const old = c as HTMLElement;
        old.dataset.leaving = '1';
        const from = getComputedStyle(old).transform;
        old.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: `translateY(${-d * 105}%)` }], { duration: 650, easing: EASE, fill: 'both' })
          .finished.then(() => { old.remove(); span.style.position = ''; }).catch(() => undefined);
      });
    });
  }, [entries]);

  const moveIndicator = useCallback((index: number) => {
    const tabs = tabsRef.current;
    const ind = indRef.current;
    if (!tabs || !ind) return;
    const btn = tabs.querySelector<HTMLButtonElement>(`[data-year="${entries[index].shelf.year}"]`);
    if (!btn) return;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
    tabs.querySelectorAll('button').forEach((b) => b.toggleAttribute('data-on', b === btn));
  }, [entries]);

  /* ---- navigation */
  const goTo = useCallback((T: number) => { m.current.T = T; }, []);
  const step = useCallback((d: number) => goTo(Math.round(m.current.T) + d), [goTo]);
  const goYear = useCallback((year: string | null) => {
    const target = year ? entries.findIndex((e) => e.shelf.year === year) : 0;
    if (target < 0) return;
    const s = m.current;
    const cur = mod(Math.round(s.T), N);
    let delta = target - cur;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;
    goTo(Math.round(s.T) + delta);
  }, [entries, N, goTo]);

  /* ---- opening and closing a tape */
  const coverRect = () => {
    const s = m.current;
    const v = Math.round(s.s);
    const idx = mod(v, V);
    const face = tapeRefs.current[idx]?.querySelector(`.${styles.cv}`) as HTMLElement | null;
    return face?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - 100, window.innerHeight / 2 - 200, 200, 400);
  };

  const openDetail = useCallback(() => {
    const s = m.current;
    if (s.open) return;
    s.T = Math.round(s.T);
    s.open = true;
    setOpenIndex(mod(Math.round(s.s), N));
  }, [N]);

  // runs once the sheet for `openIndex` is in the DOM
  useLayoutEffect(() => {
    if (openIndex === null) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const s = m.current;
    const r = coverRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    sheet.style.visibility = 'visible';
    sheet.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    const inset = `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px round 3px)`;
    const dur = s.reduced ? 1 : 1050;
    sheet.animate(
      [{ clipPath: inset, transform: 'rotate(-4.5deg)' }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }],
      { duration: dur, easing: SHEET_EASE, fill: 'both' },
    );
    linesRef.current?.querySelectorAll<HTMLElement>('[data-rise]').forEach((el, i) => {
      el.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
        duration: s.reduced ? 1 : 900, delay: s.reduced ? 0 : 620 + i * 75, easing: EASE, fill: 'both',
      });
    });
    sheet.querySelectorAll<HTMLElement>('[data-tile]').forEach((el, i) => {
      el.animate([{ clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }], {
        duration: s.reduced ? 1 : 900, delay: s.reduced ? 0 : 700 + i * 110, easing: SHEET_EASE, fill: 'both',
      });
    });
    // ink: each blot grows from nothing after its own delay
    blobRefs.current.forEach((c) => c?.setAttribute('r', '0'));
    const t0 = performance.now() + (s.reduced ? -5000 : 520);
    let raf = 0;
    const ink = (now: number) => {
      BLOBS.forEach(([, , delay], i) => {
        const p = Math.min(1, Math.max(0, (now - t0 - delay) / 1250));
        blobRefs.current[i]?.setAttribute('r', String(720 * (1 - (1 - p) ** 3)));
      });
      if (now - t0 < 2400) raf = requestAnimationFrame(ink);
    };
    raf = requestAnimationFrame(ink);
    document.documentElement.style.overflow = 'hidden';
    sheet.querySelector<HTMLButtonElement>('[data-close]')?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [openIndex]);

  const closeDetail = useCallback(() => {
    const sheet = sheetRef.current;
    const s = m.current;
    if (!sheet || !s.open) return;
    const r = coverRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const inset = `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px round 3px)`;
    sheet.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
    sheet.getAnimations().forEach((a) => a.cancel());
    const anim = sheet.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }, { clipPath: inset, transform: 'rotate(-4.5deg)' }],
      { duration: s.reduced ? 1 : 850, easing: SHEET_EASE, fill: 'both' },
    );
    anim.finished.then(() => {
      s.open = false;
      document.documentElement.style.overflow = '';
      setOpenIndex(null);
      playRef.current?.focus({ preventScroll: true });
    }).catch(() => undefined);
  }, []);

  /* ---- the frame loop */
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const s = m.current;
    s.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    measure();
    swapCaption(s.active, 0);
    moveIndicator(s.active);
    const ro = new ResizeObserver(() => { measure(); moveIndicator(s.active); });
    ro.observe(root);

    let raf = 0, prev = 0, visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(root);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60;
      prev = now;
      if (!visible && !s.open) return;
      const k = s.reduced ? 1e3 : s.drag?.moved ? 18 : 5.2;
      s.s += (s.T - s.s) * (1 - Math.exp(-k * dt));
      if (Math.abs(s.T - s.s) < 1e-4) s.s = s.T;
      const loop = V;
      if (Math.abs(s.s - start) > loop * 2) { const shift = Math.round((s.s - start) / loop) * loop; s.s -= shift; s.T -= shift; }

      const act = mod(Math.round(s.s), N);
      if (act !== s.active) {
        const dir = Math.sign(s.T - s.s) || 1;
        s.active = act;
        swapCaption(act, dir);
        moveIndicator(act);
        setActive(act);
      }

      // cursor and tilt
      const cyShelf = s.Hs / 2;
      const settled = Math.abs(s.T - s.s) < 0.3;
      s.onCover = s.inside && !s.open && settled && Math.abs(s.mx - s.W / 2) < 0.55 * s.d && Math.abs(s.my - cyShelf) < 0.55 * s.H;
      let ty: number, tx: number;
      if (s.onCover) { ty = ((s.mx - s.W / 2) / (0.55 * s.d)) * 9; tx = (-(s.my - cyShelf) / (s.H / 2)) * 6; }
      else { ty = s.inside ? ((s.mx - s.W / 2) / s.W) * 5 : 0; tx = 0; }
      const te = 1 - Math.exp(-7 * dt);
      s.tiltY += (ty - s.tiltY) * te;
      s.tiltX += (tx - s.tiltX) * te;

      const unit = s.ws + s.gap;
      const extra = s.d - s.ws + 1.6 * s.gap;
      const limit = s.W / 2 + 1.5 * s.d;
      const le = s.reduced ? 1 : 1 - Math.exp(-12 * dt);
      for (let v = 0; v < V; v++) {
        const el = tapeRefs.current[v];
        if (!el) continue;
        const r = mod(v - s.s + V / 2, V) - V / 2;
        const x = r * unit + extra * B(r);
        if (Math.abs(x) > limit) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        const liftT = s.hover === v && Math.abs(r) > 0.5 ? 1 : 0;
        s.lifts[v] += (liftT - s.lifts[v]) * le;
        const y = -o * 0.025 * s.H - s.lifts[v] * 0.045 * s.H;
        const z = o * 0.2 * s.H;
        el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateZ(${(-4.5 * o).toFixed(3)}deg) rotateX(${(s.tiltX * o).toFixed(3)}deg) rotateY(${(-90 * o + s.tiltY * o).toFixed(3)}deg)`;
        el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
        el.style.setProperty('--o', o.toFixed(3));
      }

      // play ring
      const play = playRef.current;
      if (play) {
        const sc = s.open ? 0 : smooth(Math.max(0, 1 - Math.abs(s.T - s.s) * 3));
        play.style.left = `${s.W / 2 - 0.5 * s.d - 6}px`;
        play.style.top = `${cyShelf + 0.36 * s.H}px`;
        play.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
      }

      // custom cursor
      const cur = cursorRef.current;
      if (cur) {
        const ce = 1 - Math.exp(-16 * dt);
        const rect = root.getBoundingClientRect();
        const gx = s.mx + rect.left, gy = s.my + rect.top;
        if (s.cx < -1e3) { s.cx = gx; s.cy = gy; }
        s.cx += (gx - s.cx) * ce; s.cy += (gy - s.cy) * ce;
        cur.style.transform = `translate3d(${s.cx.toFixed(1)}px,${s.cy.toFixed(1)}px,0)`;
        cur.style.visibility = s.inside && !s.open ? 'visible' : 'hidden';
        cur.dataset.state = s.onCover ? 'open' : s.hover >= 0 ? 'spine' : 'default';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [N, V, start, measure, swapCaption, moveIndicator]);

  /* ---- input */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = m.current;
    const local = (e: PointerEvent | MouseEvent) => { const r = root.getBoundingClientRect(); s.mx = e.clientX - r.left; s.my = e.clientY - r.top; };
    const onMove = (e: PointerEvent) => {
      local(e);
      if (s.drag) {
        const dx = e.clientX - s.drag.x;
        if (!s.drag.moved && Math.abs(dx) > 5) s.drag.moved = true;
        if (s.drag.moved) s.T = s.drag.T0 - dx / (s.ws + s.gap);
      }
    };
    const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') s.inside = true; local(e); };
    const onLeave = () => { s.inside = false; s.hover = -1; };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.shelf}`)) return;
      s.drag = { x: e.clientX, T0: s.T, moved: false };
    };
    const onUp = () => {
      if (!s.drag) return;
      if (s.drag.moved) { s.T = Math.round(s.T); s.suppressClick = true; window.setTimeout(() => { s.suppressClick = false; }, 0); }
      s.drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (s.open || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scroll keeps scrolling the page
      e.preventDefault();
      s.T += (e.deltaX / (s.ws + s.gap)) * 0.5;
      window.clearTimeout(s.wheelTimer);
      s.wheelTimer = window.setTimeout(() => { s.T = Math.round(s.T); }, 160);
    };
    const onKey = (e: KeyboardEvent) => {
      if (s.open) { if (e.key === 'Escape') closeDetail(); return; }
      const within = root.contains(document.activeElement) || (s.inside && document.activeElement === document.body);
      if (!within) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Enter' && document.activeElement === document.body) openDetail();
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    const onWindowMove = (e: PointerEvent) => { if (s.drag && !root.contains(e.target as Node)) onMove(e); };
    window.addEventListener('pointermove', onWindowMove);
    root.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onWindowMove);
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [step, openDetail, closeDetail]);

  const onTapeClick = (v: number) => {
    const s = m.current;
    if (s.suppressClick) return;
    const r = mod(v - s.s + V / 2, V) - V / 2;
    if (Math.abs(r) < 0.5) openDetail();
    else goTo(Math.round(s.T + r));
  };

  const shown = openIndex === null ? null : entries[openIndex];
  const arranged = shown ? arrange(shown) : { left: [], right: [], below: [] };
  const [d0, d1, d2] = shown ? hex(shown.shelf.dark) : [0, 0, 0];
  const [l0, l1, l2] = shown ? hex(shown.shelf.light) : [1, 1, 1];

  return (
    <section ref={rootRef} className={`${styles.root} ${serif.variable}`} aria-label="Experience shelf">
      <nav className={styles.tabs} aria-label="Years">
        <div ref={tabsRef} className={styles.tabRow}>
          <span ref={indRef} className={styles.ind} aria-hidden="true" />
          <button type="button" className={styles.tab} onClick={() => goYear(null)}>All</button>
          {years.map((y) => (
            <button key={y} type="button" className={styles.tab} data-year={y} onClick={() => goYear(y)}>{y}</button>
          ))}
        </div>
      </nav>

      <div className={styles.shelf}>
        <div ref={stageRef} className={styles.stage}>
          {Array.from({ length: V }, (_, v) => {
            const i = v % N;
            const e = entries[i];
            return (
              <div
                key={v}
                ref={(el) => { tapeRefs.current[v] = el; }}
                className={styles.tape}
                aria-hidden="true"
                onPointerEnter={() => { m.current.hover = v; }}
                onPointerLeave={() => { if (m.current.hover === v) m.current.hover = -1; }}
                onClick={() => onTapeClick(v)}
              >
                <Spine entry={e} />
                <Cover entry={e} index={i} total={N} />
              </div>
            );
          })}
        </div>
      </div>

      <button ref={playRef} type="button" className={styles.play} onClick={openDetail} aria-label={`Open ${entries[active].organization}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor" /></svg>
      </button>

      <div className={styles.caption} aria-live="polite">
        {[styles.capTitle, styles.capSub, styles.capYear].map((cls, k) => (
          <div key={k} ref={(el) => { capRefs.current[k] = el; }} className={`${styles.capMask} ${cls} ${k === 0 ? serif.className : ''}`} />
        ))}
      </div>

      <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous experience">
        <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><path d="M5 1 L1 5 L5 9 M1 5 H17" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
      <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => step(1)} aria-label="Next experience">
        <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><path d="M13 1 L17 5 L13 9 M17 5 H1" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>

      {/* keyboard and screen-reader route to every experience */}
      <ul className={styles.sr}>
        {entries.map((e, i) => (
          <li key={e.id}>
            <button type="button" onClick={() => { const s = m.current; const cur = mod(Math.round(s.T), N); goTo(Math.round(s.T) + (i - cur)); window.setTimeout(openDetail, s.reduced ? 0 : 900); }}>
              Open {e.title}, {e.organization}
            </button>
          </li>
        ))}
      </ul>

      <div ref={cursorRef} className={styles.cursor} aria-hidden="true" data-state="default">
        <span className={styles.ring} />
        <span className={styles.dot} />
        <span className={styles.openLbl}>OPEN</span>
      </div>

      {mounted && shown
        ? createPortal(
            <div ref={sheetRef} className={`${styles.sheet} ${serif.variable}`} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
              <button type="button" data-close="" className={styles.close} onClick={closeDetail}>Close</button>
              <div className={styles.sheetBrand} aria-hidden="true">
                <span>MADHAV MALPANI</span>
                <span>EXPERIENCE</span>
              </div>
              <div className={styles.sheetGrid}>
                <div ref={linesRef} className={styles.sheetText}>
                  <div className={styles.mask}><span data-rise="" className={styles.sSub}>{shown.organization}{shown.descriptor ? ` / ${shown.descriptor}` : ''}</span></div>
                  <div className={styles.mask}><h2 data-rise="" id={`${uid}-title`} className={`${styles.sTitle} ${serif.className}`}>{shown.title}</h2></div>
                  <div className={styles.mask}><span data-rise="" className={styles.sMeta}>{[shown.dates ?? shown.shelf.year, shown.current ? 'Current' : null].filter(Boolean).join(' / ')}</span></div>
                  <div className={styles.mask}><p data-rise="" className={`${styles.sBody} ${serif.className}`}>{shown.intro}</p></div>
                  {shown.achievement ? <div className={styles.mask}><p data-rise="" className={styles.sWin}>{shown.achievement}</p></div> : null}
                  <div className={styles.mask}><span data-rise="" className={styles.sLabel}>{shown.project ? 'My part' : 'What I did'}</span></div>
                  {shown.points.map((p) => (
                    <div key={p} className={styles.mask}><p data-rise="" className={styles.sPoint}>{p}</p></div>
                  ))}
                  {shown.project ? (
                    <>
                      <div className={styles.mask}><span data-rise="" className={styles.sLabel}>{shown.project.heading}</span></div>
                      {shown.project.points.map((p) => (
                        <div key={p} className={styles.mask}><p data-rise="" className={styles.sPoint}>{p}</p></div>
                      ))}
                    </>
                  ) : null}
                  {shown.links?.length ? (
                    <div className={styles.mask}>
                      <div data-rise="" className={styles.sLinks}>
                        {shown.links.map((l) => l.internal ? (
                          <Link key={l.href} href={l.href} className={styles.sLink}>{l.label}</Link>
                        ) : (
                          <a key={l.href} href={l.href} className={styles.sLink} target="_blank" rel="noreferrer">{l.label} ↗</a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.cluster} data-sides={arranged.left.length}>
                {arranged.left.map((item, i) => <Tile key={`l${i}`} item={item} place={`left-${i}`} />)}
                <div className={styles.poster} aria-hidden="true">
                  <svg viewBox="0 0 474 900" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <filter id={`${uid}-ink`} x="-50%" y="-50%" width="200%" height="200%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7" result="n" />
                        <feDisplacementMap in="SourceGraphic" in2="n" scale="120" xChannelSelector="R" yChannelSelector="G" />
                      </filter>
                      <filter id={`${uid}-duo`} colorInterpolationFilters="sRGB">
                        <feColorMatrix type="saturate" values="0" />
                        <feComponentTransfer>
                          <feFuncR type="table" tableValues={`${d0} ${l0}`} />
                          <feFuncG type="table" tableValues={`${d1} ${l1}`} />
                          <feFuncB type="table" tableValues={`${d2} ${l2}`} />
                        </feComponentTransfer>
                      </filter>
                      <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="-200" y="-200" width="874" height="1300">
                        <g filter={`url(#${uid}-ink)`}>
                          {BLOBS.map(([cx, cy], i) => (
                            <circle key={i} ref={(el) => { blobRefs.current[i] = el; }} cx={cx} cy={cy} r="0" fill="#fff" />
                          ))}
                        </g>
                      </mask>
                      <clipPath id={`${uid}-clip`}><rect width="474" height="900" /></clipPath>
                    </defs>
                    <g clipPath={`url(#${uid}-clip)`} mask={`url(#${uid}-mask)`}>
                      <rect width="474" height="900" fill={shown.shelf.card} />
                      <image href={shown.shelf.poster} x="0" y="150" width="474" height="560" preserveAspectRatio="xMidYMid slice" filter={`url(#${uid}-duo)`} />
                      <text x="24" y="54" className={styles.pTop} fill={shown.shelf.type}>A MADHAV MALPANI EXPERIENCE</text>
                      <text x="24" y="128" className={styles.pTitle} fill={shown.shelf.type}>{shown.shelf.short}</text>
                      <text x="24" y="770" className={styles.pRole} fill={shown.shelf.type}>{shown.title.toUpperCase().slice(0, 34)}</text>
                      <rect x="378" y="826" width="72" height="44" fill="none" stroke={shown.shelf.type} strokeWidth="2" />
                      <text x="414" y="855" textAnchor="middle" className={styles.pBadge} fill={shown.shelf.type}>{shown.shelf.year}</text>
                    </g>
                  </svg>
                </div>
                {arranged.right.map((item, i) => <Tile key={`r${i}`} item={item} place={`right-${i}`} />)}
                {arranged.below.length ? (
                  <div className={styles.below}>
                    {arranged.below.map((item, i) => <Tile key={`b${i}`} item={item} place="below" />)}
                  </div>
                ) : null}
                {shown.gallery.some((g) => 'note' in g && g.note) ? (
                  <p className={styles.notes}>
                    {shown.gallery.map((g) => ('note' in g ? g.note : null)).filter(Boolean).join(' ')}
                  </p>
                ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
