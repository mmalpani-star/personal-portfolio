/**
 * The Skills page's 3D backpack: a procedural model with a working zipper.
 *
 * - The lid is a deformable sheet hinged at the back. As the slider travels along the front seam, the
 *   fabric behind it peels up, so the mouth opens progressively exactly where the zipper has been.
 * - Brass teeth (instanced) interlock in the zipped part of the seam and part where it is open; the slider
 *   carries a yellow puller that swings as it is dragged.
 * - Light spills out: a warm glow lining the cavity, a point light, soft beams and a halo, all scaled by how
 *   much of the zipper is open and by how far along it each beam sits.
 *
 * Original geometry throughout; there is no imported model. The pack is generic (not a particular product).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type BackpackEvents = {
  onReady: () => void;
  onError: (error: unknown) => void;
  /** Every frame the zipper moves: 0 closed .. 1 fully open. */
  onProgress: (progress: number) => void;
  /** The visitor has opened it far enough that whatever is inside should come out. */
  onThreshold: () => void;
  onGrab: (grabbing: boolean) => void;
};

export type BackpackOptions = {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  events: BackpackEvents;
};

export type BackpackHandle = {
  setActive: (active: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  /** Dragging the slider is allowed. */
  setInteractive: (on: boolean) => void;
  /** Move the zipper to `target` (0..1) over `ms`; resolves when it gets there. */
  animateTo: (target: number, ms: number) => Promise<void>;
  getProgress: () => number;
  /** Where the opening is, in viewport (client) coordinates. */
  getMouthPoint: () => { x: number; y: number };
  /** After a repack, allow the threshold to fire again. */
  rearm: () => void;
  dispose: () => void;
};

/* ------------------------------------------------------------------ dimensions */

const W = 1.0;
const D = 0.56;
const BASE_Y = -0.68;
const LOW_H = 1.02;
const HC = BASE_Y + LOW_H; // top of the lower body
const SEAM_Y = HC - 0.12;
const SEAM_Z = D / 2 + 0.012;
const ZIP_LO = 0.06; // the slider's travel along the seam, as a fraction of the width
const ZIP_HI = 0.94;
const RAMP = 0.14;
const LIFT_MAX = 1.0; // radians the lid peels up
const NU = 56;
const NV = 30;
const TEETH = 38;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Slider position along the seam, as a fraction of the width, for a zipper progress. */
const sliderU = (p: number) => lerp(ZIP_LO, ZIP_HI, p);

/* ------------------------------------------------------------------ textures */

function weaveTexture(base: string, line: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // ripstop: a fine weave with a heavier thread every 32 px
  for (let i = 0; i < 256; i += 4) {
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.fillRect(i, 0, 1, 256);
    g.fillRect(0, i, 256, 1);
  }
  g.fillStyle = line;
  for (let i = 0; i < 256; i += 32) {
    g.fillRect(i, 0, 1, 256);
    g.fillRect(0, i, 256, 1);
  }
  const d = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function radialTexture(stops: Array<[number, string]>, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 256, 0, 0);
  v.addColorStop(0, 'rgba(255,236,180,0.95)');
  v.addColorStop(0.35, 'rgba(255,220,140,0.4)');
  v.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  // soften the sides
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function patchTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffd400';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#0d0d0d';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 108);
  g.fillStyle = '#0d0d0d';
  g.font = '700 64px ui-monospace, Menlo, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MM', 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ scene */

export function createBackpack(options: BackpackOptions): BackpackHandle {
  const { canvas, events } = options;
  let reduced = options.reducedMotion;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    events.onError(error);
    return {
      setActive() {}, setReducedMotion() {}, setInteractive() {}, animateTo: () => Promise.resolve(), getProgress: () => 0,
      getMouthPoint: () => ({ x: 0, y: 0 }), rearm() {}, dispose() {},
    };
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.28;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const key = new THREE.DirectionalLight(0xcfe0ff, 1.25);
  key.position.set(-2.2, 3.2, 3.4);
  const rim = new THREE.DirectionalLight(0xffd29a, 0.9);
  rim.position.set(2.4, 2.0, -2.6);
  scene.add(key, rim);

  const pack = new THREE.Group();
  scene.add(pack);

  /* ---------- materials ---------- */
  const weave = weaveTexture('#1d2736', 'rgba(255,255,255,0.035)');
  const weave2 = weaveTexture('#27344a', 'rgba(255,255,255,0.04)');
  const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, map: weave, bumpMap: weave, bumpScale: 0.7, roughness: 0.86, metalness: 0 });
  const fabric2 = new THREE.MeshStandardMaterial({ color: 0xffffff, map: weave2, bumpMap: weave2, bumpScale: 0.7, roughness: 0.88, metalness: 0 });
  const lidInner = new THREE.MeshStandardMaterial({ color: 0xe9dfc9, roughness: 0.8, side: THREE.BackSide, emissive: 0x4a3414, emissiveIntensity: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.7 });
  const webbing = new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.92 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xe6bd4c, metalness: 1, roughness: 0.3 });
  const puller = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.5, emissive: 0xffb800, emissiveIntensity: 0.12 });
  const glowTex = radialTexture([[0, 'rgba(255,252,236,1)'], [0.35, 'rgba(255,226,150,1)'], [0.75, 'rgba(190,120,40,1)'], [1, 'rgba(40,24,8,1)']]);
  const cavity = new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false, color: 0x2a2a2a });
  const patchMap = patchTexture();
  const patchMat = new THREE.MeshStandardMaterial({ map: patchMap, roughness: 0.7 });

  /* ---------- body ---------- */
  const lowerGeo = new RoundedBoxGeometry(W, LOW_H, D, 6, 0.13);
  const lower = new THREE.Mesh(lowerGeo, fabric);
  lower.position.y = BASE_Y + LOW_H / 2;
  pack.add(lower);

  const baseGeo = new RoundedBoxGeometry(W + 0.012, 0.075, D + 0.012, 4, 0.03);
  const baseMesh = new THREE.Mesh(baseGeo, rubber);
  baseMesh.position.y = BASE_Y + 0.0375;
  pack.add(baseMesh);

  const cavityGeo = new THREE.PlaneGeometry(W - 0.2, D - 0.18);
  const cavityMesh = new THREE.Mesh(cavityGeo, cavity);
  cavityMesh.rotation.x = -Math.PI / 2;
  cavityMesh.position.y = HC + 0.002;
  pack.add(cavityMesh);

  // front pocket, with its own (fixed) zipper, and a patch
  const pocketGeo = new RoundedBoxGeometry(0.8, 0.46, 0.17, 5, 0.07);
  const pocket = new THREE.Mesh(pocketGeo, fabric2);
  pocket.position.set(0, -0.43, D / 2 + 0.045);
  pack.add(pocket);
  const pocketZipGeo = new THREE.BoxGeometry(0.66, 0.012, 0.012);
  const pocketZip = new THREE.Mesh(pocketZipGeo, brass);
  pocketZip.position.set(0, -0.225, D / 2 + 0.128);
  pack.add(pocketZip);
  const patchGeo = new THREE.PlaneGeometry(0.2, 0.1);
  const patch = new THREE.Mesh(patchGeo, patchMat);
  patch.position.set(0.22, -0.5, D / 2 + 0.132);
  pack.add(patch);

  // side bottle pockets
  const sideGeo = new RoundedBoxGeometry(0.17, 0.5, 0.36, 5, 0.06);
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(sideGeo, fabric2);
    m.position.set(s * (W / 2 + 0.03), -0.4, 0.02);
    pack.add(m);
  });

  // grab handle and back straps
  const carryGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12, HC + 0.1, -0.17), new THREE.Vector3(-0.1, HC + 0.26, -0.17), new THREE.Vector3(0.1, HC + 0.26, -0.17), new THREE.Vector3(0.12, HC + 0.1, -0.17)]),
    24, 0.024, 8, false,
  );
  const carryHandle = new THREE.Mesh(carryGeo, webbing);
  pack.add(carryHandle);
  const strapGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.28, -D / 2 - 0.012), new THREE.Vector3(0.02, -0.1, -D / 2 - 0.05), new THREE.Vector3(0.0, -0.52, -D / 2 - 0.02)]),
    30, 0.07, 8, false,
  );
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(strapGeo, webbing);
    m.position.x = s * 0.27;
    m.scale.z = 0.28;
    pack.add(m);
  });

  /* ---------- the lid: a sheet hinged at the back, peeled up behind the slider ---------- */
  const profilePts = [
    [-D / 2 + 0.0, HC - 0.02], [-D / 2 + 0.06, HC + 0.07], [-0.12, HC + 0.115], [0.1, HC + 0.115],
    [D / 2 - 0.05, HC + 0.085], [D / 2 + 0.006, HC + 0.0], [D / 2 + 0.012, SEAM_Y],
  ].map(([z, y]) => new THREE.Vector2(z, y));
  const profile = new THREE.SplineCurve(profilePts).getPoints(NV);
  const hingeZ = -D / 2 + 0.005;
  const hingeY = HC - 0.015;

  const lidPositions = new Float32Array((NU + 1) * (NV + 1) * 3);
  const lidGeo = new THREE.BufferGeometry();
  lidGeo.setAttribute('position', new THREE.BufferAttribute(lidPositions, 3));
  const lidUv = new Float32Array((NU + 1) * (NV + 1) * 2);
  const lidIndex: number[] = [];
  for (let iu = 0; iu <= NU; iu++) {
    for (let iv = 0; iv <= NV; iv++) {
      const k = iu * (NV + 1) + iv;
      lidUv[k * 2] = (iu / NU) * 3;
      lidUv[k * 2 + 1] = (iv / NV) * 2;
      if (iu < NU && iv < NV) {
        const a = k;
        const b = k + (NV + 1);
        lidIndex.push(a, a + 1, b, b, a + 1, b + 1); // counter-clockwise seen from outside
      }
    }
  }
  lidGeo.setAttribute('uv', new THREE.BufferAttribute(lidUv, 2));
  lidGeo.setIndex(lidIndex);
  const lidOuter = new THREE.Mesh(lidGeo, fabric);
  const lidInnerMesh = new THREE.Mesh(lidGeo, lidInner);
  lidOuter.frustumCulled = lidInnerMesh.frustumCulled = false;
  pack.add(lidOuter, lidInnerMesh);

  const liftAt = (u: number, p: number) => smooth((sliderU(p) - u) / RAMP) * smooth(p / 0.05) * LIFT_MAX;

  /* ---------- zipper: teeth, slider, puller ---------- */
  const toothGeo = new RoundedBoxGeometry(0.0115, 0.014, 0.02, 1, 0.003);
  const teethBody = new THREE.InstancedMesh(toothGeo, brass, TEETH);
  const teethLid = new THREE.InstancedMesh(toothGeo, brass, TEETH);
  teethBody.frustumCulled = teethLid.frustumCulled = false;
  pack.add(teethBody, teethLid);
  const pitch = ((ZIP_HI - ZIP_LO + 0.04) * W) / TEETH;
  const toothX = (k: number, half: number) => ((ZIP_LO - 0.02 + ((k + 0.5) / TEETH) * (ZIP_HI - ZIP_LO + 0.04)) - 0.5) * W + half * pitch * 0.5;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < TEETH; k++) {
    m4.compose(new THREE.Vector3(toothX(k, 1), SEAM_Y, SEAM_Z + 0.002), q.identity(), one);
    teethBody.setMatrixAt(k, m4);
  }
  teethBody.instanceMatrix.needsUpdate = true;

  const tape = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.03, 0.006), rubber);
  tape.position.set(0, SEAM_Y - 0.02, SEAM_Z - 0.004);
  pack.add(tape);

  const slider = new THREE.Group();
  const sliderBody = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.055, 0.06, 3, 0.014), brass);
  const sliderCap = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.02, 0.05, 2, 0.008), brass);
  sliderCap.position.y = 0.036;
  slider.add(sliderBody, sliderCap);
  const pullerPivot = new THREE.Group();
  pullerPivot.position.set(0, -0.03, 0.026);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0055, 8, 18), brass);
  ring.position.y = -0.012;
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.22, 0.016, 2, 0.007), puller);
  tab.position.y = -0.135;
  pullerPivot.add(ring, tab);
  slider.add(pullerPivot);
  // an invisible, generous target so the slider is easy to grab
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = -0.08;
  slider.add(proxy);
  pack.add(slider);

  /* ---------- light spilling out ---------- */
  const lamp = new THREE.PointLight(0xffe2a0, 0, 4.5, 1.5);
  lamp.position.set(0, HC + 0.22, 0.02);
  pack.add(lamp);
  const beamMap = beamTexture();
  const beams: Array<{ sprite: THREE.Sprite; u: number; phase: number; base: number }> = [];
  for (let i = 0; i < 9; i++) {
    const u = 0.14 + (i / 8) * 0.72;
    const mat = new THREE.SpriteMaterial({ map: beamMap, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(mat);
    const w = 0.22 + ((i * 37) % 5) * 0.045;
    const h = 0.7 + ((i * 53) % 4) * 0.16;
    s.scale.set(w, h, 1);
    s.position.set((u - 0.5) * W * 0.85, HC + 0.08 + h / 2, ((i % 3) - 1) * 0.08);
    pack.add(s);
    beams.push({ sprite: s, u, phase: i * 1.7, base: 0.5 + (i % 3) * 0.12 });
  }
  const haloMap = radialTexture([[0, 'rgba(255,240,190,0.95)'], [0.3, 'rgba(255,214,120,0.45)'], [1, 'rgba(255,190,80,0)']]);
  const haloMat = new THREE.SpriteMaterial({ map: haloMap, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, HC + 0.2, 0.05);
  halo.scale.setScalar(1.5);
  pack.add(halo);
  const nudgeMat = new THREE.SpriteMaterial({ map: haloMap, color: 0xffd400, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const nudge = new THREE.Sprite(nudgeMat); // a soft pulse on the puller that says "pull me"
  nudge.scale.setScalar(0.34);
  slider.add(nudge);

  /* ---------- state ---------- */
  let progress = 0;
  let dragging = false;
  let interactive = true;
  let latched = false;
  let active = true;
  let raf = 0;
  let last = performance.now();
  let disposed = false;
  let readyFired = false;
  let target: { from: number; to: number; start: number; ms: number; resolve: () => void } | null = null;
  let dragTarget = 0;
  let pullerSwing = 0;
  let pullerVel = 0;
  let lastSliderX = 0;
  let touched = false;
  let hoverSlider = false;
  let pointerX = 0;
  let width = 1;
  let height = 1;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  const resize = () => {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // frame the pack with room for the glow
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(0.84 / tanH, 0.8 / (tanH * camera.aspect)) * 1.04;
    const yaw = THREE.MathUtils.degToRad(15);
    const el = THREE.MathUtils.degToRad(24);
    const c = new THREE.Vector3(0, 0.06, 0);
    camera.position.set(c.x + dist * Math.sin(yaw) * Math.cos(el), c.y + dist * Math.sin(el), c.z + dist * Math.cos(yaw) * Math.cos(el));
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  };

  /** Screen position (client px) of a point in the pack's own space. */
  const toClient = (p: THREE.Vector3) => {
    const rect = canvas.getBoundingClientRect();
    tmp.copy(p);
    pack.localToWorld(tmp);
    tmp.project(camera);
    return { x: rect.left + (tmp.x * 0.5 + 0.5) * rect.width, y: rect.top + (-tmp.y * 0.5 + 0.5) * rect.height };
  };

  /** Progress (0..1) of the seam point nearest to a pointer position. */
  const progressFromPointer = (cx: number, cy: number) => {
    const pts: Array<{ x: number; y: number; u: number }> = [];
    for (let i = 0; i <= 40; i++) {
      const u = lerp(ZIP_LO, ZIP_HI, i / 40);
      const c = toClient(new THREE.Vector3((u - 0.5) * W, SEAM_Y, SEAM_Z));
      pts.push({ ...c, u });
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = clamp(((cx - a.x) * dx + (cy - a.y) * dy) / len2, 0, 1);
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d2 = (cx - px) ** 2 + (cy - py) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = i + t;
      }
    }
    return clamp(best / 40, 0, 1);
  };

  /* ---------- input ---------- */
  const pickSlider = (cx: number, cy: number) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(proxy, false).length > 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!interactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!pickSlider(e.clientX, e.clientY)) return;
    dragging = true;
    touched = true;
    target = null;
    dragTarget = progress;
    canvas.style.cursor = 'grabbing';
    events.onGrab(true);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events can refuse capture
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    pointerX = (e.clientX - canvas.getBoundingClientRect().left) / Math.max(1, canvas.getBoundingClientRect().width) - 0.5;
    if (dragging) {
      dragTarget = progressFromPointer(e.clientX, e.clientY);
      return;
    }
    const over = interactive && pickSlider(e.clientX, e.clientY);
    if (over !== hoverSlider) {
      hoverSlider = over;
      canvas.style.cursor = over ? 'grab' : '';
    }
  };

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = hoverSlider ? 'grab' : '';
    events.onGrab(false);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    // let go: past the halfway mark it finishes opening by itself, otherwise it zips shut again
    void handle.animateTo(progress > 0.55 ? 1 : 0, 520);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  const onLost = (e: Event) => {
    e.preventDefault();
    events.onError(new Error('WebGL context lost'));
  };
  canvas.addEventListener('webglcontextlost', onLost);

  /* ---------- frame ---------- */
  const frame = (now: number) => {
    raf = 0;
    if (disposed || !active) return;
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    const t = now / 1000;

    if (dragging) {
      progress += (dragTarget - progress) * (1 - Math.exp(-dt * 24));
    } else if (target) {
      const k = clamp((now - target.start) / Math.max(1, target.ms), 0, 1);
      progress = lerp(target.from, target.to, easeInOut(k));
      if (k >= 1) {
        const done = target.resolve;
        progress = target.to;
        target = null;
        done();
      }
    }
    progress = clamp(progress, 0, 1);
    if (progress >= 0.82 && !latched) {
      latched = true;
      events.onThreshold();
    }
    if (progress < 0.04 && !dragging) latched = false;

    // lid
    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU;
      const theta = liftAt(u, progress);
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const x = (u - 0.5) * (W - 0.02);
      const edge = smooth(Math.min(u, 1 - u) / 0.07); // the lid flattens onto the body at both ends: no open sides
      for (let iv = 0; iv <= NV; iv++) {
        const pt = profile[iv];
        const dz = pt.x - hingeZ;
        const dy = HC + (pt.y - HC) * edge - hingeY;
        const k = (iu * (NV + 1) + iv) * 3;
        lidPositions[k] = x;
        lidPositions[k + 1] = hingeY + dz * s + dy * c;
        lidPositions[k + 2] = hingeZ + dz * c - dy * s;
      }
    }
    lidGeo.attributes.position.needsUpdate = true;
    lidGeo.computeVertexNormals();

    // lid-side teeth ride on the lip; body-side teeth stay put
    for (let k = 0; k < TEETH; k++) {
      const u = ZIP_LO - 0.02 + ((k + 0.5) / TEETH) * (ZIP_HI - ZIP_LO + 0.04);
      const theta = liftAt(clamp(u, 0, 1), progress);
      const z0 = D / 2 + 0.012 - hingeZ;
      const y0 = SEAM_Y - hingeY;
      const pos = new THREE.Vector3(toothX(k, -1), hingeY + z0 * Math.sin(theta) + y0 * Math.cos(theta), hingeZ + z0 * Math.cos(theta) - y0 * Math.sin(theta) + 0.002);
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -theta * 0.4);
      m4.compose(pos, q, one);
      teethLid.setMatrixAt(k, m4);
    }
    teethLid.instanceMatrix.needsUpdate = true;

    // slider and puller
    const sx = (sliderU(progress) - 0.5) * W;
    slider.position.set(sx, SEAM_Y + 0.003, SEAM_Z + 0.03);
    const vx = (sx - lastSliderX) / dt;
    lastSliderX = sx;
    pullerVel += (-18 * pullerSwing - 3.2 * pullerVel - vx * 2.4) * dt;
    pullerSwing = clamp(pullerSwing + pullerVel * dt, -0.7, 0.7);
    pullerPivot.rotation.z = reduced ? 0 : pullerSwing;
    const wait = !touched && progress < 0.02;
    nudgeMat.opacity = wait && !reduced ? 0.28 + 0.22 * Math.sin(t * 3.1) : 0;
    nudge.position.set(0, -0.15, 0.03);

    // light
    const open = smooth(progress * 1.25);
    lamp.intensity = open * 16;
    cavity.color.setScalar(lerp(0.16, 1, open));
    lidInner.emissiveIntensity = open * 1.4;
    haloMat.opacity = open * 0.5;
    beams.forEach((b) => {
      const reach = smooth((sliderU(progress) - b.u) / 0.18); // a beam appears once the zipper has passed it
      const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(t * 1.6 + b.phase);
      (b.sprite.material as THREE.SpriteMaterial).opacity = reach * b.base * 0.55 * flick;
    });

    // gentle life: a slow sway and a lean toward the pointer, never while it is being zipped
    const calm = dragging ? 0.25 : 1;
    const sway = reduced ? 0 : Math.sin(t * 0.5) * 0.06 * calm;
    pack.rotation.y += (sway + pointerX * 0.16 * calm - pack.rotation.y) * (1 - Math.exp(-dt * 3));
    pack.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.012;

    events.onProgress(progress);
    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      events.onReady();
    }
    const busy = !reduced || dragging || target !== null || Math.abs(pullerVel) > 0.01 || wait;
    if (busy) raf = requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf && active && !disposed) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  // reduced motion renders on demand; wake it on any input
  const poke = window.setInterval(schedule, 120);

  const ro = new ResizeObserver(() => {
    resize();
    schedule();
  });
  ro.observe(canvas);
  resize();

  const handle: BackpackHandle = {
    setActive(next) {
      active = next;
      if (next) schedule();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    setReducedMotion(next) {
      reduced = next;
      schedule();
    },
    setInteractive(on) {
      interactive = on;
      if (!on) {
        hoverSlider = false;
        canvas.style.cursor = '';
      }
    },
    animateTo(to, ms) {
      return new Promise<void>((resolve) => {
        if (target) target.resolve();
        if (reduced || ms <= 1 || Math.abs(to - progress) < 0.001) {
          progress = to;
          target = null;
          schedule();
          resolve();
          return;
        }
        target = { from: progress, to, start: performance.now(), ms, resolve };
        schedule();
      });
    },
    getProgress: () => progress,
    getMouthPoint: () => toClient(new THREE.Vector3(0, HC + 0.16, 0.02)),
    rearm() {
      latched = false;
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(poke);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) mesh.geometry?.dispose();
      });
      [fabric, fabric2, lidInner, rubber, webbing, brass, puller, cavity, patchMat, haloMat, nudgeMat].forEach((m) => m.dispose());
      beams.forEach((b) => (b.sprite.material as THREE.Material).dispose());
      [weave, weave2, glowTex, patchMap, beamMap, haloMap].forEach((t) => t.dispose());
      teethBody.dispose();
      teethLid.dispose();
      env.dispose();
      renderer.dispose();
    },
  };
  schedule();
  return handle;
}
