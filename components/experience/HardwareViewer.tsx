'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PcbViewer.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The four printed parts from the SanD Hacks hardware (`/models/sandhacks/hardware.glb`, built by
 * `cad/sandhacks/build.py` from the supplied Parasolid files), in two poses: ASSEMBLED (inferred from hole alignment and
 * the photo; the files carry no mates) and LAID OUT side by side (nothing inferred). The toggle slides between them.
 * Loaded only when it nears the viewport; drag to turn it. It turns slowly on its own unless motion is reduced.
 */
export function HardwareViewer({ label, ratio = '1 / 1' }: { label: string; ratio?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState(false);
  const [mode, setMode] = useState<'assembled' | 'laid'>('assembled');
  const modeRef = useRef<'assembled' | 'laid'>('assembled');
  const wakeRef = useRef<() => void>(() => {});
  const choose = (m: 'assembled' | 'laid') => {
    modeRef.current = m;
    setMode(m);
    wakeRef.current();
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let dispose: (() => void) | null = null;
    let started = false;

    const start = async () => {
      if (started) return;
      started = true;
      setStatus('loading');
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
        if (cancelled) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 0.88;
        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.45;
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a4, 0.4));
        const key = new THREE.DirectionalLight(0xffffff, 1.35);
        key.position.set(-2, 4, 3);
        scene.add(key);
        const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

        const gltf = await new GLTFLoader().loadAsync('/models/sandhacks/hardware.glb');
        if (cancelled) {
          renderer.dispose();
          return;
        }

        // Each part carries both placements (written by build.py); the viewer blends between them.
        type Place = { t: [number, number, number]; q: [number, number, number, number] };
        const pieces = gltf.scene.children.filter((c) => c.userData?.assembled && c.userData?.laid);
        const place = (which: 'assembled' | 'laid') => pieces.forEach((c) => {
          const pl = c.userData[which] as Place;
          c.position.set(...pl.t);
          c.quaternion.set(...pl.q);
        });
        const union = new THREE.Box3();
        // Framed on the assembled pose (the longer one); the laid-out pose is smaller and fits inside it.
        place('assembled');
        gltf.scene.updateMatrixWorld(true);
        union.union(new THREE.Box3().setFromObject(gltf.scene));
        const centre = union.getCenter(new THREE.Vector3());
        const radius = union.getSize(new THREE.Vector3()).length() / 2 || 1;
        // A soft shadow under the parts so the pale ones read against the page.
        const sc = document.createElement('canvas');
        sc.width = sc.height = 128;
        const sg = sc.getContext('2d')!;
        const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(13,13,13,0.34)');
        grad.addColorStop(0.6, 'rgba(13,13,13,0.14)');
        grad.addColorStop(1, 'rgba(13,13,13,0)');
        sg.fillStyle = grad;
        sg.fillRect(0, 0, 128, 128);
        const shadowTex = new THREE.CanvasTexture(sc);
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(radius * 2.2, radius * 2.2),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, union.min.y - 0.002, 0);
        const world = new THREE.Group();
        world.add(gltf.scene);
        world.add(shadow);
        world.position.sub(centre);
        const pivot = new THREE.Group();
        pivot.add(world);
        pivot.scale.setScalar(1 / radius);
        scene.add(pivot);

        // blend: 1 = assembled, 0 = laid out
        const qa = new THREE.Quaternion();
        const qb = new THREE.Quaternion();
        let blend = modeRef.current === 'assembled' ? 1 : 0;
        const applyBlend = () => {
          const e = blend * blend * (3 - 2 * blend);
          pieces.forEach((c) => {
            const a = c.userData.assembled as Place;
            const l = c.userData.laid as Place;
            c.position.set(l.t[0] + (a.t[0] - l.t[0]) * e, l.t[1] + (a.t[1] - l.t[1]) * e, l.t[2] + (a.t[2] - l.t[2]) * e);
            qa.set(...l.q);
            qb.set(...a.q);
            c.quaternion.copy(qa.slerp(qb, e));
          });
        };
        applyBlend();

        let yaw = -0.4;
        let pitch = 0.95;
        let vel = 0;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let visible = true;
        let raf = 0;
        let last = performance.now();

        const resize = () => {
          const w = canvas.clientWidth || 1;
          const h = canvas.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          camera.position.set(0, 0, Math.max(1.05 / tan, 1.05 / (tan * camera.aspect)));
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        resize();

        const frame = (now: number) => {
          raf = 0;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          if (!dragging) {
            vel *= Math.exp(-dt * 3);
            yaw += vel * dt + (reduced ? 0 : 0.2 * dt);
          }
          const goal = modeRef.current === 'assembled' ? 1 : 0;
          const moving = Math.abs(goal - blend) > 0.002;
          if (moving) {
            blend += Math.sign(goal - blend) * Math.min(Math.abs(goal - blend), dt * (reduced ? 20 : 1.4));
            applyBlend();
          }
          pivot.rotation.set(pitch, yaw, 0, 'XYZ');
          renderer.render(scene, camera);
          if (visible && !reduced) raf = requestAnimationFrame(frame);
          else if (visible && (dragging || moving || Math.abs(vel) > 0.01)) raf = requestAnimationFrame(frame);
        };
        const wake = () => {
          if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        };
        wakeRef.current = wake;
        const down = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          canvas.setPointerCapture(e.pointerId);
          setTouched(true);
          wake();
        };
        const move = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          yaw += dx * 0.012;
          pitch = Math.max(0.15, Math.min(1.5, pitch + dy * 0.008));
          vel = dx * 0.012 * 60;
          wake();
        };
        const up = () => {
          dragging = false;
          wake();
        };
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        const io = new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) wake();
        });
        io.observe(canvas);
        wake();
        setStatus('ready');

        dispose = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          io.disconnect();
          canvas.removeEventListener('pointerdown', down);
          canvas.removeEventListener('pointermove', move);
          canvas.removeEventListener('pointerup', up);
          canvas.removeEventListener('pointercancel', up);
          gltf.scene.traverse((o) => {
            const mesh = o as import('three').Mesh;
            if (mesh.isMesh) {
              mesh.geometry.dispose();
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
            }
          });
          shadowTex.dispose();
          env.dispose();
          renderer.dispose();
        };
      } catch {
        if (!cancelled) setStatus('failed');
      }
    };

    const near = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void start(), { rootMargin: '600px 0px' });
    near.observe(host);
    return () => {
      cancelled = true;
      near.disconnect();
      dispose?.();
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.host} data-status={status} style={{ aspectRatio: ratio }}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
      {status === 'loading' ? <span className={styles.note}>Loading the 3D model…</span> : null}
      {status === 'failed' ? <span className={styles.note}>The 3D model could not be loaded.</span> : null}
      {status === 'ready' && !touched ? <span className={styles.hint}>Drag to rotate</span> : null}
      {status === 'ready' ? (
        <div className={styles.modes} role="group" aria-label="Pose">
          <button type="button" aria-pressed={mode === 'assembled'} onClick={() => choose('assembled')}>
            Assembled
          </button>
          <button type="button" aria-pressed={mode === 'laid'} onClick={() => choose('laid')}>
            Laid out
          </button>
        </div>
      ) : null}
    </div>
  );
}
