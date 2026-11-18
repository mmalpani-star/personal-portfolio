'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PcbViewer.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The real CAN FD transceiver breakout board: the OBJ and MTL exported from EasyEDA (`OBJ_PCB_caps_4`), unaltered.
 * Loaded only when it nears the viewport; drag to turn it. It turns slowly on its own unless motion is reduced.
 */
export function PcbViewer({ label }: { label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState(false);

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
        const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
          import('three/examples/jsm/loaders/OBJLoader.js'),
          import('three/examples/jsm/loaders/MTLLoader.js'),
        ]);
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
        if (cancelled) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.8;
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a4, 0.9));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(-2, 3, 4);
        scene.add(key);
        const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

        const mtl = await new MTLLoader().setPath('/models/pcb/').loadAsync('OBJ_PCB_caps_4.mtl');
        mtl.preload();
        const obj = await new OBJLoader().setMaterials(mtl).setPath('/models/pcb/').loadAsync('OBJ_PCB_caps_4.obj');
        if (cancelled) {
          renderer.dispose();
          return;
        }
        // The MTL's Phong materials ignore image-based light; keep each one's own colour on a standard material.
        obj.traverse((o) => {
          const mesh = o as import('three').Mesh;
          if (!mesh.isMesh) return;
          const convert = (m: import('three').Material) => {
            const src = m as import('three').MeshPhongMaterial;
            const metal = src.specular ? Math.min(1, src.specular.r * 1.2) : 0;
            return new THREE.MeshStandardMaterial({ color: src.color ?? 0xffffff, roughness: 0.55 - metal * 0.25, metalness: metal * 0.6, side: THREE.DoubleSide });
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
        });

        // Orient the board without altering the model: its thinnest axis faces the viewer, its long side stands up.
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
        const dims = [size.x, size.y, size.z];
        const thin = dims.indexOf(Math.min(...dims));
        const holder = new THREE.Group();
        holder.add(obj);
        holder.quaternion.setFromUnitVectors(axes[thin], new THREE.Vector3(0, 0, 1));
        holder.updateMatrixWorld(true);
        let oriented = new THREE.Box3().setFromObject(holder);
        let osize = oriented.getSize(new THREE.Vector3());
        if (osize.x > osize.y) {
          holder.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
          holder.updateMatrixWorld(true);
          oriented = new THREE.Box3().setFromObject(holder);
          osize = oriented.getSize(new THREE.Vector3());
        }
        const centre = oriented.getCenter(new THREE.Vector3());
        obj.position.sub(centre.applyQuaternion(holder.quaternion.clone().invert()));
        const scale = 2 / Math.max(osize.x, osize.y);
        const pivot = new THREE.Group();
        pivot.add(holder);
        pivot.scale.setScalar(scale);
        scene.add(pivot);

        let yaw = -0.35;
        let pitch = 0.32;
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
          const dist = Math.max(1.35 / tan, 0.95 / (tan * camera.aspect));
          camera.position.set(0, 0, dist);
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
            yaw += vel * dt + (reduced ? 0 : 0.18 * dt);
          }
          pivot.rotation.set(pitch, yaw, 0, 'YXZ');
          renderer.render(scene, camera);
          if (visible && !reduced) raf = requestAnimationFrame(frame);
          else if (visible && (dragging || Math.abs(vel) > 0.01)) raf = requestAnimationFrame(frame);
        };
        const wake = () => {
          if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        };
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
          pitch = Math.max(-1.1, Math.min(1.1, pitch + dy * 0.008));
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
          obj.traverse((o) => {
            const mesh = o as import('three').Mesh;
            if (mesh.isMesh) {
              mesh.geometry.dispose();
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
            }
          });
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
    <div ref={hostRef} className={styles.host} data-status={status}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
      {status === 'loading' ? <span className={styles.note}>Loading the 3D model…</span> : null}
      {status === 'failed' ? <span className={styles.note}>The 3D model could not be loaded.</span> : null}
      {status === 'ready' && !touched ? <span className={styles.hint}>Drag to rotate</span> : null}
    </div>
  );
}
