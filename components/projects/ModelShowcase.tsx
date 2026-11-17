'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Project } from '@/data/site-data';
import aqmManifest from '@/data/models/aqm.manifest.json';
import type { ExplodeManifest, ExplodeStage, Stage, WalkerManifest } from '@/lib/three/scenes';
import styles from './ModelShowcase.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Loads three.js and the model only when the scene is close to the viewport,
 * pauses rendering while it is off screen and frees the GPU on unmount.
 */
function useLazyStage<T extends Stage>(
  hostRef: RefObject<HTMLElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  create: (canvas: HTMLCanvasElement, reducedMotion: boolean) => Promise<T>,
) {
  // Known only after mount: reading it during render would make the hydrated
  // markup differ from the server HTML.
  const prefersReduced = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => setReduceMotion(Boolean(prefersReduced)), [prefersReduced]);
  const [status, setStatus] = useState<Status>('idle');
  const stageRef = useRef<T | null>(null);
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      if (!hasWebGL()) {
        setStatus('failed');
        return;
      }
      setStatus('loading');
      createRef
        .current(canvas, reduceMotion)
        .then((stage) => {
          if (cancelled) {
            stage.dispose();
            return;
          }
          stageRef.current = stage;
          setStatus('ready');
        })
        .catch(() => !cancelled && setStatus('failed'));
    };

    const near = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), {
      rootMargin: '800px 0px',
    });
    near.observe(host);
    const onScreen = new IntersectionObserver((entries) =>
      entries.forEach((e) => stageRef.current?.setVisible(e.isIntersecting)),
    );
    onScreen.observe(canvas);

    return () => {
      cancelled = true;
      near.disconnect();
      onScreen.disconnect();
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [hostRef, canvasRef, reduceMotion]);

  return { status, stageRef, reduceMotion };
}

function InspectControls({
  stage,
  inspecting,
  onToggle,
}: {
  stage: RefObject<Stage | null>;
  inspecting: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.controls} role="group" aria-label="3D model controls">
      <button type="button" className={styles.control} aria-pressed={inspecting} onClick={onToggle}>
        <Icon name="rotate" size={14} />
        {inspecting ? 'Done' : 'Rotate & zoom'}
      </button>
      {inspecting ? (
        <>
          <button type="button" className={styles.iconButton} aria-label="Zoom in" onClick={() => stage.current?.zoom(0.85)}>
            +
          </button>
          <button type="button" className={styles.iconButton} aria-label="Zoom out" onClick={() => stage.current?.zoom(1.18)}>
            −
          </button>
          <button type="button" className={styles.iconButton} aria-label="Reset view" onClick={() => stage.current?.reset()}>
            <Icon name="reset" size={14} />
          </button>
        </>
      ) : null}
    </div>
  );
}

function Fallback({ project }: { project: Project }) {
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;
  if (!hero) return null;
  return (
    <div className={styles.fallback}>
      <Image src={hero.src} alt={hero.alt} fill sizes="(max-width: 900px) 100vw, 900px" quality={70} />
    </div>
  );
}

type Place = { index: number; total: number };

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * What every showcase shows beneath its scene: project number, category and
 * status, title, short description, technical tags and the Case Study button.
 */
function Caption({ project, note, shown, index, total }: { project: Project; note?: string; shown: boolean } & Place) {
  return (
    <div className={styles.caption} data-shown={shown}>
      <div className={styles.captionHead}>
        <div className={styles.meta}>
          <span className={styles.index} aria-label={`Project ${index} of ${total}`}>
            {pad2(index)}
            <span aria-hidden="true">/{pad2(total)}</span>
          </span>
          <span className="label">{project.category}</span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className={styles.title}>{project.title}</h3>
      </div>
      <p className={styles.teaser}>{project.teaser}</p>
      <ul className={`tag-list ${styles.chips}`}>
        {project.chips.map((chip) => (
          <li key={chip} className="tag">
            {chip}
          </li>
        ))}
      </ul>
      <div className={styles.captionFoot}>
        <Link href={`/projects/${project.slug}`} className="button button-primary">
          Description / Case Study
          <Icon name="arrow-right" size={15} />
        </Link>
        {note ? <span className={styles.note}>{note}</span> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ walkers --
type WalkerProps = Place & {
  project: Project;
  src: string;
  /** Loaded with the scene, so the gait data stays out of the page's initial JavaScript. */
  loadManifest: () => Promise<WalkerManifest>;
  /** Model yaw that makes the robot face screen-left. */
  facing: number;
  framing?: { distance?: number; target?: number };
  label: string;
  note: string;
};

/** A legged robot walking in from the right on its baked, IK-solved gait. */
function WalkerShowcase({ project, src, loadManifest, facing, framing, label, note, index, total }: WalkerProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arrived, setArrived] = useState(false);
  const [inspecting, setInspecting] = useState(false);

  const { status, stageRef, reduceMotion } = useLazyStage<Stage>(hostRef, canvasRef, async (canvas, reduced) => {
    const [{ createWalkerStage }, manifest] = await Promise.all([import('@/lib/three/scenes'), loadManifest()]);
    return createWalkerStage({ canvas, reducedMotion: reduced, manifest, src, facing, framing });
  });

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    stageRef.current?.setProgress(p);
    setArrived(p > 0.6);
  });
  useEffect(() => {
    if (status === 'ready') stageRef.current?.setProgress(scrollYProgress.get());
  }, [status, stageRef, scrollYProgress]);

  const settled = reduceMotion || arrived || status === 'failed';
  const toggle = () => {
    const next = !inspecting;
    setInspecting(next);
    stageRef.current?.setInspect(next);
  };

  return (
    <section ref={hostRef} className={`${styles.scene} ${styles.walk}`} data-static={reduceMotion} aria-label={`${project.title}, 3D model`}>
      <div className={styles.stage}>
        <div className={styles.view}>
          <canvas ref={canvasRef} className={styles.canvas} data-inspecting={inspecting} aria-label={label} role="img" />
          {status === 'failed' ? <Fallback project={project} /> : null}
          {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
          {status === 'ready' && settled ? <InspectControls stage={stageRef} inspecting={inspecting} onToggle={toggle} /> : null}
        </div>
        <Caption project={project} shown={settled} note={note} index={index} total={total} />
      </div>
    </section>
  );
}

export function HexapodShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <WalkerShowcase
      project={project}
      index={index}
      total={total}
      src="/models/hexapod.glb"
      loadManifest={() => import('@/data/models/hexapod.manifest.json').then((m) => m.default)}
      facing={Math.PI / 2}
      label="3D model of the hexapod. Turn on Rotate & zoom to inspect it."
      note="CAD reconstruction from the printed parts. The tripod gait is solved with inverse kinematics; the robot itself is still learning to walk."
    />
  );
}

export function QuadrupedShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <WalkerShowcase
      project={project}
      index={index}
      total={total}
      src="/models/quadruped.glb"
      loadManifest={() => import('@/data/models/quadruped.manifest.json').then((m) => m.default)}
      facing={Math.PI}
      framing={{ distance: 1.6, target: 0.38 }}
      label="3D model of the quadruped. Turn on Rotate & zoom to inspect it."
      note="Assembled in CAD from the original printed-part files, joint by joint from their holes. The crawl gait is solved with inverse kinematics and checked for static stability; the physical robot is still being brought up."
    />
  );
}

// ----------------------------------------------------------------- exploded --
type ExplodeProps = Place & {
  project: Project;
  src: string;
  /** Labels for the component groups, known up front so they render with the page. */
  labels: Record<string, string>;
  loadManifest: () => Promise<ExplodeManifest>;
  /** Groups with no tag (the reference body). */
  unlabelled: string[];
  /** Entry slide, open-out timeline and camera for the scroll-driven version. */
  dynamic?: NonNullable<Parameters<typeof import('@/lib/three/scenes').createExplodedStage>[0]['dynamic']>;
  /** Scroll fractions at which the caption appears and at which the model counts as open. */
  arriveAt: number;
  openAt: number;
  height: 'tall' | 'long';
  /** `column` lines the tags up beside the model with leader lines, so none sits on top of it. */
  labelMode?: 'anchor' | 'column';
  label: string;
  note: string;
};

function ExplodeShowcase({
  project,
  src,
  labels: labelMap,
  loadManifest,
  unlabelled,
  dynamic,
  arriveAt,
  openAt,
  height,
  labelMode = 'anchor',
  label,
  note,
  index,
  total,
}: ExplodeProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const [mode, setMode] = useState<'scroll' | 'assembled' | 'exploded'>('scroll');
  const [active, setActive] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const [opened, setOpened] = useState(false);

  const { status, stageRef, reduceMotion } = useLazyStage<ExplodeStage>(hostRef, canvasRef, async (canvas, reduced) => {
    const [{ createExplodedStage }, manifest] = await Promise.all([import('@/lib/three/scenes'), loadManifest()]);
    const stage: ExplodeStage = await createExplodedStage({
      canvas,
      reducedMotion: reduced,
      manifest,
      src,
      unlabelled,
      dynamic,
      onFrame: () => placeLabels(stage),
    });
    return stage;
  });

  function placeLabels(stage: ExplodeStage | null) {
    const host = labelsRef.current;
    if (!host || !stage) return;
    const items = stage.labelPositions();
    const column = labelMode === 'column' && host.clientWidth >= 760;

    // Column mode: tags line up beside the model, nearest-to-anchor order, with a minimum gap
    const place = new Map<string, { x: number; y: number; ax: number; ay: number; edge: number }>();
    if (column) {
      const b = stage.bounds();
      const right = b.right + 190 <= host.clientWidth - 8;
      const sorted = [...items].sort((p, q) => p.y - q.y);
      let last = -Infinity;
      for (const it of sorted) {
        const el = host.querySelector<HTMLElement>(`[data-id="${it.id}"]`);
        if (!el) continue;
        const w = el.offsetWidth;
        const y = Math.min(host.clientHeight - 26, Math.max(18, Math.max(it.y, last + 34)));
        last = y;
        const edge = right ? b.right + 30 : b.left - 30;
        place.set(it.id, { x: right ? edge + w / 2 : edge - w / 2, y, ax: it.x, ay: it.y, edge });
      }
    }

    for (const p of items) {
      const el = host.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
      if (!el) continue;
      const pl = place.get(p.id);
      // keep every tag fully inside the frame
      const half = el.offsetWidth / 2 + 6;
      const x = pl ? pl.x : Math.min(host.clientWidth - half, Math.max(half, p.x));
      const y = pl ? pl.y : p.y;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.dataset.visible = String(p.visible);
      const line = host.querySelector<SVGGElement>(`[data-line="${p.id}"]`);
      if (line) {
        const l = line.querySelector('line');
        const c = line.querySelector('circle');
        if (pl && l && c) {
          l.setAttribute('x1', pl.edge.toFixed(1));
          l.setAttribute('y1', pl.y.toFixed(1));
          l.setAttribute('x2', pl.ax.toFixed(1));
          l.setAttribute('y2', pl.ay.toFixed(1));
          c.setAttribute('cx', pl.ax.toFixed(1));
          c.setAttribute('cy', pl.ay.toFixed(1));
        }
        line.dataset.visible = String(p.visible && Boolean(pl));
      }
    }
  }

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    stageRef.current?.setProgress(p);
    setArrived(p > arriveAt);
    setOpened(p > openAt);
  });
  useEffect(() => {
    if (status === 'ready') stageRef.current?.setProgress(scrollYProgress.get());
  }, [status, stageRef, scrollYProgress]);
  useEffect(() => {
    stageRef.current?.setHighlight(active);
  }, [active, stageRef]);

  const choose = (m: 'assembled' | 'exploded') => {
    setMode(m);
    stageRef.current?.setExplode(m === 'exploded' ? 1 : 0);
  };
  const toggle = () => {
    const next = !inspecting;
    setInspecting(next);
    stageRef.current?.setInspect(next);
  };

  const tags = Object.entries(labelMap).filter(([id]) => !unlabelled.includes(id));
  const settled = reduceMotion || arrived || status === 'failed';
  const isOpen = reduceMotion || opened;

  return (
    <section ref={hostRef} className={`${styles.scene} ${height === 'long' ? styles.long : styles.explode}`} data-static={reduceMotion} aria-label={`${project.title}, 3D model`}>
      <div className={styles.stage}>
        <div className={styles.view}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-inspecting={inspecting}
            role="img"
            aria-label={label}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse') setActive(stageRef.current?.pick(e.clientX, e.clientY) ?? null);
            }}
            onPointerLeave={() => setActive(null)}
            onClick={(e) => setActive(stageRef.current?.pick(e.clientX, e.clientY) ?? null)}
          />
          <div ref={labelsRef} className={styles.labels} aria-hidden={status !== 'ready'}>
            {labelMode === 'column' ? (
              <svg className={styles.leaders} aria-hidden="true">
                {tags.map(([id]) => (
                  <g key={id} data-line={id} data-visible="false" data-active={active === id}>
                    <line />
                    <circle r="2.5" />
                  </g>
                ))}
              </svg>
            ) : null}
            {tags.map(([id, text]) => (
              <button
                key={id}
                type="button"
                data-id={id}
                data-visible="false"
                data-active={active === id}
                className={styles.tag}
                onMouseEnter={() => setActive(id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(id)}
                onBlur={() => setActive(null)}
              >
                {text}
              </button>
            ))}
          </div>
          {status === 'ready' && isOpen ? <span className={styles.hint}>Tap a part to name it</span> : null}
          {status === 'failed' ? <Fallback project={project} /> : null}
          {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
          {status === 'ready' && settled ? (
            <div className={styles.toolbar}>
              <div className={styles.segment} role="group" aria-label="Assembly view">
                <button type="button" aria-pressed={mode === 'assembled'} onClick={() => choose('assembled')}>
                  Assembled
                </button>
                <button type="button" aria-pressed={mode === 'exploded' || (mode === 'scroll' && isOpen)} onClick={() => choose('exploded')}>
                  Exploded
                </button>
              </div>
              <InspectControls stage={stageRef} inspecting={inspecting} onToggle={toggle} />
            </div>
          ) : null}
        </div>
        <Caption project={project} shown={settled} note={note} index={index} total={total} />
      </div>
    </section>
  );
}

export function AqmShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <ExplodeShowcase
      project={project}
      index={index}
      total={total}
      src="/models/aqm.glb"
      labels={aqmManifest.labels}
      loadManifest={() => Promise.resolve(aqmManifest)}
      unlabelled={['enclosure_body']}
      arriveAt={0.5}
      openAt={0.5}
      height="tall"
      label="Exploded 3D model of the air quality monitor enclosure and its sensors."
      note="Proposed enclosure, designed in CAD around the real parts list. The working prototype is on a breadboard."
    />
  );
}

const hydroLabels: Record<string, string> = {
  lid: 'Lid',
  springs: 'Springs ×20',
  collars: 'Pipe attachments ×4',
  discs: 'Mesh discs ×4',
  tank: 'Tank body',
  pipes: 'Elbow pipes ×4',
};

export function HydroSafeShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <ExplodeShowcase
      project={project}
      index={index}
      total={total}
      src="/models/hydrosafe.glb"
      labels={hydroLabels}
      loadManifest={() => import('@/data/models/hydrosafe.manifest.json').then((m) => m.default)}
      unlabelled={[]}
      dynamic={{ entryEnd: 0.24, explodeStart: 0.42, explodeEnd: 0.8, azimuth: 0.7, elevation: 0.42 }}
      arriveAt={0.22}
      openAt={0.62}
      height="long"
      labelMode="column"
      label="3D model of the HydroSafe assembly. It opens out into its lid, springs, pipe attachments, mesh discs, tank and elbow pipes as you scroll."
      note="Assembled in CAD from the original part files. The lid and springs are shown at their rest position, worked out from the part geometry, since the CAD export leaves them unmated."
    />
  );
}

// ------------------------------------------------------------------ photos --
/**
 * Projects with no 3D model are presented the same way: the project photo
 * slides in from the side as you scroll, then the same caption and button.
 */
export function PhotoShowcase({ project, index, total }: { project: Project } & Place) {
  const hostRef = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();
  const [still, setStill] = useState(false);
  useEffect(() => setStill(Boolean(prefersReduced)), [prefersReduced]);
  const [arrived, setArrived] = useState(false);

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end end'] });
  const side = index % 2 === 0 ? -1 : 1;
  const x = useTransform(scrollYProgress, [0, 0.4], [`${side * 58}vw`, '0vw']);
  const opacity = useTransform(scrollYProgress, [0, 0.22], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.94, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setArrived(p > 0.36));

  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;

  return (
    <section ref={hostRef} className={`${styles.scene} ${styles.photoScene}`} data-static={still} aria-label={`${project.title}, project photo`}>
      <div className={styles.stage}>
        <div className={styles.view}>
          {hero ? (
            <div className={styles.photo}>
              <motion.div
                className={styles.photoFrame}
                style={{ ['--ratio' as string]: hero.width / hero.height, ...(still ? {} : { x, opacity, scale }) }}
              >
                <Image
                  src={hero.src}
                  alt={hero.alt}
                  fill
                  sizes="(max-width: 900px) 92vw, 980px"
                  quality={72}
                  className={styles.photoImage}
                />
              </motion.div>
            </div>
          ) : null}
        </div>
        <Caption project={project} shown={still || arrived} index={index} total={total} />
      </div>
    </section>
  );
}
