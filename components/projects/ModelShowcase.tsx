'use client';

import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
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
export function useLazyStage<T extends Stage>(
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
  const onScreenRef = useRef(true);
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
          stage.setVisible(onScreenRef.current); // it may have loaded while off screen
          setStatus('ready');
        })
        .catch(() => !cancelled && setStatus('failed'));
    };

    const near = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), {
      rootMargin: '800px 0px',
    });
    near.observe(host);
    const onScreen = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        onScreenRef.current = e.isIntersecting;
        stageRef.current?.setVisible(e.isIntersecting);
      }),
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

export function InspectControls({
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

export function Fallback({ project }: { project: Project }) {
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;
  if (!hero) return null;
  return (
    <div className={styles.fallback}>
      <Image src={hero.src} alt={hero.alt} fill sizes="(max-width: 900px) 100vw, 900px" quality={70} />
    </div>
  );
}

export type Place = { index: number; total: number };

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * What every showcase shows beneath its scene: project number, category and
 * status, title, short description, technical tags and the Case Study button.
 */
export function Caption({ project, note, shown, index, total }: { project: Project; note?: string; shown: boolean } & Place) {
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

/**
 * The text beside every paired-row project: plain type, and one button, "Case study". (The CubeSat keeps `Caption`.)
 */
export function TileCaption({ project, note, index, total }: { project: Project; note?: string } & Place) {
  return (
    <div className={styles.tileCaption}>
      <div className={styles.tileMeta}>
        <span className={styles.index} aria-label={`Project ${index} of ${total}`}>
          {pad2(index)}
          <span aria-hidden="true">/{pad2(total)}</span>
        </span>
        <span className="label">{project.category}</span>
        <StatusBadge status={project.status} />
      </div>
      <h3 className={styles.tileTitle}>{project.title}</h3>
      <p className={styles.tileTeaser}>{project.teaser}</p>
      <ul className={`tag-list ${styles.tileChips}`}>
        {project.chips.map((chip) => (
          <li key={chip} className="tag">
            {chip}
          </li>
        ))}
      </ul>
      <div className={styles.tileFoot}>
        <Link href={`/projects/${project.slug}`} className="button button-primary">
          Case study
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

/**
 * A legged robot that walks continuously on its baked, IK-solved gait. The cycle is driven by the clock alone: scrolling
 * only decides when the tile enters or leaves the screen (the scene pauses off screen and resumes from the same step).
 */
function WalkerTile({ project, src, loadManifest, facing, framing, label, note, index, total }: WalkerProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inspecting, setInspecting] = useState(false);

  const { status, stageRef } = useLazyStage<Stage>(hostRef, canvasRef, async (canvas, reduced) => {
    const [{ createWalkerStage }, manifest] = await Promise.all([import('@/lib/three/scenes'), loadManifest()]);
    return createWalkerStage({ canvas, reducedMotion: reduced, manifest, src, facing, framing, continuous: true });
  });

  const toggle = () => {
    const next = !inspecting;
    setInspecting(next);
    stageRef.current?.setInspect(next);
  };

  return (
    <section ref={hostRef} className={styles.tile} aria-label={`${project.title}, 3D model`}>
      <div className={styles.tileView}>
        <canvas ref={canvasRef} className={styles.canvas} data-inspecting={inspecting} aria-label={label} role="img" />
        {status === 'failed' ? <Fallback project={project} /> : null}
        {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
        {status === 'ready' ? <InspectControls stage={stageRef} inspecting={inspecting} onToggle={toggle} /> : null}
      </div>
      <TileCaption project={project} note={note} index={index} total={total} />
    </section>
  );
}

export function HexapodShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <WalkerTile
      project={project}
      index={index}
      total={total}
      src="/models/hexapod.glb"
      loadManifest={() => import('@/data/models/hexapod.manifest.json').then((m) => m.default)}
      facing={Math.PI / 2}
      framing={{ distance: 1.32 }}
      label="3D model of the hexapod, walking. Turn on Rotate & zoom to inspect it."
      note="CAD reconstruction from the printed parts. The tripod gait is solved with inverse kinematics; the robot itself is still learning to walk."
    />
  );
}

export function QuadrupedShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <WalkerTile
      project={project}
      index={index}
      total={total}
      src="/models/quadruped.glb"
      loadManifest={() => import('@/data/models/quadruped.manifest.json').then((m) => m.default)}
      facing={Math.PI}
      framing={{ distance: 1.95, target: 0.4 }}
      label="3D model of the quadruped, walking. Turn on Rotate & zoom to inspect it."
      note="Assembled in CAD from the original printed-part files, joint by joint from their holes. The trot and the jump are animations solved with inverse kinematics and checked for reach, joint range and collisions; they are not simulation results (the MuJoCo twin used a statically stable crawl and reports about 11 cm for its jump, the height drawn here). The physical robot is still being brought up."
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
  /** Camera and open-out timeline for the scene's own progress (0..1). */
  dynamic?: NonNullable<Parameters<typeof import('@/lib/three/scenes').createExplodedStage>[0]['dynamic']>;
  /** The part of the scene's progress that runs as the tile scrolls into view: assembled at the start, open at the end. */
  range: [number, number];
  /** Progress at which the model counts as open. */
  openAt: number;
  label: string;
  note: string;
};

function ExplodeTile({ project, src, labels: labelMap, loadManifest, unlabelled, dynamic, range, openAt, label, note, index, total }: ExplodeProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const [mode, setMode] = useState<'scroll' | 'assembled' | 'exploded'>('scroll');
  const [active, setActive] = useState<string | null>(null);
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

  // Tags follow their parts; in a half-width tile each one is shown only for the part being pointed at.
  function placeLabels(stage: ExplodeStage | null) {
    const host = labelsRef.current;
    if (!host || !stage) return;
    for (const p of stage.labelPositions()) {
      const el = host.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
      if (!el) continue;
      const half = el.offsetWidth / 2 + 6;
      const x = Math.min(host.clientWidth - half, Math.max(half, p.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      el.dataset.visible = String(p.visible);
    }
  }

  // The tile opens out as it rises into view (assembled when it enters, open by the time it is centred).
  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start end', 'center center'] });
  const progressAt = (t: number) => range[0] + Math.min(1, Math.max(0, t)) * (range[1] - range[0]);
  useMotionValueEvent(scrollYProgress, 'change', (t) => {
    const p = progressAt(t);
    stageRef.current?.setProgress(p);
    setOpened(p > openAt);
  });
  useEffect(() => {
    if (status === 'ready') stageRef.current?.setProgress(progressAt(scrollYProgress.get()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isOpen = reduceMotion || opened;

  return (
    <section ref={hostRef} className={styles.tile} aria-label={`${project.title}, 3D model`}>
      <div className={styles.tileView}>
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
        {status === 'ready' && isOpen ? <span className={styles.tileHint}>Hover or tap a part to name it</span> : null}
        {status === 'failed' ? <Fallback project={project} /> : null}
        {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
        {status === 'ready' ? (
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
      <TileCaption project={project} note={note} index={index} total={total} />
    </section>
  );
}

export function AqmShowcase({ project, index, total }: { project: Project } & Place) {
  return (
    <ExplodeTile
      project={project}
      index={index}
      total={total}
      src="/models/aqm.glb"
      labels={aqmManifest.labels}
      loadManifest={() => Promise.resolve(aqmManifest)}
      unlabelled={['enclosure_body']}
      range={[0.15, 0.72]}
      openAt={0.5}
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
    <ExplodeTile
      project={project}
      index={index}
      total={total}
      src="/models/hydrosafe.glb"
      labels={hydroLabels}
      loadManifest={() => import('@/data/models/hydrosafe.manifest.json').then((m) => m.default)}
      unlabelled={[]}
      dynamic={{ entryEnd: 0.24, explodeStart: 0.42, explodeEnd: 0.8, azimuth: 0.7, elevation: 0.42 }}
      range={[0.24, 0.82]}
      openAt={0.62}
      label="3D model of the HydroSafe assembly. It opens out into its lid, springs, pipe attachments, mesh discs, tank and elbow pipes as it scrolls into view."
      note="Assembled in CAD from the original part files. The lid and springs are shown at their rest position, worked out from the part geometry, since the CAD export leaves them unmated."
    />
  );
}

// ------------------------------------------------------------------ photos --
/** Projects with no 3D model are shown the same way, with their project photo in place of the model. */
export function PhotoShowcase({ project, index, total }: { project: Project } & Place) {
  const hero = project.heroMedia?.type === 'image' ? project.heroMedia : undefined;
  // Fill the frame when the picture is close to its shape; otherwise show all of it rather than crop it.
  const fits = hero ? Math.abs(hero.width / hero.height / (4 / 3) - 1) < 0.2 : true;
  return (
    <section className={styles.tile} aria-label={`${project.title}, project photo`}>
      <div className={styles.tileView} data-fit={fits ? 'cover' : 'contain'}>
        {hero ? (
          <Image src={hero.src} alt={hero.alt} fill sizes="(max-width: 860px) 92vw, 560px" quality={72} className={styles.tilePhoto} />
        ) : null}
      </div>
      <TileCaption project={project} index={index} total={total} />
    </section>
  );
}
