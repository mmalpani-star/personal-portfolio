'use client';

import { useMotionValueEvent, useScroll } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Project } from '@/data/site-data';
import type { CubesatManifest, CubesatStage, DeployState } from '@/lib/three/cubesat';
import { Caption, Fallback, InspectControls, useLazyStage } from './ModelShowcase';
import type { Place } from './ModelShowcase';
import styles from './ModelShowcase.module.css';

const LABELS: Record<string, string> = {
  frame: 'Frame',
  tape: 'Steel tape antenna',
  burn: 'Burn wire',
  nano: 'Arduino Nano',
  cell: '18650 cell',
};
/** Where each tag sits relative to the part it names, in pixels. */
const OFFSETS: Record<string, [number, number]> = {
  frame: [-120, 26],
  tape: [118, 44],
  burn: [-30, -104],
  nano: [-176, 8],
  cell: [-176, 56],
};

const DEPLOY_MESSAGE: Record<DeployState, string> = {
  stowed: 'Antenna stowed.',
  heating: 'Burn wire energised and heating.',
  releasing: 'Restraint cord severed. The tape antenna is springing out.',
  deployed: 'Antenna deployed.',
  stowing: 'Antenna retracting.',
};

/**
 * The 1U CubeSat: it flies up into frame in front of Earth, a burn wire cuts a restraint cord
 * and the coiled steel-tape antenna deploys. The page behind turns to deep space while the
 * satellite is on screen and back again as the section ends.
 */
export function CubesatShowcase({ project, index, total, standalone = false }: { project: Project } & Place & { standalone?: boolean }) {
  const hostRef = useRef<HTMLElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const [xray, setXray] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [dark, setDark] = useState(false);
  const [deploy, setDeploy] = useState<DeployState>('stowed');

  const { status, stageRef, reduceMotion } = useLazyStage<CubesatStage>(hostRef, canvasRef, async (canvas, reduced) => {
    const [{ createCubesatStage }, manifest] = await Promise.all([
      import('@/lib/three/cubesat'),
      import('@/data/models/cubesat.manifest.json').then((m) => m.default as unknown as CubesatManifest),
    ]);
    const small = window.innerWidth < 768;
    const stage: CubesatStage = await createCubesatStage({
      canvas,
      reducedMotion: reduced,
      manifest,
      src: '/models/cubesat.glb',
      earth: {
        day: small ? '/textures/earth/earth-day-1024.jpg' : '/textures/earth/earth-day-2048.jpg',
        clouds: '/textures/earth/earth-clouds-1024.jpg',
      },
      onSpace: (amount) => {
        stageEl.current?.style.setProperty('--space', amount.toFixed(3));
        setDark(amount > 0.5);
      },
      onDeploy: setDeploy,
      onFrame: () => placeLabels(stage),
    });
    return stage;
  });

  // Reduced motion: no scroll-linked motion, so the stage is simply in space with the antenna out.
  useEffect(() => {
    if (!reduceMotion) return;
    stageEl.current?.style.setProperty('--space', '1');
    setDark(true);
  }, [reduceMotion]);

  // The canvas fills the whole stage so Earth runs behind the caption; tell it where the model's area is.
  useEffect(() => {
    const stageNode = stageEl.current;
    const view = viewRef.current;
    if (!stageNode || !view) return;
    const measure = () => {
      const top = view.offsetTop;
      const below = Math.max(0, stageNode.clientHeight - top - view.clientHeight);
      stageNode.style.setProperty('--above', `${top}px`);
      stageNode.style.setProperty('--below', `${below}px`);
      stageRef.current?.setFrame(top + view.clientHeight / 2, view.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stageNode);
    ro.observe(view);
    return () => ro.disconnect();
  }, [stageRef, status]);

  function placeLabels(stage: CubesatStage | null) {
    const host = labelsRef.current;
    if (!host || !stage) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const wide = w >= 760;
    for (const it of stage.labelPositions()) {
      const el = host.querySelector<HTMLElement>(`[data-id="${it.id}"]`);
      const line = host.querySelector<SVGGElement>(`[data-line="${it.id}"]`);
      if (!el) continue;
      const [dx, dy] = OFFSETS[it.id] ?? [80, 0];
      const half = el.offsetWidth / 2 + 6;
      const x = Math.min(w - half, Math.max(half, it.x + dx));
      const y = Math.min(h - 26, Math.max(18, it.y + dy));
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.dataset.visible = String(it.visible && wide);
      if (line) {
        const ends = x - it.x;
        const l = line.querySelector('line');
        const c = line.querySelector('circle');
        if (l && c) {
          l.setAttribute('x1', (x - Math.sign(ends || 1) * (el.offsetWidth / 2)).toFixed(1));
          l.setAttribute('y1', y.toFixed(1));
          l.setAttribute('x2', it.x.toFixed(1));
          l.setAttribute('y2', it.y.toFixed(1));
          c.setAttribute('cx', it.x.toFixed(1));
          c.setAttribute('cy', it.y.toFixed(1));
        }
        line.dataset.visible = String(it.visible && wide);
      }
    }
  }

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    stageRef.current?.setProgress(p);
    setArrived(p > 0.36);
  });
  useEffect(() => {
    if (status === 'ready') stageRef.current?.setProgress(scrollYProgress.get());
  }, [status, stageRef, scrollYProgress]);

  const toggleInspect = () => {
    const next = !inspecting;
    setInspecting(next);
    stageRef.current?.setInspect(next);
  };
  const toggleXray = () => {
    const next = !xray;
    setXray(next);
    stageRef.current?.setXray(next);
  };

  const settled = reduceMotion || arrived || status === 'failed';
  const isDeployed = deploy === 'heating' || deploy === 'releasing' || deploy === 'deployed';
  const tags = Object.entries(LABELS);

  return (
    <section
      ref={hostRef}
      className={`${styles.scene} ${standalone ? '' : styles.space}`}
      data-static={reduceMotion}
      aria-label={`${project.title}, 3D model`}
    >
      <div ref={stageEl} className={styles.stage} data-space="" data-dark={dark} style={{ ['--space' as string]: 0 }}>
        <div className={styles.sky} aria-hidden="true" />
        <div ref={viewRef} className={styles.view}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-inspecting={inspecting}
            role="img"
            aria-label="3D model of a 1U CubeSat flying in front of Earth. A burn wire cuts a restraint cord and a coiled steel tape antenna springs out of the top face."
          />
          <div ref={labelsRef} className={styles.labels} aria-hidden="true">
            <svg className={styles.leaders}>
              {tags.map(([id]) => (
                <g key={id} data-line={id} data-visible="false">
                  <line />
                  <circle r="2.5" />
                </g>
              ))}
            </svg>
            {tags.map(([id, text]) => (
              <span key={id} data-id={id} data-visible="false" className={styles.tag}>
                {text}
              </span>
            ))}
          </div>
          {status === 'failed' ? <Fallback project={project} /> : null}
          {status === 'loading' ? <span className={styles.loading}>Loading model…</span> : null}
          {status === 'ready' && settled ? (
            <div className={styles.toolbar}>
              <div className={styles.segment} role="group" aria-label="Antenna state">
                <button type="button" aria-pressed={!isDeployed} onClick={() => stageRef.current?.setDeployed(false)}>
                  Stowed
                </button>
                <button type="button" aria-pressed={isDeployed} onClick={() => stageRef.current?.setDeployed(true)}>
                  Deployed
                </button>
              </div>
              <div className={styles.controls} role="group" aria-label="View options">
                {!reduceMotion ? (
                  <button type="button" className={styles.control} onClick={() => stageRef.current?.replay()}>
                    <Icon name="play" size={13} />
                    Replay
                  </button>
                ) : null}
                <button type="button" className={styles.control} aria-pressed={xray} onClick={toggleXray}>
                  X-ray
                </button>
              </div>
              <InspectControls stage={stageRef} inspecting={inspecting} onToggle={toggleInspect} />
            </div>
          ) : null}
          <span className={styles.sr} role="status" aria-live="polite">
            {status === 'ready' && settled ? DEPLOY_MESSAGE[deploy] : ''}
          </span>
        </div>
        <div className={styles.scrim} aria-hidden="true" />
        <Caption
          project={project}
          shown={settled}
          index={index}
          total={total}
          note="Electronics are the original CAD models. The frame, antenna cassette, burn wire and tape antenna are reconstructed, because the original files for them can't be read or don't exist. Release and deployment timing is illustrative. Earth imagery: Solar System Scope, CC BY 4.0."
        />
      </div>
    </section>
  );
}
