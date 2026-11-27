/**
 * The Skills scene: a head-and-shoulders bust drawn from 66,000 soft dots, sampled in the browser from
 * public/models/skills/bust.glb. The visitor's cursor is a small light that brightens the dots near it, and
 * the head turns to look at it. A shine sweeps down once after the dots assemble; a sage glint crosses the
 * visor and leaves every few seconds; dust drifts up through the room.
 *
 * Differences from the original brief, on purpose: no loader ring (the dots fly in from a loose cloud), the
 * whole bust is framed instead of cropping the shoulders (`setFit`), the cursor stays visible because the
 * page has other things to point at, and there is a light-theme rendering (dark ink, normal blending).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export type DotBustOptions = {
  canvas: HTMLCanvasElement;
  src: string;
  reducedMotion: boolean;
  light: boolean;
  onReady?: () => void;
  onError?: () => void;
};

export type DotBust = {
  /** Fraction of the canvas height the whole bust should fill (it is centred). */
  setFit: (fraction: number) => void;
  setActive: (active: boolean) => void;
  setLight: (light: boolean) => void;
  dispose: () => void;
};

const TOTAL = 66000;
const PLACE = 2.8;
const DROP = -0.68;
/** World-space vertical extent of the placed model (model y -0.951..0.948). */
const BUST_TOP = 0.948 * PLACE + DROP;
const BUST_BOTTOM = -0.951 * PLACE + DROP;
const BUST_MID = (BUST_TOP + BUST_BOTTOM) / 2;
const BUST_H = BUST_TOP - BUST_BOTTOM;
const TAN15 = Math.tan(THREE.MathUtils.degToRad(15));

/* ----------------------------------------------------------------- sampling */

type Built = {
  pos: Float32Array; nor: Float32Array; rand: Float32Array; part: Float32Array; shade: Float32Array;
  glintMin: number; glintMax: number;
};

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDots(geometry: THREE.BufferGeometry): Built {
  const mesh = new THREE.Mesh(geometry);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const N = TOTAL * 5;
  const cp = new Float32Array(N * 3);
  const cn = new Float32Array(N * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    sampler.sample(p, n);
    cp[i * 3] = p.x; cp[i * 3 + 1] = p.y; cp[i * 3 + 2] = p.z;
    cn[i * 3] = n.x; cn[i * 3 + 1] = n.y; cn[i * 3 + 2] = n.z;
  }

  type Dot = { x: number; y: number; z: number; nx: number; ny: number; nz: number; part: number };
  const dots: Dot[] = [];

  /* ---- visor (parts 3 frame, 4 lens), fitted to a front height map of the face */
  const cell = 0.01;
  const hmap = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
    if (cn[i * 3 + 2] < 0.2 || x < -0.32 || x > 0.32 || y < 0.2 || y > 0.45) continue;
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const cur = hmap.get(k);
    if (cur === undefined || z > cur) hmap.set(k, z);
  }
  const face = (x: number, y: number) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let best = -Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const v = hmap.get(`${cx + a},${cy + b}`);
      if (v !== undefined && v > best) best = v;
    }
    return best;
  };
  const W = 0.215, CLEAR = 0.028;
  const topEdge = (x: number) => 0.378 - 0.022 * (x / W) ** 2;
  const lowEdge = (x: number) => 0.282 + 0.032 * Math.exp(-((x / 0.034) ** 2)) + 0.026 * (x / W) ** 4;
  let front = -Infinity;
  for (let x = -0.06; x <= 0.06; x += 0.005) for (let y = 0.3; y <= 0.36; y += 0.005) front = Math.max(front, face(x, y));
  front += CLEAR;
  let wrap = Infinity;
  for (let x = -W; x <= W + 1e-9; x += 0.01) {
    if (Math.abs(x) < 0.05) continue;
    let need = -Infinity;
    for (let y = lowEdge(x); y <= topEdge(x); y += 0.005) need = Math.max(need, face(x, y));
    if (!Number.isFinite(need)) continue;
    wrap = Math.min(wrap, (front - need - 0.7 * CLEAR) / (x * x));
  }
  if (!Number.isFinite(front) || !Number.isFinite(wrap) || wrap <= 0) wrap = 2.4;
  if (!Number.isFinite(front)) front = 0.42;
  const lensZ = (x: number) => front - wrap * x * x;
  const j = () => (Math.random() - 0.5) * 0.003;
  const visorDot = (x: number, y: number, dz: number, part: number) => {
    const nn = new THREE.Vector3(2 * wrap * x, 0, 1).normalize();
    dots.push({ x: x + j(), y: y + j(), z: lensZ(x) + dz + j(), nx: nn.x, ny: nn.y, nz: nn.z, part });
  };
  const ux = () => (Math.random() * 2 - 1) * W;
  for (let i = 0; i < 950; i++) { const x = ux(); visorDot(x, topEdge(x) - Math.random() ** 2 * 0.016, 0.004, 3); }
  for (let i = 0; i < 380; i++) { const x = ux(); visorDot(x, lowEdge(x), 0.002, 3); }
  for (const s of [-1, 1]) for (let i = 0; i < 70; i++) { const x = s * W; visorDot(x, lowEdge(x) + Math.random() * (topEdge(x) - lowEdge(x)), 0.003, 3); }
  for (let i = 0; i < 1500; i++) { const x = ux(); const lo = lowEdge(x), hi = topEdge(x); if (hi > lo) visorDot(x, lo + Math.random() * (hi - lo), 0, 4); }
  for (const s of [-1, 1]) for (let i = 0; i < 70; i++) {
    const t = Math.random();
    const x0 = s * W, y = topEdge(x0) - 0.008;
    const nn = new THREE.Vector3(s, 0, 0);
    dots.push({ x: x0 + s * 0.03 * t + j(), y: y + j(), z: lensZ(x0) - 0.15 * t + j(), nx: nn.x, ny: nn.y, nz: nn.z, part: 3 });
  }

  /* ---- leaves (part 2): skip the density cap, keep the first 60% */
  const isLeaf = (i: number) => {
    const x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
    return x > 0.13 && y > 0.6 && (x - 0.02) ** 2 + (z + 0.06) ** 2 > 0.035;
  };
  const leaf: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < N; i++) (isLeaf(i) ? leaf : rest).push(i);
  const keepLeaf = leaf.slice(0, Math.floor(leaf.length * 0.6));
  for (const i of keepLeaf) dots.push({ x: cp[i * 3], y: cp[i * 3 + 1], z: cp[i * 3 + 2], nx: cn[i * 3], ny: cn[i * 3 + 1], nz: cn[i * 3 + 2], part: 2 });

  /* ---- the bust (part 0): even density with a per-voxel cap */
  const need = TOTAL - dots.length;
  const V = 0.022;
  const vox = new Map<string, number[]>();
  for (const i of rest) {
    const k = `${Math.floor(cp[i * 3] / V)},${Math.floor(cp[i * 3 + 1] / V)},${Math.floor(cp[i * 3 + 2] / V)}`;
    let list = vox.get(k);
    if (!list) vox.set(k, (list = []));
    list.push(i);
  }
  const counts = Array.from(vox.values()).map((l) => l.length);
  const goal = need * 1.8;
  let lo = 1, hi = counts.reduce((m, c) => (c > m ? c : m), 1);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let s = 0;
    for (const c of counts) s += Math.min(c, mid);
    if (s >= goal) hi = mid; else lo = mid + 1;
  }
  const pool: number[] = [];
  for (const list of Array.from(vox.values())) for (let k = 0; k < Math.min(lo, list.length); k++) pool.push(list[k]);
  shuffle(pool);
  for (let k = 0; k < need && k < pool.length; k++) {
    const i = pool[k];
    dots.push({ x: cp[i * 3], y: cp[i * 3 + 1], z: cp[i * 3 + 2], nx: cn[i * 3], ny: cn[i * 3 + 1], nz: cn[i * 3 + 2], part: 0 });
  }

  /* ---- depth values: ridge (stands proud or sits in a crease) and thin (loose strands, leaf tips) */
  const R = 0.03;
  const half = Math.floor(N / 2);
  const grid = new Map<string, number[]>();
  for (let i = 0; i < half; i++) {
    const k = `${Math.floor(cp[i * 3] / R)},${Math.floor(cp[i * 3 + 1] / R)},${Math.floor(cp[i * 3 + 2] / R)}`;
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  }
  const M = dots.length;
  const ridge = new Float32Array(M);
  const cnt = new Float32Array(M);
  for (let d = 0; d < M; d++) {
    const o = dots[d];
    const gx = Math.floor(o.x / R), gy = Math.floor(o.y / R), gz = Math.floor(o.z / R);
    let sx = 0, sy = 0, sz = 0, c = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
      const list = grid.get(`${gx + a},${gy + b},${gz + e}`);
      if (!list) continue;
      for (const i of list) {
        const dx = cp[i * 3] - o.x, dy = cp[i * 3 + 1] - o.y, dz = cp[i * 3 + 2] - o.z;
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        sx += dx; sy += dy; sz += dz; c++;
      }
    }
    cnt[d] = c;
    ridge[d] = c ? -((sx / c) * o.nx + (sy / c) * o.ny + (sz / c) * o.nz) / R : 0;
  }
  const absSorted = Array.from(ridge, Math.abs).sort((a, b) => a - b);
  const p90 = absSorted[Math.floor(absSorted.length * 0.9)] || 1;
  const cntSorted = Array.from(cnt).sort((a, b) => a - b);
  const median = cntSorted[Math.floor(cntSorted.length / 2)] || 1;

  const pos = new Float32Array(M * 3), nor = new Float32Array(M * 3), rand = new Float32Array(M), part = new Float32Array(M), shade = new Float32Array(M * 2);
  let glintMin = Infinity, glintMax = -Infinity;
  for (let d = 0; d < M; d++) {
    const o = dots[d];
    pos[d * 3] = o.x * PLACE; pos[d * 3 + 1] = o.y * PLACE + DROP; pos[d * 3 + 2] = o.z * PLACE;
    nor[d * 3] = o.nx; nor[d * 3 + 1] = o.ny; nor[d * 3 + 2] = o.nz;
    rand[d] = Math.random();
    part[d] = o.part;
    shade[d * 2] = Math.max(-1, Math.min(1, ridge[d] / p90));
    shade[d * 2 + 1] = Math.max(0, Math.min(1, 1 - cnt[d] / (0.55 * median)));
    if (o.part >= 2) { glintMin = Math.min(glintMin, pos[d * 3]); glintMax = Math.max(glintMax, pos[d * 3]); }
  }
  return { pos, nor, rand, part, shade, glintMin, glintMax };
}

/* ----------------------------------------------------------------- shaders */

const BUST_VERT = /* glsl */ `
attribute vec3 aNormal; attribute float aRand; attribute float aPart; attribute vec2 aShade;
uniform float uTime, uAssemble, uSize, uGlint, uShine;
uniform vec2 uHead; uniform vec3 uLight;
varying float vB; varying float vA; varying float vShine; varying float vGlint; varying float vLens;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

void main() {
  vec3 home = position;
  vec3 n = normalize(aNormal);
  // head turn about the neck; the shoulders follow at a quarter
  float head = smoothstep(-1.3, -0.6, home.y);
  mat3 R = rotY(uHead.x * (0.25 + 0.75 * head)) * rotX(uHead.y * head);
  vec3 piv = vec3(0.0, -1.0, 0.0);
  vec3 turned = R * (home - piv) + piv;
  n = R * n;
  // breathing
  vec3 p = turned + n * sin(uTime * 1.4 + aRand * 60.0) * 0.006;

  // entrance: from a loose cloud, arcing toward the camera on the way in
  float r2 = fract(sin(aRand * 91.7) * 43758.5453);
  float t = clamp((uAssemble - aRand * 0.45) / 0.55, 0.0, 1.0);
  float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  vec3 dir = normalize(vec3(sin(aRand * 91.0 + 1.0), cos(aRand * 57.0 + 2.0), sin(aRand * 23.0 + 3.0)) + 1e-4);
  vec3 start = vec3(0.0, ${BUST_MID.toFixed(4)}, 0.0) + dir * (3.2 + r2 * 3.0);
  p = mix(start, p, e) + vec3(sin(aRand * 40.0 + uTime * 0.3), cos(aRand * 31.0), 0.9 + r2 * 1.4) * sin(e * 3.14159265) * 0.45;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vec3 toL = uLight - world.xyz;
  float lit = max(dot(n, normalize(toL)), 0.0) / (1.0 + dot(toL, toL) * 0.32);
  float key = max(dot(n, normalize(vec3(-0.5, 0.6, 0.7))), 0.0);
  float facing = normalize(normalMatrix * n).z;
  float rim = pow(1.0 - abs(facing), 3.0);

  float b = 0.3 + key * 0.22 + lit * 1.5 + rim * 0.14;
  b *= mix(0.55, 1.0, smoothstep(-0.3, 0.25, facing));
  float ridge = aShade.x;
  b *= ridge > 0.0 ? 1.0 + ridge * 0.7 : 1.0 + ridge * 0.5;
  b += aShade.y * (0.26 + key * 0.3);
  float isLeaf = step(1.5, aPart) * step(aPart, 2.5);
  float isVisor = step(2.5, aPart);
  float isLens = step(3.5, aPart);
  b *= mix(1.0, 0.9, isLeaf);
  b *= mix(1.0, 0.78, isVisor);
  b *= mix(1.0, 0.7, isLens);
  b *= 0.7 + r2 * 0.5;

  float glint = (isLeaf + isVisor) * smoothstep(0.09, 0.0, abs(home.x - uGlint));
  b += glint * 1.2;
  float band = turned.y - turned.x * 0.5 - uShine;
  float shine = exp(-band * band * 4.0);
  b += shine * 1.3;

  vB = b; vA = mix(0.75, 1.0, e); vShine = shine; vGlint = glint; vLens = isLens;
  vec4 mv = viewMatrix * world;
  gl_PointSize = uSize * (0.45 + r2 * r2 * 1.3) * (1.0 + shine * 0.6) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const BUST_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uInk, uBlue, uCream; uniform float uLightTheme;
varying float vB; varying float vA; varying float vShine; varying float vGlint; varying float vLens;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float a = exp(-16.0 * r2) * vA;
  vec3 ink = mix(uInk, uCream, vShine * 0.6);
  ink = mix(ink, uBlue, 0.6 * vLens);
  ink = mix(ink, uBlue, vGlint * 0.7);
  if (uLightTheme > 0.5) {
    // white page: the same shading as darkness instead of light
    vec3 dark = mix(vec3(0.16, 0.2, 0.13), vec3(0.2, 0.42, 0.4), clamp(vLens * 0.6 + vGlint * 0.8, 0.0, 1.0));
    gl_FragColor = vec4(dark, clamp(vB * a * 0.42, 0.0, 0.85));
  } else {
    vec3 col = ink * vB * a;
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
  }
}`;

const LIGHT_VERT = /* glsl */ `
uniform float uSize, uOn;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * uOn / -mv.z; gl_Position = projectionMatrix * mv; }`;
const LIGHT_FRAG = /* glsl */ `
precision highp float;
uniform float uOn, uLightTheme;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.14, 0.08, r);
  float glow = exp(-4.0 * r) * 0.45 + exp(-12.0 * r) * 0.7;
  if (uLightTheme > 0.5) gl_FragColor = vec4(vec3(0.2, 0.42, 0.4), (core * 0.7 + glow * 0.35) * uOn);
  else { vec3 col = vec3(core + glow) * uOn; gl_FragColor = vec4(col, max(col.r, max(col.g, col.b))); }
}`;

const DUST_VERT = /* glsl */ `
attribute float aRand;
uniform float uTime, uSize;
varying float vR;
void main() {
  vec3 p = position;
  p.y = mod(p.y + 6.0 + uTime * (0.03 + aRand * 0.05), 12.0) - 6.0;
  p.x += sin(uTime * 0.2 + aRand * 40.0) * 0.15;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.5 + aRand) / -mv.z;
  gl_Position = projectionMatrix * mv;
  vR = aRand;
}`;
const DUST_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uInk; uniform float uOn, uLightTheme;
varying float vR;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float a = exp(-16.0 * r2) * (0.1 + vR * 0.18) * uOn;
  if (uLightTheme > 0.5) gl_FragColor = vec4(vec3(0.16, 0.2, 0.13), a * 0.8);
  else { vec3 col = uInk * a; gl_FragColor = vec4(col, max(col.r, max(col.g, col.b))); }
}`;

/* ----------------------------------------------------------------- scene */

export function createDotBust({ canvas, src, reducedMotion, light, onReady, onError }: DotBustOptions): DotBust {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch {
    onError?.();
    return { setFit() {}, setActive() {}, setLight() {}, dispose() {} };
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0, BUST_MID, 0);
  let fit = 0.86;
  let disposed = false;
  let isLight = light;

  const common = { transparent: true, depthWrite: false, depthTest: false };
  /** Dark theme: additive. Each dot adds its colour and, as alpha, its brightest channel, so the transparent canvas
   *  always holds valid premultiplied pixels (alpha >= colour). Plain AdditiveBlending writes alpha 1 under dim dots
   *  (black specks); writing no alpha at all leaves colour > alpha, which some compositors drop entirely.
   *  Light theme: ordinary alpha. */
  const setBlend = (mat: THREE.ShaderMaterial) => {
    if (isLight) {
      mat.blending = THREE.NormalBlending;
    } else {
      mat.blending = THREE.CustomBlending;
      mat.blendEquation = THREE.AddEquation;
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneFactor;
      mat.blendSrcAlpha = THREE.OneFactor;
      mat.blendDstAlpha = THREE.OneFactor;
    }
    mat.needsUpdate = true;
  };

  const bustMat = new THREE.ShaderMaterial({
    vertexShader: BUST_VERT, fragmentShader: BUST_FRAG, ...common,
    uniforms: {
      uTime: { value: 0 }, uAssemble: { value: reducedMotion ? 1 : 0 }, uSize: { value: 26 * dpr },
      uGlint: { value: -9 }, uShine: { value: 99 }, uHead: { value: new THREE.Vector2() },
      uLight: { value: new THREE.Vector3(-1.4, 1.2, 1.6) },
      uInk: { value: new THREE.Color('#c9d4b8') }, uBlue: { value: new THREE.Color('#7fa8a3') }, uCream: { value: new THREE.Color('#f0e5c8') },
      uLightTheme: { value: light ? 1 : 0 },
    },
  });
  const lightMat = new THREE.ShaderMaterial({
    vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG, ...common,
    uniforms: { uSize: { value: 240 * dpr }, uOn: { value: reducedMotion ? 1 : 0 }, uLightTheme: { value: light ? 1 : 0 } },
  });
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, ...common,
    uniforms: { uTime: { value: 0 }, uSize: { value: 22 * dpr }, uInk: { value: new THREE.Color('#c9d4b8') }, uOn: { value: reducedMotion ? 1 : 0 }, uLightTheme: { value: light ? 1 : 0 } },
  });

  [bustMat, lightMat, dustMat].forEach(setBlend);

  // dust
  const DUST = 900;
  const dp = new Float32Array(DUST * 3), dr = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = Math.random() * 18 - 9; dp[i * 3 + 1] = Math.random() * 12 - 6; dp[i * 3 + 2] = Math.random() * 8 - 6;
    dr[i] = Math.random();
  }
  const dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeom.setAttribute('aRand', new THREE.BufferAttribute(dr, 1));
  const dust = new THREE.Points(dustGeom, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // cursor light
  const lightGeom = new THREE.BufferGeometry();
  lightGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const lightPt = new THREE.Points(lightGeom, lightMat);
  lightPt.frustumCulled = false;
  scene.add(lightPt);

  let bustGeom: THREE.BufferGeometry | null = null;
  let glintMin = -1, glintMax = 1;

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = (BUST_H / fit / 2) / TAN15;
    camera.position.set(0, BUST_MID, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) render(); });
  ro.observe(canvas);

  /* ---- pointer */
  let pointer: { x: number; y: number } | null = null;
  let lastTouch = -1e9;
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.6);
  const hit = new THREE.Vector3();
  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') lastTouch = performance.now();
  };
  const onLeave = () => { pointer = null; };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  const lightPos = new THREE.Vector3(-1.4, 1.2, 1.6);
  const orbit = new THREE.Vector3();
  const head = new THREE.Vector2();
  const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

  let running = false;
  let raf = 0;
  let prev = 0;
  let t = 0; // seconds since the scene started (assembly clock)
  let ready = false;

  const render = () => renderer.render(scene, camera);

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (document.documentElement.dataset.hub === 'open') { prev = now; return; }
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60;
    prev = now;
    if (!ready) return;
    t += dt;
    const u = bustMat.uniforms;
    const assemble = reducedMotion ? 1 : Math.min(1, t / 2.6);
    u.uAssemble.value = assemble;
    if (!reducedMotion) {
      u.uTime.value = t;
      dustMat.uniforms.uTime.value = t;
      lightMat.uniforms.uOn.value += (Math.min(1, 1.6 * assemble) - lightMat.uniforms.uOn.value) * ease(dt, 4);
      dustMat.uniforms.uOn.value += (1 - dustMat.uniforms.uOn.value) * ease(dt, 0.8);
      // shine: once, 2.34 s -> 4.54 s
      if (t >= 2.34 && t <= 4.54) { const s = (t - 2.34) / 2.2; u.uShine.value = 2.8 - (1 - (1 - s) ** 2) * 7.4; } else u.uShine.value = 99;
      // glint: from 4.6 s, every 4.2 s, 0.9 s long
      if (t >= 4.6) {
        const g = (t - 4.6) % 4.2;
        u.uGlint.value = g < 0.9 ? (glintMin - 0.15) + (g / 0.9) * (glintMax - glintMin + 0.3) : -9;
      }
    }

    // the light: follows the cursor over the canvas, otherwise orbits by itself
    const rect = canvas.getBoundingClientRect();
    const touchStale = performance.now() - lastTouch > 1500 && lastTouch > 0;
    const inside = pointer && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    let headGoalX: number, headGoalY: number, rate: number;
    if (pointer && inside && !touchStale) {
      ndc.set(((pointer.x - rect.left) / rect.width) * 2 - 1, -(((pointer.y - rect.top) / rect.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        if (reducedMotion) lightPos.copy(hit); else lightPos.lerp(hit, ease(dt, 5));
      }
      headGoalX = 0.5 * ndc.x; headGoalY = 0.18 * ndc.y; rate = 3;
    } else {
      orbit.set(1.9 * Math.sin(0.45 * t), 0.5 + 0.8 * Math.cos(0.33 * t), 2.6);
      if (reducedMotion) lightPos.copy(orbit); else lightPos.lerp(orbit, ease(dt, 5));
      headGoalX = 0.35 * Math.sin(0.45 * t); headGoalY = 0.12 * Math.cos(0.33 * t); rate = 1.5;
    }
    if (!reducedMotion) {
      head.x += (headGoalX - head.x) * ease(dt, rate);
      head.y += (headGoalY - head.y) * ease(dt, rate);
    }
    u.uHead.value.set(head.x, -head.y);
    u.uLight.value.copy(lightPos);
    (lightGeom.attributes.position as THREE.BufferAttribute).setXYZ(0, lightPos.x, lightPos.y, lightPos.z);
    lightGeom.attributes.position.needsUpdate = true;
    render();
  };

  // load, sample, build
  (async () => {
    try {
      const gltf = await new GLTFLoader().loadAsync(src);
      if (disposed) return;
      let mesh: THREE.Mesh | null = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
      if (!mesh) throw new Error('no mesh');
      const m = mesh as THREE.Mesh;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      const built = buildDots(g);
      g.dispose();
      if (disposed) return;
      bustGeom = new THREE.BufferGeometry();
      bustGeom.setAttribute('position', new THREE.BufferAttribute(built.pos, 3));
      bustGeom.setAttribute('aNormal', new THREE.BufferAttribute(built.nor, 3));
      bustGeom.setAttribute('aRand', new THREE.BufferAttribute(built.rand, 1));
      bustGeom.setAttribute('aPart', new THREE.BufferAttribute(built.part, 1));
      bustGeom.setAttribute('aShade', new THREE.BufferAttribute(built.shade, 2));
      glintMin = built.glintMin; glintMax = built.glintMax;
      const pts = new THREE.Points(bustGeom, bustMat);
      pts.frustumCulled = false;
      scene.add(pts);
      canvas.dataset.dots = String(built.pos.length / 3);
      ready = true;
      t = 0;
      render();
      onReady?.();
    } catch {
      if (!disposed) onError?.();
    }
  })();

  return {
    setFit(fraction) {
      fit = Math.max(0.2, Math.min(1, fraction));
      resize();
      if (!running) render();
    },
    setActive(active) {
      if (active === running || disposed) return;
      running = active;
      if (active) { prev = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
    },
    setLight(next) {
      isLight = next;
      for (const mat of [bustMat, lightMat, dustMat]) {
        mat.uniforms.uLightTheme.value = next ? 1 : 0;
        setBlend(mat);
      }
      if (!running) render();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      bustGeom?.dispose(); dustGeom.dispose(); lightGeom.dispose();
      bustMat.dispose(); lightMat.dispose(); dustMat.dispose();
      renderer.dispose();
    },
  };
}
