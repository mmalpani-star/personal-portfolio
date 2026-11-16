'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';

const COUNT = 1500;

const vertexShader = /* glsl */ `
  attribute float seed;
  uniform float uAngle;
  uniform float uRadius;
  uniform float uBurst;
  uniform float uSize;
  varying float vSeed;

  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c); }

  void main() {
    vSeed = seed;
    // Two families of particles orbit on crossed axes, at slightly different rates.
    float rate = 0.55 + seed * 0.9;
    vec3 p = seed > 0.5 ? rotY(uAngle * rate) * position : rotX(uAngle * rate) * rotY(1.1) * position;
    p *= uRadius * (1.0 + uBurst * (1.6 + seed * 4.2));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + seed) / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uOpacity;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.05, d) * uOpacity;
    gl_FragColor = vec4(mix(uEdge, uCore, vSeed), alpha);
  }
`;

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Timeline, in seconds from the moment `active` turns true.
const SPIN_UP = 1.7;
const BURST = 0.65;
const SETTLE = 1.5;

function Particles({ active, onDone }: { active: boolean; onDone: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const started = useRef<number | null>(null);
  const angle = useRef(0);
  const finished = useRef(false);

  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    // Fibonacci lattice: an even spread of points over a unit sphere.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i += 1) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(golden * i) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(golden * i) * r;
      seeds[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      seeds[i] = Math.abs(seeds[i]);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    buffer.setAttribute('seed', new BufferAttribute(seeds, 1));
    return buffer;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uAngle: { value: 0 },
          uRadius: { value: 1.1 },
          uBurst: { value: 0 },
          uOpacity: { value: 0.55 },
          uSize: { value: 30 },
          uCore: { value: new Color('#fff1d6') },
          uEdge: { value: new Color('#ffb547') },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useEffect(() => {
    material.uniforms.uSize.value = size.height * 0.11;
    invalidate();
  }, [invalidate, material, size.height]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    if (!active) {
      // Idle drift before the section is on screen.
      angle.current += delta * 0.35;
      u.uAngle.value = angle.current;
      return;
    }
    if (finished.current) return;
    if (started.current === null) started.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - started.current;

    const spin = ease(clamp01(t / SPIN_UP));
    const burst = clamp01((t - SPIN_UP) / BURST);
    const settle = ease(clamp01((t - SPIN_UP - BURST) / SETTLE));

    // Angular speed: slow drift → fast spin → back to a drift once settled.
    const speed = 0.35 + spin * spin * 11 * (1 - settle);
    angle.current += Math.min(delta, 0.05) * speed;

    u.uAngle.value = angle.current;
    u.uRadius.value = 1.1 - spin * 0.32 + settle * 0.22;
    u.uBurst.value = (1 - Math.pow(1 - burst, 3)) * (1 - settle);
    u.uOpacity.value = 0.55 + spin * 0.45 - burst * 0.6 * (1 - settle) - settle * 0.2;

    if (t > SPIN_UP + BURST + SETTLE) {
      finished.current = true;
      onDone();
    }
  });

  return <points geometry={geometry} material={material} />;
}

type OrbCanvasProps = {
  /** Starts the spin-up → burst → settle sequence. */
  active: boolean;
  onReady: () => void;
  onDone: () => void;
};

/** WebGL particle sphere. Renders continuously only while the sequence plays. */
export default function OrbCanvas({ active, onReady, onDone }: OrbCanvasProps) {
  const [done, setDone] = useState(false);

  return (
    <Canvas
      frameloop={done ? 'demand' : 'always'}
      dpr={[1, 1.75]}
      // The canvas is 2.6× the band's height (see EnergyOrb.module.css), hence the long camera distance.
      camera={{ fov: 32, position: [0, 0, 16] }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      onCreated={onReady}
      aria-hidden="true"
    >
      <Particles
        active={active}
        onDone={() => {
          setDone(true);
          onDone();
        }}
      />
    </Canvas>
  );
}
