'use client';

import { useScroll, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Project } from '@/data/site-data';
import aqmManifest from '@/data/models/aqm.manifest.json';
import type { AqmStage, Stage, WalkerManifest } from '@/lib/three/scenes';
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

function Caption({ project, note, shown }: { project: Project; note: string; shown: boolean }) {
  return (
    <div className={styles.caption} data-shown={shown}>
      <div className={styles.captionHead}>
        <span className="label">{project.category.split(' / ')[0]}</span>
        <h3 className={styles.title}>{project.title}</h3>
      </div>
      <p className={styles.teaser}>{project.teaser}</p>
      <div className={styles.captionFoot}>
        <Link href={`/projects/${project.slug}`} className="button button-primary">
          Description / Case Study
          <Icon name="arrow-right" size={15} />
        </Link>
        <span className={styles.note}>{note}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ walkers --
type WalkerProps = {
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
function WalkerShowcase({ project, src, loadManifest, facing, framing, label, note }: WalkerProps) {
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
        <Caption project={project} shown={settled} note={note} />
      </div>
    </section>
  );
}

export function HexapodShowcase({ project }: { project: Project }) {
  return (
    <WalkerShowcase
      project={project}
      src="/models/hexapod.glb"
      loadManifest={() => import('@/data/models/hexapod.manifest.json').then((m) => m.default)}
      facing={Math.PI / 2}
      label="3D model of the hexapod. Turn on Rotate & zoom to inspect it."
      note="CAD reconstruction from the printed parts. The tripod gait is solved with inverse kinematics; the robot itself is still learning to walk."
    />
  );
}

export function QuadrupedShowcase({ project }: { project: Project }) {
  return (
    <WalkerShowcase
      project={project}
      src="/models/quadruped.glb"
      loadManifest={() => import('@/data/models/quadruped.manifest.json').then((m) => m.default)}
      facing={Math.PI}
      framing={{ distance: 1.6, target: 0.38 }}
      label="3D model of the quadruped. Turn on Rotate & zoom to inspect it."
      note="Assembled in CAD from the original printed-part files, joint by joint from their holes. The crawl gait is solved with inverse kinematics and checked for static stability; the physical robot is still being brought up."
    />
  );
}

// --------------------------------------------------------------------- aqm --
export function AqmShowcase({ project }: { project: Project }) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const [mode, setMode] = useState<'scroll' | 'assembled' | 'exploded'>('scroll');
  const [active, setActive] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const { status, stageRef, reduceMotion } = useLazyStage<AqmStage>(hostRef, canvasRef, async (canvas, reduced) => {
    const { createAqmStage } = await import('@/lib/three/scenes');
    const stage: AqmStage = await createAqmStage({
      canvas,
      reducedMotion: reduced,
      manifest: aqmManifest,
      src: '/models/aqm.glb',
      onFrame: () => placeLabels(stage),
    });
    return stage;
  });

  function placeLabels(stage: AqmStage | null) {
    const host = labelsRef.current;
    if (!host || !stage) return;
    for (const p of stage.labelPositions()) {
      const el = host.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
      if (!el) continue;
      // keep every tag fully inside the frame
      const half = el.offsetWidth / 2 + 6;
      const x = Math.min(host.clientWidth - half, Math.max(half, p.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      el.dataset.visible = String(p.visible);
    }
  }

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    stageRef.current?.setProgress(p);
    setOpened(p > 0.5);
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

  const labels = Object.entries(aqmManifest.labels).filter(([id]) => id !== 'enclosure_body');
  const settled = reduceMotion || opened || status === 'failed';

  return (
    <section ref={hostRef} className={`${styles.scene} ${styles.explode}`} data-static={reduceMotion} aria-label={`${project.title}, 3D model`}>
      <div className={styles.stage}>
        <div className={styles.view}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-inspecting={inspecting}
            role="img"
            aria-label="Exploded 3D model of the air quality monitor enclosure and its sensors."
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse') setActive(stageRef.current?.pick(e.clientX, e.clientY) ?? null);
            }}
            onPointerLeave={() => setActive(null)}
            onClick={(e) => setActive(stageRef.current?.pick(e.clientX, e.clientY) ?? null)}
          />
          <div ref={labelsRef} className={styles.labels} aria-hidden={status !== 'ready'}>
            {labels.map(([id, text]) => (
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
          {status === 'ready' && settled ? <span className={styles.hint}>Tap a part to name it</span> : null}
          {status === 'failed' ? <Fallback project={project} /> : null}
          {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
          {status === 'ready' ? (
            <div className={styles.toolbar}>
              <div className={styles.segment} role="group" aria-label="Assembly view">
                <button type="button" aria-pressed={mode === 'assembled'} onClick={() => choose('assembled')}>
                  Assembled
                </button>
                <button type="button" aria-pressed={mode === 'exploded' || (mode === 'scroll' && settled)} onClick={() => choose('exploded')}>
                  Exploded
                </button>
              </div>
              <InspectControls stage={stageRef} inspecting={inspecting} onToggle={toggle} />
            </div>
          ) : null}
        </div>
        <Caption
          project={project}
          shown={settled}
          note="Proposed enclosure, designed in CAD around the real parts list. The working prototype is on a breadboard."
        />
      </div>
    </section>
  );
}
