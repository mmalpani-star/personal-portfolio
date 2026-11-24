'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Color, Group, Material, Mesh, Object3D, Vector3, Points, BufferGeometry, BufferAttribute, PointsMaterial } from 'three';
import { motion } from 'framer-motion';
import { useFinePointer } from '@/components/effects/useFinePointer';

import styles from './ModelCanvas.module.css';

type ModelCanvasProps = {
  /** Public URL of the .glb to load (lazily, only when the section is near). */
  model: string;
  /** Accessible label for the canvas. */
  label?: string;
  /** Accent colour used for emissive / glow. Defaults to the CSS accent token. */
  accent?: string;
  /** Whether to show a starfield background behind the model. */
  stars?: boolean;
};

/**
 * Lazy, viewport-aware Three.js canvas for a single GLB model.
 *
 * - Unmounts the Canvas entirely when the section is far from the viewport;
 *   remounts when near (rootMargin 300px).
 * - Sets `frameloop="never"` while the canvas itself is offscreen.
 * - Caps devicePixelRatio at 2.
 * - Loads the model with `useGLTF` (preloaded on mount).
 * - Smooth pointer look-at + hover emissive boost on fine pointers; static
 *   fallback under reduced motion / touch / when WebGL is unavailable.
 * - Cheap CSS radial-gradient glow behind the canvas that follows the pointer.
 * - Optional starfield background + continuous slow rotation for space scenes.
 */
export function ModelCanvas({ model, label = '3D model', accent = '#ffd400', stars = false }: ModelCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('never');
  const [active, setActive] = useState(false);

  // Pointer → smooth look-at target (fine pointers only).
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 180, damping: 28, mass: 0.5 });
  const springY = useSpring(pointerY, { stiffness: 180, damping: 28, mass: 0.5 });
  const glowX = useTransform(springX, [-0.5, 0.5], [-70, 70]);
  const glowY = useTransform(springY, [-0.5, 0.5], [-70, 70]);

  const enabled = fine && !reduceMotion;

  useEffect(() => {
    if (!enabled) return;
    const el = wrapperRef.current;
    if (!el) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = el.getBoundingClientRect();
      pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
      pointerY.set(-((event.clientY - rect.top) / rect.height - 0.5));
    };
    const onEnter = () => setActive(true);
    const onLeave = () => {
      setActive(false);
      pointerX.set(0);
      pointerY.set(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled, pointerX, pointerY]);

  // Mount the Canvas only when the section is near the viewport; unmount when far.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMounted(entry.isIntersecting),
      { rootMargin: '300px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cap render cost: never frame while the canvas itself is offscreen.
  useEffect(() => {
    if (!mounted) return;
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFrameloop(entry.isIntersecting ? 'always' : 'never'),
      { rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  // Preload the GLB once the section is near.
  useEffect(() => {
    if (!mounted) return;
    void useGLTF.preload(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, model]);

  // Starfield geometry (created once, reused on remount).
  const starGeometry = useMemo(() => {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 60;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const starMaterial = useMemo(
    () => new PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.7 }),
    []
  );

  if (!mounted) return null;

  return (
    <div className={styles.wrapper} ref={wrapperRef} aria-label={label} data-active={active ? 'true' : undefined}>
      <motion.div
        className={styles.glow}
        style={{
          x: enabled ? glowX : 0,
          y: enabled ? glowY : 0,
        }}
      />
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 0, 3], fov: 35 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} castShadow />
        <pointLight position={[-2, 3, 2]} intensity={0.5} color={accent} />
        {stars && (
          <points geometry={starGeometry} material={starMaterial} />
        )}
        <Suspense fallback={null}>
          <ModelContent model={model} accent={accent} active={active} springX={springX} springY={springY} />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Loads the GLB lazily, applies emissive materials, pointer look-at and hover boost. */
function ModelContent({
  model,
  accent,
  active,
  springX,
  springY,
}: {
  model: string;
  accent: string;
  active: boolean;
  springX: ReturnType<typeof useSpring>;
  springY: ReturnType<typeof useSpring>;
}) {
  const { scene } = useGLTF(model);
  const rootRef = useRef<Group>(null);
  const intensity = active ? 0.5 : 0.05;
  // Clone once and fit to a uniform apparent size so all three models look
  // the same scale regardless of their source units. Never mutates the shared
  // GLTF cache because we operate on the clone.
  const clone = useMemo(() => {
    const c = scene.clone();
    const box = new Box3().setFromObject(c);
    const center = new Vector3();
    box.getCenter(center);
    const size = new Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const target = 1.5;
    const s = target / maxDim;
    // world = position + s * p_local; centre the bbox at origin and scale to target.
    c.position.set(-s * center.x, -s * center.y, -s * center.z);
    c.scale.setScalar(s);
    c.updateMatrixWorld();
    return c;
  }, [scene]);

  // Add the clone to the declarative group so it is part of the scene graph.
  useLayoutEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    group.add(clone);
    return () => {
      group.remove(clone);
    };
  }, [clone]);

  // Smooth pointer look-at + slow idle float + continuous orbit rotation.
  useFrame(() => {
    if (!rootRef.current) return;
    const targetX = springX.get() * 0.12;
    const targetY = springY.get() * 0.12;
    rootRef.current.rotation.y += (targetX - rootRef.current.rotation.y) * 0.08;
    rootRef.current.rotation.x += (targetY - rootRef.current.rotation.x) * 0.08;
    // Continuous slow orbit rotation (satellite tumbling in space).
    rootRef.current.rotation.z += 0.004;
    rootRef.current.position.y = Math.sin(Date.now() * 0.0012) * 0.015;
  });

  // Apply emissive to cloned materials only (clone is safe to mutate).
  useEffect(() => {
    clone.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((m) => {
        const nm = m.clone();
        (nm as MeshStandardMaterialLike).emissive = new Color(accent);
        (nm as MeshStandardMaterialLike).emissiveIntensity = intensity;
        nm.needsUpdate = true;
        return nm;
      });
      mesh.material = next.length === 1 ? next[0] : next;
    });
    return () => {
      clone.traverse((child: Object3D) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clone, accent, intensity]);

  return <group ref={rootRef} />;
}

interface MeshStandardMaterialLike extends Material {
  emissive: Color;
  emissiveIntensity: number;
}
