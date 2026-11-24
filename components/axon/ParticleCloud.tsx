'use client';

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

type ParticleCloudProps = {};

/** Pure-black full-screen particle cloud stirred by the cursor. No UI, no text, no boxes. */
export function ParticleCloud({}: ParticleCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mouse, setMouse] = useState(() =>
    typeof window !== 'undefined' ? new THREE.Vector2(0.5, 0.5) : new THREE.Vector2(0.5, 0.5)
  );
  const [size, setSize] = useState(() =>
    typeof window !== 'undefined'
      ? new THREE.Vector2(window.innerWidth, window.innerHeight)
      : new THREE.Vector2(800, 600)
  );
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef<THREE.Mesh>(null);
  const mouseWorldRef = useRef(new THREE.Vector3(0, 0, 0));

  // Pointer → normalized canvas coords + world-space cursor on the z=0 plane.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      setMouse(new THREE.Vector2(mx, my));
    };
    const onResize = () => setSize(new THREE.Vector2(window.innerWidth, window.innerHeight));
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('resize', onResize);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const count = size.width > 760 ? 65536 : 16384;

  // Rest positions on a hollow, twisted ring/torus form (~0.7 across).
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 2;
    const r = 1.15 + 0.35 * Math.random();
    const ring = 1.6 + 0.5 * Math.cos(phi * 3);
    positions[i * 3] = Math.cos(theta) * ring + Math.cos(theta) * Math.cos(phi) * r;
    positions[i * 3 + 1] = Math.sin(theta) * ring + Math.sin(theta) * Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * r * 0.6 + 0.35 * Math.sin(theta * 2);
    randoms[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const PointsMaterial = shaderMaterial(
    {
      uTime: 0,
      uMouse: new THREE.Vector2(0.5, 0.5),
      uMouseWorld: new THREE.Vector3(0, 0, 0),
      uResolution: size,
    } as any,
    /* glsl */ `
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec3 uMouseWorld;
      uniform vec2 uResolution;
      attribute float aRandom;
      varying float vAlpha;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      vec3 curlNoise(vec3 p) {
        const e = 0.01;
        const x = noise(p.xy + vec2(e, 0.0)) - noise(p.xy - vec2(e, 0.0));
        const y = noise(p.yz + vec2(e, 0.0)) - noise(p.yz - vec2(e, 0.0));
        const z = noise(p.zx + vec2(e, 0.0)) - noise(p.zx - vec2(e, 0.0));
        return normalize(vec3(x, y, z));
      }

      void main() {
        vec3 pos = position;

        // continuous swirl from curl noise
        vec3 n = curlNoise(pos * 0.4 + uTime * 0.15);
        pos += n * 0.12;

        // cursor disturbance: push particles away from the cursor in world space
        vec3 toMouse = pos - uMouseWorld;
        float dist = length(toMouse);
        if (dist < 1.8) {
          vec3 dir = normalize(toMouse);
          pos += dir * (1.8 - dist) * 0.06;
        }

        // gentle spring toward the rest torus so the cloud heals after the cursor passes
        pos = mix(pos, position, 0.02);

        // rotate the whole cloud slowly
        float a = uTime * 0.05;
        float s = sin(a), c = cos(a);
        pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

        // size by distance to camera + random
        float scale = smoothstep(2.0, 12.0, distance(pos, vec3(0.0, 0.0, 3.6))) *
                      mix(0.4, 1.0, aRandom);
        gl_PointSize = 0.035 * uResolution.y / 760.0 * scale * (1000.0 / 100.0);

        vAlpha = 0.55 + 0.35 * aRandom;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    /* glsl */ `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord.xy - 0.5);
        if (r > 0.5) discard;
        if (vAlpha < 0.1) discard;
        vec3 base = mix(vec3(0.75), vec3(0.62, 0.5, 1.0), pow(vAlpha, 3.0));
        float edge = 1.0 - smoothstep(0.45, 0.5, r);
        gl_FragColor = vec4(base, vAlpha * edge * 0.9);
      }
    `,
  ) as any;

  useEffect(() => {
    const mat = PointsMaterial as unknown as THREE.ShaderMaterial;
    mat.transparent = true;
    mat.depthWrite = false;
    mat.blending = THREE.AdditiveBlending;
  }, []);

  return (
    <Canvas
      ref={canvasRef}
      camera={{ position: [0, 0, 3.6], fov: 40 }}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
      frameloop="always"
      dpr={[1, 2]}
    >
      <CloudPoints
        geometry={geometry}
        material={PointsMaterial}
        mouse={mouse}
        mouseWorldRef={mouseWorldRef}
        size={size}
        raycasterRef={raycasterRef}
        planeRef={planeRef}
      />
    </Canvas>
  );
}

function CloudPoints({
  geometry,
  material,
  mouse,
  mouseWorldRef,
  size,
  raycasterRef,
  planeRef,
}: {
  geometry: THREE.BufferGeometry;
  material: any;
  mouse: THREE.Vector2;
  mouseWorldRef: React.MutableRefObject<THREE.Vector3>;
  size: THREE.Vector2;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  planeRef: RefObject<THREE.Mesh>;
}) {
  const { camera } = useThree();

  useFrame((state, delta) => {
    const mat = material as unknown as THREE.ShaderMaterial;
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uMouse.value = mouse;
    mat.uniforms.uResolution.value = size;

    // world-space cursor point on the z=0 plane
    const ndc = new THREE.Vector2(mouse.x * 2 - 1, -(mouse.y * 2 - 1));
    raycasterRef.current.setFromCamera(ndc, camera);
    const plane = planeRef.current;
    if (plane) {
      const hits = raycasterRef.current.intersectObject(plane);
      if (hits.length) {
        mouseWorldRef.current.copy(hits[0].point);
        mat.uniforms.uMouseWorld.value = mouseWorldRef.current;
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <points geometry={geometry}>
        <material />
      </points>
      <mesh ref={planeRef} visible={false}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>
    </>
  );
}
