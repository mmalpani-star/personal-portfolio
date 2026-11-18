'use client';

import { useEffect, useRef, useState } from 'react';
import { drawBottomTexture, drawTopTexture } from '@/lib/pcb/board-art';
import styles from './PcbViewer.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The real CAN FD transceiver breakout board: the OBJ and MTL exported from EasyEDA (`OBJ_PCB_caps_4`), geometry
 * untouched. The export has bare board faces, so the solder mask, silkscreen, pads, vias and bottom artwork are painted on
 * as textures (see `lib/pcb/board-art.ts` for what comes from where).
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
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a4, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.7);
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
            const out = new THREE.MeshStandardMaterial({ color: src.color ?? 0xffffff, roughness: 0.55 - metal * 0.25, metalness: metal * 0.6, side: THREE.DoubleSide });
            out.name = m.name;
            return out;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
        });

        // Give the board's two faces their finish. Only the faces change; every vertex stays where the export put it.
        const artImage = await new Promise<HTMLImageElement | null>((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => resolve(null);
          im.src = '/models/pcb/pcb-back-art.png';
        });
        if (cancelled) {
          renderer.dispose();
          return;
        }
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        const makeTexture = (canvas: HTMLCanvasElement) => {
          const t = new THREE.CanvasTexture(canvas);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = Math.min(8, maxAniso);
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          return t;
        };
        const topTex = makeTexture(drawTopTexture());
        const bottomTex = makeTexture(drawBottomTexture(artImage));
        const finish = (map: import('three').Texture) =>
          new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.35, envMapIntensity: 0.12, side: THREE.DoubleSide });
        const topMat = finish(topTex);
        const bottomMat = finish(bottomTex);
        // The export is one mesh with a material per part. Rebuild it as one mesh per material, and split the board's own
        // material into its top face, bottom face and edge so each face can carry its texture. No vertex is moved.
        const sources: import('three').Mesh[] = [];
        obj.traverse((o) => {
          const mesh = o as import('three').Mesh;
          if (mesh.isMesh && Array.isArray(mesh.material)) sources.push(mesh);
        });
        sources.forEach((mesh) => {
          const geo = mesh.geometry;
          const pos = geo.getAttribute('position');
          const nor = geo.getAttribute('normal');
          const mats = mesh.material as import('three').Material[];
          if (!pos || !nor || geo.index) return;
          geo.computeBoundingBox();
          const bb = geo.boundingBox!;
          // UVs span the board outline itself, which is the largest part of the mesh in X and Y.
          const w = bb.max.x - bb.min.x;
          const h = bb.max.y - bb.min.y;
          const groups = geo.groups.length ? geo.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
          const buckets = new Map<string, { mat: import('three').Material; ids: number[]; uv: boolean }>();
          groups.forEach((g) => {
            const mat = mats[g.materialIndex ?? 0];
            const isBoard = mat.name === 'mtl1';
            for (let t = g.start; t < g.start + g.count; t += 3) {
              let key = String(g.materialIndex);
              let useMat = mat;
              let uv = false;
              // Faces that are not vertical are the board's top and bottom. The export's own interior faces ramp from
              // full thickness down to nothing across the board (a wedge), so they are laid flat at the board's real
              // top (z = 10) and bottom (z = 0); the outline, thickness and every component stay as exported.
              const ax = pos.getX(t);
              const ay = pos.getY(t);
              const area = Math.abs((pos.getX(t + 1) - ax) * (pos.getY(t + 2) - ay) - (pos.getX(t + 2) - ax) * (pos.getY(t + 1) - ay));
              if (isBoard && area > 1e-6) {
                const top = Math.max(pos.getZ(t), pos.getZ(t + 1), pos.getZ(t + 2)) > 7.5;
                key = top ? 'top' : 'bottom';
                useMat = top ? topMat : bottomMat;
                uv = true;
              }
              let bucket = buckets.get(key);
              if (!bucket) buckets.set(key, (bucket = { mat: useMat, ids: [], uv }));
              bucket.ids.push(t, t + 1, t + 2);
            }
          });
          const holder = mesh.parent!;
          buckets.forEach((bucket) => {
            const g = new THREE.BufferGeometry();
            const n = bucket.ids.length;
            const p = new Float32Array(n * 3);
            const nn = new Float32Array(n * 3);
            const uv = bucket.uv ? new Float32Array(n * 2) : null;
            bucket.ids.forEach((i, k) => {
              p[k * 3] = pos.getX(i);
              p[k * 3 + 1] = pos.getY(i);
              p[k * 3 + 2] = pos.getZ(i);
              if (uv) {
                const up = bucket.mat === topMat;
                p[k * 3 + 2] = up ? 10 : 0;
                nn[k * 3 + 2] = up ? 1 : -1;
              } else {
                nn[k * 3] = nor.getX(i);
                nn[k * 3 + 1] = nor.getY(i);
                nn[k * 3 + 2] = nor.getZ(i);
              }
              if (uv) {
                uv[k * 2] = (pos.getX(i) - bb.min.x) / w;
                uv[k * 2 + 1] = (pos.getY(i) - bb.min.y) / h;
              }
            });
            g.setAttribute('position', new THREE.BufferAttribute(p, 3));
            g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
            if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            holder.add(new THREE.Mesh(g, bucket.mat));
          });
          holder.remove(mesh);
          geo.dispose();
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
          const dist = Math.max(1.12 / tan, 0.78 / (tan * camera.aspect));
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
          topTex.dispose();
          bottomTex.dispose();
          topMat.dispose();
          bottomMat.dispose();
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
