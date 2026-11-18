/**
 * The rotating four-tag garment rack used as the portfolio's landing navigation.
 *
 * Built from a reference recording of a physical rack (a 24.9 s screen capture, studied frame by frame):
 * a chrome tube over a matte black tube forming one ring, black cube trolleys with short stems,
 * round open crook hooks, shallow triangular wire hangers, clear sleeves, vertical rods with flat
 * brackets, a camera below the ring, and motion that is inertial: the ring spins with momentum and
 * the hanging tags lag it, swinging in their own plane about the hook.
 *
 * Exactly `tags.length` hangers are built, evenly spaced; nothing decorative.
 * Everything here is original geometry and tuned numbers; measured values from the recording are
 * estimates taken from sampled frames, not exact dimensions.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { decodeAnimated, type DecodedFrames } from '@/lib/hub/animated-image';
import type { HubTag } from '@/lib/hub/tags';

/* ------------------------------------------------------------------ public API */

export type RackEvents = {
  /** A tag was clicked or tapped (not dragged). */
  onPick: (index: number) => void;
  /** Pointer is over a tag (index) or left it (-1), with viewport coordinates for a tooltip. */
  onHover: (index: number, clientX: number, clientY: number) => void;
  /** The tag nearest the viewer changed. */
  onFront: (index: number) => void;
  /** First frame has been drawn. */
  onReady: () => void;
  /** WebGL is unavailable or the context was lost. */
  onError: (error: unknown) => void;
};

export type RackOptions = {
  canvas: HTMLCanvasElement;
  tags: HubTag[];
  reducedMotion: boolean;
  fonts: { display: string; body: string; mono: string };
  initial: { phi: number; paused: boolean };
  events: RackEvents;
};

export type RackHandle = {
  /** Start / stop drawing (stopped when the hub is hidden). */
  setActive: (active: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setPaused: (paused: boolean) => void;
  /** Rotate the ring so tag `index` faces the viewer. */
  focusTag: (index: number) => void;
  /** Keyboard focus highlight; -1 clears it. */
  setKeyboardFocus: (index: number) => void;
  /** Quarter-turn to the next (+1) or previous (-1) tag. */
  step: (direction: 1 | -1) => void;
  /** Bring a tag to the camera; resolves at the moment the page should navigate. */
  select: (index: number) => Promise<void>;
  /** Reverse of `select`, played when the hanger comes back. */
  arrive: (index: number) => void;
  /** Push in a little further while the hub fades out. */
  finish: () => void;
  cancelSelect: () => void;
  getState: () => { phi: number; front: number };
  dispose: () => void;
};

/* ------------------------------------------------------------------ geometry constants */

const TAU = Math.PI * 2;
const RING_R = 0.95;
const CHROME_R = 0.022;
const BLACK_R = 0.02;
const BLACK_Y = -0.043;
const TROLLEY = { x: 0.11, y: 0.072, z: 0.07 };
const STEM_R = 0.0065;
const STEM_LEN = 0.022;
/** Pivot of every hanger: the bottom of the stem, in slot space (ring centre is y = 0). */
const PIVOT_Y = BLACK_Y - TROLLEY.y / 2 - STEM_LEN;

const HOOK_RHO = 0.056;
const HOOK_WIRE = 0.0054;
const APEX_Y = -0.19;
const BAR_Y = -0.334;
const HANGER_HALF = 0.31;
const HANGER_WIRE = 0.0042;

const CARD_W = 0.58;
const CARD_H = CARD_W * (4 / 3);
const CARD_T = 0.006;
const CARD_TOP = BAR_Y - 0.02;
const CARD_CY = CARD_TOP - CARD_H / 2;
const BAG_HALF = CARD_W / 2 + 0.028;
const BAG_BOTTOM = CARD_TOP - CARD_H - 0.035;

const FLOOR_Y = -1.75;

/* ------------------------------------------------------------------ tiny helpers */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** CSS-style cubic-bezier easing, the same curve family the rest of the site uses. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let s = t;
    for (let i = 0; i < 16; i++) {
      const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  };
}
const easeOut = cubicBezier(0.16, 1, 0.3, 1);
const easeInOut = cubicBezier(0.65, 0, 0.35, 1);

type Tween = { from: number; to: number; start: number; duration: number; ease: (t: number) => number; done?: () => void };

function sampleTween(tween: Tween, now: number): { value: number; finished: boolean } {
  const t = (now - tween.start) / tween.duration;
  if (t >= 1) return { value: tween.to, finished: true };
  return { value: lerp(tween.from, tween.to, tween.ease(Math.max(0, t))), finished: false };
}

/** A path through `points` with its corners rounded by quadratic curves. */
function roundedClosedPath(points: THREE.Vector3[], radius: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const n = points.length;
  const corner = (i: number) => {
    const prev = points[(i + n - 1) % n];
    const here = points[i];
    const next = points[(i + 1) % n];
    const a = here.clone().add(prev.clone().sub(here).normalize().multiplyScalar(radius));
    const b = here.clone().add(next.clone().sub(here).normalize().multiplyScalar(radius));
    return { a, b, here };
  };
  for (let i = 0; i < n; i++) {
    const c = corner(i);
    const next = corner((i + 1) % n);
    path.add(new THREE.QuadraticBezierCurve3(c.a, c.here, c.b));
    path.add(new THREE.LineCurve3(c.b, next.a));
  }
  return path;
}

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function shapeGeometry(shape: THREE.Shape, w: number, h: number) {
  const g = new THREE.ShapeGeometry(shape, 8);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

/* ------------------------------------------------------------------ card artwork */

const PX_W = 768;
const PX_H = 1024;
const WIN = { x: 44, y: 112, w: 680, h: 526, r: 20 };
const PAPER = '#f8f7f3';
const INK = '#0d0d0d';
const YELLOW = '#ffd400';
const WIN_ASPECT = WIN.w / WIN.h;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function nameFontSize(ctx: CanvasRenderingContext2D, tags: HubTag[], display: string) {
  let size = 128;
  setSpacing(ctx, -3);
  for (; size > 60; size -= 2) {
    ctx.font = `800 ${size}px ${display}`;
    if (tags.every((t) => ctx.measureText(t.label).width <= WIN.w)) break;
  }
  return size;
}

function drawCard(tag: HubTag, index: number, total: number, fonts: RackOptions['fonts'], nameSize: number) {
  const canvas = document.createElement('canvas');
  canvas.width = PX_W;
  canvas.height = PX_H;
  const ctx = canvas.getContext('2d')!;

  // paper stock with a hairline edge and the site's yellow tab
  roundRectPath(ctx, 0, 0, PX_W, PX_H, 34);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, PX_W, 16);
  ctx.restore();
  roundRectPath(ctx, 1.5, 1.5, PX_W - 3, PX_H - 3, 33);
  ctx.strokeStyle = 'rgba(13,13,13,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // header: 01 / 04 and the monogram
  ctx.textBaseline = 'alphabetic';
  setSpacing(ctx, 0);
  ctx.font = `700 34px ${fonts.mono}`;
  ctx.fillStyle = INK;
  const num = String(index + 1).padStart(2, '0');
  ctx.fillText(num, 48, 82);
  const numW = ctx.measureText(num).width;
  ctx.font = `500 34px ${fonts.mono}`;
  ctx.fillStyle = 'rgba(13,13,13,0.5)';
  ctx.fillText(` / ${String(total).padStart(2, '0')}`, 48 + numW, 82);
  roundRectPath(ctx, 664, 44, 60, 46, 9);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = `700 24px ${fonts.mono}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText('MM', 694, 76);
  ctx.textAlign = 'left';

  // media window (black; the live picture is a separate plane laid over it)
  roundRectPath(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
  ctx.fillStyle = INK;
  ctx.fill();

  // section name, large and plain so it stays readable beside the picture
  ctx.fillStyle = INK;
  ctx.font = `800 ${nameSize}px ${fonts.display}`;
  setSpacing(ctx, -3);
  ctx.fillText(tag.label, WIN.x, 640 + nameSize * 0.98);
  setSpacing(ctx, 0);

  // one-line description from the section itself
  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillStyle = 'rgba(13,13,13,0.68)';
  const lines = wrapLines(ctx, tag.blurb, WIN.w, 2);
  const top = 640 + nameSize * 0.98 + 52;
  lines.forEach((line, i) => ctx.fillText(line, WIN.x, top + i * 40));

  // footer rule and affordance
  ctx.fillStyle = 'rgba(13,13,13,0.16)';
  ctx.fillRect(WIN.x, 952, WIN.w, 2);
  ctx.font = `600 22px ${fonts.mono}`;
  setSpacing(ctx, 3);
  ctx.fillStyle = INK;
  ctx.fillText('OPEN SECTION', WIN.x, 994);
  ctx.textAlign = 'right';
  ctx.fillText('→', WIN.x + WIN.w, 994);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);
  return canvas;
}

/** Draw `img` into a canvas the size of the media window, cover-cropped around `focus`. */
function coverCanvas(img: CanvasImageSource, iw: number, ih: number, outW: number, outH: number, focus: [number, number]) {
  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outH;
  const g = c.getContext('2d')!;
  const aspect = outW / outH;
  let sw = iw;
  let sh = iw / aspect;
  if (sh > ih) {
    sh = ih;
    sw = ih * aspect;
  }
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (iw - sw) * focus[0], (ih - sh) * focus[1], sw, sh, 0, 0, outW, outH);
  return c;
}

/* ------------------------------------------------------------------ the rack */

type TagRig = {
  index: number;
  slotAngle: number;
  slot: THREE.Group;
  swivel: THREE.Group;
  sway: THREE.Group;
  proxy: THREE.Mesh;
  cardMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
  windows: THREE.Mesh[];
  // dynamics
  yaw: number;
  yawVel: number;
  swing: number;
  swingVel: number;
  nod: number;
  nodVel: number;
  hover: number;
  selected: number;
  phase: number;
  // media
  frames: THREE.CanvasTexture[] | null;
  delays: number[];
  duration: number;
  frameIndex: number;
  video: HTMLVideoElement | null;
  videoTex: THREE.VideoTexture | null;
  videoReady: boolean;
  posterTex: THREE.CanvasTexture | null;
  cardTex: THREE.CanvasTexture | null;
};

export function createHangerRack(options: RackOptions): RackHandle {
  const { canvas, tags, events } = options;
  const count = tags.length;
  let reduced = options.reducedMotion;
  let paused = options.initial.paused;

  /* ---------- renderer, scene, camera ---------- */
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    events.onError(error);
    return {
      setActive() {}, setReducedMotion() {}, setPaused() {}, focusTag() {}, setKeyboardFocus() {}, step() {},
      select: () => Promise.resolve(), arrive() {}, finish() {}, cancelSelect() {}, getState: () => ({ phi: 0, front: 0 }), dispose() {},
    };
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1.6, 4.4, 2.4);
  key.target.position.set(0, -0.6, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 10;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  scene.add(key, key.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---------- materials ---------- */
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf3f5f7, metalness: 1, roughness: 0.13 });
  const blackTube = new THREE.MeshStandardMaterial({ color: 0x0d0f13, metalness: 0.5, roughness: 0.3 });
  const trolleyMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, metalness: 0.15, roughness: 0.6 });
  const wire = new THREE.MeshStandardMaterial({ color: 0x969ba3, metalness: 1, roughness: 0.3, envMapIntensity: 0.9 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: 1, roughness: 0.28 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x777a80, metalness: 0.25, roughness: 0.62 });
  const bagMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.13, roughness: 0.12, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });

  /* ---------- static rack: ring, rods ---------- */
  const rack = new THREE.Group();
  scene.add(rack);

  const chromeRing = new THREE.Mesh(new THREE.TorusGeometry(RING_R, CHROME_R, 18, 192), chrome);
  chromeRing.rotation.x = Math.PI / 2;
  const blackRing = new THREE.Mesh(new THREE.TorusGeometry(RING_R, BLACK_R, 18, 192), blackTube);
  blackRing.rotation.x = Math.PI / 2;
  blackRing.position.y = BLACK_Y;
  chromeRing.castShadow = blackRing.castShadow = true;
  rack.add(chromeRing, blackRing);

  const rodGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 3.4, 14);
  const plateGeo = new THREE.BoxGeometry(0.26, 0.012, 0.055);
  const clampGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  for (let k = 0; k < count; k++) {
    const a = Math.PI / count + (k * TAU) / count; // halfway between hangers
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(RING_R * Math.sin(a), 1.68, RING_R * Math.cos(a));
    rod.castShadow = true;
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(RING_R * Math.sin(a), 0.045, RING_R * Math.cos(a));
    plate.rotation.y = a;
    plate.castShadow = true;
    const clamp = new THREE.Mesh(clampGeo, trolleyMat);
    clamp.position.set(RING_R * Math.sin(a), -0.012, RING_R * Math.cos(a));
    clamp.rotation.y = a;
    rack.add(rod, plate, clamp);
  }

  /* ---------- shared hanger geometry ---------- */
  const hookCentre = new THREE.Vector3(0.12 * HOOK_RHO, -HOOK_RHO, 0);
  const hookPoints: THREE.Vector3[] = [];
  for (let deg = 196; deg >= -78; deg -= 14) {
    const a = THREE.MathUtils.degToRad(deg);
    hookPoints.push(new THREE.Vector3(hookCentre.x + HOOK_RHO * Math.cos(a), hookCentre.y + HOOK_RHO * Math.sin(a), 0));
  }
  [[0.1, -2.13], [0.0, -2.3], [0.0, -2.62], [0.0, APEX_Y / HOOK_RHO]].forEach(([x, y]) =>
    hookPoints.push(new THREE.Vector3(x * HOOK_RHO, y * HOOK_RHO, 0)),
  );
  const hookGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hookPoints, false, 'centripetal'), 140, HOOK_WIRE, 10, false);
  const tipGeo = new THREE.SphereGeometry(HOOK_WIRE, 10, 8);
  const hangerGeo = new THREE.TubeGeometry(
    roundedClosedPath(
      [new THREE.Vector3(0, APEX_Y, 0), new THREE.Vector3(HANGER_HALF, BAR_Y, 0), new THREE.Vector3(-HANGER_HALF, BAR_Y, 0)],
      0.014,
    ),
    220,
    HANGER_WIRE,
    8,
    true,
  );
  const trolleyGeo = new RoundedBoxGeometry(TROLLEY.x, TROLLEY.y, TROLLEY.z, 2, 0.004);
  const stemGeo = new THREE.CylinderGeometry(STEM_R, STEM_R, STEM_LEN, 12);
  const bagShape = new THREE.Shape();
  bagShape.moveTo(0, APEX_Y - 0.008);
  bagShape.lineTo(BAG_HALF, BAR_Y - 0.004);
  bagShape.lineTo(BAG_HALF, BAG_BOTTOM + 0.01);
  bagShape.quadraticCurveTo(BAG_HALF, BAG_BOTTOM, BAG_HALF - 0.012, BAG_BOTTOM);
  bagShape.lineTo(-BAG_HALF + 0.012, BAG_BOTTOM);
  bagShape.quadraticCurveTo(-BAG_HALF, BAG_BOTTOM, -BAG_HALF, BAG_BOTTOM + 0.01);
  bagShape.lineTo(-BAG_HALF, BAR_Y - 0.004);
  bagShape.closePath();
  const bagGeo = new THREE.ShapeGeometry(bagShape, 6);
  const bagEdgeGeo = new THREE.TubeGeometry(
    roundedClosedPath(
      [
        new THREE.Vector3(0, APEX_Y - 0.008, 0),
        new THREE.Vector3(BAG_HALF, BAR_Y - 0.004, 0),
        new THREE.Vector3(BAG_HALF, BAG_BOTTOM, 0),
        new THREE.Vector3(-BAG_HALF, BAG_BOTTOM, 0),
        new THREE.Vector3(-BAG_HALF, BAR_Y - 0.004, 0),
      ],
      0.012,
    ),
    120,
    0.0016,
    4,
    true,
  );
  const cardGeo = new RoundedBoxGeometry(CARD_W, CARD_H, CARD_T, 2, 0.012);
  const winW = (WIN.w / PX_W) * CARD_W;
  const winH = (WIN.h / PX_H) * CARD_H;
  const winCY = CARD_CY + CARD_H / 2 - ((WIN.y + WIN.h / 2) / PX_H) * CARD_H;
  const winGeo = shapeGeometry(roundedRectShape(winW, winH, 0.012), winW, winH);
  const haloShape = roundedRectShape(CARD_W + 0.05, CARD_H + 0.05, 0.026);
  const haloGeo = shapeGeometry(haloShape, CARD_W + 0.05, CARD_H + 0.05);
  const proxyGeo = new THREE.BoxGeometry(CARD_W + 0.1, 1.1, 0.34);

  /* ---------- tags ---------- */
  const rigs: TagRig[] = tags.map((tag, i) => {
    const slotAngle = (-i * TAU) / count;
    const slot = new THREE.Group();
    slot.position.set(RING_R * Math.sin(slotAngle), 0, RING_R * Math.cos(slotAngle));
    slot.rotation.y = slotAngle;

    const trolley = new THREE.Mesh(trolleyGeo, trolleyMat);
    trolley.position.y = BLACK_Y;
    trolley.castShadow = true;
    const stem = new THREE.Mesh(stemGeo, trolleyMat);
    stem.position.y = BLACK_Y - TROLLEY.y / 2 - STEM_LEN / 2;
    slot.add(trolley, stem);

    const swivel = new THREE.Group();
    swivel.position.y = PIVOT_Y;
    const sway = new THREE.Group();
    swivel.add(sway);
    slot.add(swivel);

    const hook = new THREE.Mesh(hookGeo, wire);
    hook.castShadow = true;
    const tip = new THREE.Mesh(tipGeo, wire);
    tip.position.copy(hookPoints[0]);
    const hanger = new THREE.Mesh(hangerGeo, wire);
    hanger.castShadow = true;
    sway.add(hook, tip, hanger);

    const cardMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.position.y = CARD_CY;
    card.castShadow = true;
    sway.add(card);

    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const windows: THREE.Mesh[] = [];
    [1, -1].forEach((side) => {
      const w = new THREE.Mesh(winGeo, windowMat);
      w.position.set(0, winCY, side * (CARD_T / 2 + 0.0008));
      if (side < 0) w.rotation.y = Math.PI;
      w.visible = false;
      sway.add(w);
      windows.push(w);
    });

    const halo = new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    [1, -1].forEach((side) => {
      const h = new THREE.Mesh(haloGeo, halo);
      h.position.set(0, CARD_CY, -side * (CARD_T / 2 + 0.0012));
      if (side < 0) h.rotation.y = Math.PI;
      sway.add(h);
    });

    // clear sleeve around the card, one sheet each side so it reads as a flattened bag
    [1, -1].forEach((side) => {
      const sheet = new THREE.Mesh(bagGeo, bagMat);
      sheet.position.z = side * 0.013;
      sheet.renderOrder = 3;
      const edge = new THREE.Mesh(bagEdgeGeo, edgeMat);
      edge.position.z = side * 0.013;
      edge.renderOrder = 3;
      sway.add(sheet, edge);
    });

    const proxy = new THREE.Mesh(proxyGeo, hiddenMat);
    proxy.position.y = -0.55;
    proxy.userData.tag = i;
    swivel.add(proxy);

    rack.add(slot);
    return {
      index: i, slotAngle, slot, swivel, sway, proxy, cardMat, windowMat, halo, windows,
      yaw: 0, yawVel: 0, swing: 0, swingVel: 0, nod: 0, nodVel: 0, hover: 0, selected: 0, phase: i * 2.1,
      frames: null, delays: [], duration: 0, frameIndex: -1, video: null, videoTex: null, videoReady: false, posterTex: null, cardTex: null,
    };
  });

  // Readable by tests and tooling: the rack has exactly as many hangers as there are tags.
  canvas.dataset.hangers = String(rigs.length);

  /* ---------- sizing / camera framing ---------- */
  let width = 1;
  let height = 1;
  let tagScale = 1;
  let viewDist = 4;
  // The camera sits below the ring and looks level, as in the reference: the near arc rides high in
  // the frame, the tags hang in the middle, and the lower part is left for the caption. The distance
  // and height are solved from where the ring and the bottom of the front tag should land on screen.
  let lookY = -0.8;
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = smoothstep(0, 0.75, 1.25 - camera.aspect);
    tagScale = lerp(1, 1.32, portrait);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ringTop = 0.03;
    const tagBottom = PIVOT_Y + BAG_BOTTOM * tagScale;
    const ringNdc = lerp(0.76, 0.7, portrait);
    const bottomNdc = lerp(-0.52, -0.36, portrait);
    let k = (ringTop - tagBottom) / (ringNdc - bottomNdc); // world units per NDC at the front plane
    let dist = k / tanH + RING_R;
    // the whole ring, with a margin, must fit across the screen
    const fitWidth = RING_R / (tanH * camera.aspect * lerp(0.84, 0.86, portrait));
    let topNdc = ringNdc;
    if (fitWidth > dist) {
      dist = fitWidth;
      k = (dist - RING_R) * tanH;
      // width-limited (a phone): centre the rack in the space between the header and the caption
      const midY = (ringTop + tagBottom) / 2;
      topNdc = (ringTop - midY) / k + 0.2;
    }
    viewDist = dist;
    lookY = ringTop - topNdc * k;
    rigs.forEach((r) => r.sway.scale.setScalar(tagScale));
    camera.updateProjectionMatrix();
    needsFrame = true;
  };

  /* ---------- state ---------- */
  let phi = options.initial.phi;
  let phiVel = 0;
  let measuredVel = 0;
  let accel = 0;
  let timeScale = 1;
  let dragging = false;
  let pitch = 0; // camera elevation about the rack, radians (0 = level, below the ring)
  let pitchVel = 0;
  let idleSince = performance.now();
  let hoverIndex = -1;
  let keyboardIndex = -1;
  let selectedIndex = -1;
  let frontIndex = -1;
  let dolly = 0;
  let dollyTween: Tween | null = null;
  let phiTween: Tween | null = null;
  let extraZoom = 0;
  let extraTween: Tween | null = null;
  let active = true;
  let needsFrame = true;
  let raf = 0;
  let last = performance.now();
  let disposed = false;
  let readyFired = false;
  let uploadQueue: THREE.Texture[] = [];
  let pointerNeedsPick = false;
  let pointerInside = false;
  let lastPick = 0;
  let pointer = { x: 0, y: 0, type: 'mouse' };
  let pointerVelX = 0;

  const AUTO = 0.1; // rad/s, about 5.7 degrees per second
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /* ---------- picking ---------- */
  const pick = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      rigs.map((r) => r.proxy),
      false,
    );
    return hits.length ? (hits[0].object.userData.tag as number) : -1;
  };

  /* ---------- input ---------- */
  type Down = { id: number; x: number; y: number; lastX: number; lastY: number; moved: number; hit: number; type: string; t: number };
  let down: Down | null = null;
  const THRESH_MOUSE = 6;
  const THRESH_TOUCH = 10;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (down) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0, hit: pick(e.clientX, e.clientY), type: e.pointerType, t: performance.now() };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // some browsers refuse capture for synthetic events
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY, type: e.pointerType };
    pointerInside = true;
    if (!down || e.pointerId !== down.id) {
      pointerNeedsPick = true;
      needsFrame = true;
      return;
    }
    const dx = e.clientX - down.lastX;
    const dy = e.clientY - down.lastY;
    down.lastX = e.clientX;
    down.lastY = e.clientY;
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (!dragging && down.moved > (down.type === 'touch' ? THRESH_TOUCH : THRESH_MOUSE)) {
      dragging = true;
      phiTween = null;
      canvas.dataset.dragging = 'true';
      events.onHover(-1, 0, 0);
      hoverIndex = -1;
    }
    if (dragging) {
      const dPhi = (dx * (Math.PI / 2)) / (width * 0.42);
      phi += dPhi;
      pointerVelX = lerp(pointerVelX, dPhi / Math.max(1 / 240, (e.timeStamp - lastMoveStamp) / 1000), 0.35);
      lastMoveStamp = e.timeStamp;
      pitch = clamp(pitch + dy * 0.0035, -0.16, 0.6);
      pitchVel = 0;
      idleSince = performance.now();
      needsFrame = true;
    }
  };
  let lastMoveStamp = 0;

  const endDrag = (e: PointerEvent, cancelled: boolean) => {
    if (!down || e.pointerId !== down.id) return;
    const wasDragging = dragging;
    const start = down;
    down = null;
    dragging = false;
    delete canvas.dataset.dragging;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    if (wasDragging) {
      // let go with the speed the hand had (zero if it had already stopped), within reason
      phiVel = clamp(e.timeStamp - lastMoveStamp < 90 ? pointerVelX : 0, -3.2, 3.2);
      pointerVelX = 0;
      idleSince = performance.now();
      needsFrame = true;
    } else if (!cancelled && start.hit >= 0 && pick(e.clientX, e.clientY) === start.hit) {
      events.onPick(start.hit);
    }
  };
  const onPointerUp = (e: PointerEvent) => endDrag(e, false);
  const onPointerCancel = (e: PointerEvent) => endDrag(e, true);
  const onPointerLeave = () => {
    if (down) return;
    pointerInside = false;
    if (hoverIndex !== -1) {
      hoverIndex = -1;
      events.onHover(-1, 0, 0);
    }
    canvas.style.cursor = '';
  };

  const onWheel = (e: WheelEvent) => {
    if (selectedIndex >= 0) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY) * unit;
    phiTween = null;
    phiVel = clamp(phiVel + delta * 0.0055, -3.2, 3.2);
    idleSince = performance.now();
    needsFrame = true;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const onContextLost = (e: Event) => {
    e.preventDefault();
    events.onError(new Error('WebGL context lost'));
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  /* ---------- rotation helpers ---------- */
  const nearestPhi = (index: number) => {
    const target = (index * TAU) / count;
    return target + TAU * Math.round((phi - target) / TAU);
  };
  const turnTo = (index: number, duration?: number) => {
    const to = nearestPhi(index);
    const dist = Math.abs(to - phi);
    if (reduced || dist < 0.002) {
      phi = to;
      phiVel = 0;
      phiTween = null;
      needsFrame = true;
      return;
    }
    phiTween = {
      from: phi,
      to,
      start: performance.now(),
      duration: duration ?? clamp(520 + dist * 330, 560, 1150),
      ease: easeOut,
    };
    phiVel = 0;
    needsFrame = true;
  };

  /* ---------- media ---------- */
  const mediaFrames: Record<string, number> = {};
  const abort = new AbortController();
  const winPxW = coarse ? 384 : 512;
  const winPxH = Math.round(winPxW / WIN_ASPECT);

  const setWindowMap = (rig: TagRig, tex: THREE.Texture) => {
    rig.windowMat.map = tex;
    rig.windowMat.needsUpdate = true;
    rig.windows.forEach((w) => (w.visible = true));
    needsFrame = true;
  };

  const newCanvasTexture = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  const loadMedia = async (rig: TagRig) => {
    const tag = tags[rig.index];
    const media = tag.media;
    try {
      if (media.kind === 'animated') {
        const decoded: DecodedFrames = await decodeAnimated(media.src, {
          outW: winPxW,
          outH: winPxH,
          focus: media.focus,
          fit: media.fit,
          stillW: coarse ? 768 : 1024,
          firstFrameOnly: reduced,
          signal: abort.signal,
        });
        if (disposed) return;
        rig.frames = decoded.frames.map(newCanvasTexture);
        // Readable by tests and tooling: how many frames each tag's picture really has (1 = a still).
        mediaFrames[tag.id] = rig.frames.length;
        canvas.dataset.media = Object.keys(mediaFrames)
          .map((id) => `${id}:${mediaFrames[id]}`)
          .join(' ');
        rig.delays = decoded.delays;
        rig.duration = decoded.duration;
        rig.frameIndex = 0;
        setWindowMap(rig, rig.frames[0]);
        uploadQueue = uploadQueue.concat(rig.frames);
      } else {
        // The poster and the video are independent: if either one fails the other still shows.
        const startVideo = () => {
          const video = document.createElement('video');
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'auto';
          video.crossOrigin = 'anonymous';
          video.src = encodeURI(media.src);
          rig.video = video;
          video.addEventListener(
            'playing',
            () => {
              if (disposed || !rig.video) return;
              const tex = new THREE.VideoTexture(video);
              tex.colorSpace = THREE.SRGBColorSpace;
              // The video is wider than the window: crop it with the texture transform, no extra canvas.
              const va = video.videoWidth / video.videoHeight;
              if (va > WIN_ASPECT) {
                tex.repeat.x = WIN_ASPECT / va;
                tex.offset.x = (1 - tex.repeat.x) * media.focus[0];
              } else {
                tex.repeat.y = va / WIN_ASPECT;
                tex.offset.y = (1 - tex.repeat.y) * (1 - media.focus[1]);
              }
              rig.videoTex = tex;
              rig.videoReady = true;
              setWindowMap(rig, tex);
            },
            { once: true },
          );
          video.addEventListener('error', () => console.warn(`hanger: could not play the video for ${tag.id}`), { once: true });
          if (active) void video.play().catch(() => undefined);
        };

        // The still is instantly useful, and it is the whole story under reduced motion.
        const loadStill = async (src: string) => {
          const img = new Image();
          img.decoding = 'async';
          img.src = src;
          await img.decode();
          return img;
        };
        const showPoster = async () => {
          let img: HTMLImageElement;
          try {
            img = await loadStill(`/_next/image?url=${encodeURIComponent(media.poster)}&w=640&q=70`);
          } catch {
            img = await loadStill(media.poster); // optimiser unavailable: use the file itself
          }
          if (disposed || rig.videoReady) return;
          rig.posterTex = newCanvasTexture(coverCanvas(img, img.naturalWidth, img.naturalHeight, winPxW, winPxH, media.posterFocus));
          setWindowMap(rig, rig.posterTex);
          uploadQueue.push(rig.posterTex);
        };

        if (!reduced) startVideo();
        await showPoster().catch((error) => {
          if (!abort.signal.aborted) console.warn(`hanger: could not load the poster for ${tag.id}`, error);
        });
      }
    } catch (error) {
      // A missing or broken file just leaves the black window; the tag still navigates.
      if (!abort.signal.aborted) console.warn(`hanger: could not load media for ${tag.id}`, error);
    }
  };

  /** Draw the card faces once the site fonts are ready, then start the media one tag at a time. */
  const buildFacesAndMedia = async () => {
    const family = (f: string) => f.split(',')[0].trim();
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`800 100px ${family(options.fonts.display)}`),
          document.fonts.load(`500 30px ${family(options.fonts.body)}`),
          document.fonts.load(`600 24px ${family(options.fonts.mono)}`),
        ]),
        new Promise((resolve) => setTimeout(resolve, 1800)),
      ]);
    } catch {
      // fall through to whatever fonts are available
    }
    if (disposed) return;
    const probe = document.createElement('canvas').getContext('2d')!;
    const size = nameFontSize(probe, tags, options.fonts.display);
    rigs.forEach((rig, i) => {
      const art = drawCard(tags[i], i, count, options.fonts, size);
      const tex = newCanvasTexture(art);
      rig.cardTex = tex;
      rig.cardMat.map = tex;
      rig.cardMat.needsUpdate = true;
      uploadQueue.push(tex);
    });
    needsFrame = true;
    for (let i = 0; i < rigs.length; i++) {
      if (disposed) return;
      await loadMedia(rigs[i]);
    }
  };
  void buildFacesAndMedia();

  /* ---------- per-frame update ---------- */
  const SUB = 1 / 120;

  const stepRig = (rig: TagRig, now: number, dt: number) => {
    const theta = wrapPi(phi + rig.slotAngle);
    const isHover = hoverIndex === rig.index || keyboardIndex === rig.index;
    rig.hover += ((isHover ? 1 : 0) - rig.hover) * (1 - Math.exp(-dt * 9));
    rig.selected += ((selectedIndex === rig.index ? 1 : 0) - rig.selected) * (1 - Math.exp(-dt * 7));

    // swivel toward the viewer when hovered, focused or chosen
    const reach = smoothstep(Math.PI * 0.84, Math.PI * 0.64, Math.abs(theta));
    const face = Math.max(rig.hover * 0.9 * reach, rig.selected);
    let targetYaw = -theta * face;
    targetYaw += TAU * Math.round((rig.yaw - targetYaw) / TAU);
    const turn = reduced ? 30 : 9;

    const t = now / 1000;
    const idleLean = reduced ? 0 : 0.012 * Math.sin(t * 0.7 + rig.phase) + 0.007 * Math.sin(t * 1.3 + rig.phase * 2);
    const nodTarget = -0.15 * Math.max(rig.hover, rig.selected * 0.6) + (reduced ? 0 : 0.005 * Math.sin(t * 0.9 + rig.phase));
    // pendulum about the stem: heavy, lightly damped, pushed by the ring's acceleration
    const wSwing = 4.1;
    // lightly damped, but it settles as a chosen tag is brought up to the camera
    const zSwing = reduced ? 0.9 : lerp(0.2, 0.8, rig.selected);
    const push = clamp(((RING_R * accel) / 0.62) * 0.55, -5, 5);

    let n = Math.max(1, Math.ceil(dt / SUB));
    const h = dt / n;
    while (n--) {
      rig.yawVel += (turn * turn * (targetYaw - rig.yaw) - 2 * 0.85 * turn * rig.yawVel) * h;
      rig.yaw += rig.yawVel * h;
      rig.swingVel += (-wSwing * wSwing * (rig.swing - idleLean) - 2 * zSwing * wSwing * rig.swingVel - (reduced ? 0 : push)) * h;
      rig.swing += rig.swingVel * h;
      rig.nodVel += (-30 * (rig.nod - nodTarget) - 2 * 0.5 * 5.5 * rig.nodVel) * h;
      rig.nod += rig.nodVel * h;
    }
    rig.swing = clamp(rig.swing, -0.3, 0.3);

    rig.swivel.rotation.y = rig.yaw;
    rig.sway.rotation.z = rig.swing;
    rig.sway.rotation.x = rig.nod;
    const grow = 1 + 0.035 * rig.selected;
    rig.sway.scale.setScalar(tagScale * grow);

    // shade the printed faces a little as they turn edge-on, like paper under one light
    const toCamera = Math.abs(Math.cos(theta + rig.yaw));
    const shade = lerp(0.84, 1, smoothstep(0.1, 0.95, toCamera));
    rig.cardMat.color.setScalar(shade);
    rig.windowMat.color.setScalar(lerp(0.9, 1, smoothstep(0.1, 0.95, toCamera)));
    rig.halo.opacity = 0.95 * Math.max(rig.hover, rig.selected);
  };

  const cardWorldCentreY = () => PIVOT_Y + CARD_CY * tagScale;

  const frame = (now: number) => {
    raf = 0;
    if (disposed || !active) return;
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;

    // --- hover picking: when the pointer moves, and a few times a second while the ring turns
    //     under a pointer that is resting, so hover never goes stale ---
    if (pointerInside && !down && pointer.type !== 'touch' && now - lastPick > 90 && (Math.abs(phiVel) > 0.002 || phiTween)) pointerNeedsPick = true;
    if (pointerNeedsPick && !down && selectedIndex < 0 && pointer.type !== 'touch') {
      pointerNeedsPick = false;
      lastPick = now;
      const hit = pick(pointer.x, pointer.y);
      if (hit !== hoverIndex) {
        if (hit >= 0 && !reduced) {
          const r = rigs[hit];
          const kick = clamp(pointerVelX || (Math.random() > 0.5 ? 1 : -1) * 0.4, -1, 1);
          r.swingVel += 0.5 * Math.sign(kick || 1);
        }
        hoverIndex = hit;
        canvas.style.cursor = hit >= 0 ? 'pointer' : '';
      }
      events.onHover(hit, pointer.x, pointer.y);
    } else if (down === null && hoverIndex >= 0 && pointer.type === 'touch') {
      hoverIndex = -1;
    }

    // --- ring rotation ---
    const prevPhi = phi;
    if (phiTween) {
      const s = sampleTween(phiTween, now);
      phi = s.value;
      if (s.finished) {
        const done = phiTween.done;
        phiTween = null;
        idleSince = now;
        if (done) done();
      }
    } else if (!dragging) {
      // Slow right down while a tag is under the pointer so it is easy to hit; otherwise cruise.
      const hovering = hoverIndex >= 0 || keyboardIndex >= 0;
      timeScale += ((hovering ? 0.1 : 1) - timeScale) * (1 - Math.exp(-dt * 3));
      const cruise = paused || reduced || selectedIndex >= 0 ? 0 : AUTO * timeScale;
      // A flick or wheel turn carries on with momentum and eases back to the cruising speed.
      phiVel += (cruise - phiVel) * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(phiVel) < 1e-4 && cruise === 0) phiVel = 0;
      phi += phiVel * dt;
    }
    const vel = (phi - prevPhi) / dt;
    accel = lerp(accel, (vel - measuredVel) / dt, 0.35);
    measuredVel = lerp(measuredVel, vel, 0.5);
    rack.rotation.y = phi;

    // --- camera pitch eases back to its resting view once the hand is off ---
    if (!dragging && now - idleSince > 2600 && Math.abs(pitch) > 0.001) {
      pitch += (0 - pitch) * (1 - Math.exp(-dt * 1.6));
    }

    // --- select / arrive dolly ---
    if (dollyTween) {
      const s = sampleTween(dollyTween, now);
      dolly = s.value;
      if (s.finished) {
        const done = dollyTween.done;
        dollyTween = null;
        if (done) done();
      }
    }
    if (extraTween) {
      const s = sampleTween(extraTween, now);
      extraZoom = s.value;
      if (s.finished) extraTween = null;
    }

    // --- tags ---
    rigs.forEach((rig) => stepRig(rig, now, dt));

    // --- front tag bookkeeping ---
    let best = 0;
    let bestCos = -2;
    rigs.forEach((rig) => {
      const c = Math.cos(phi + rig.slotAngle);
      if (c > bestCos) {
        bestCos = c;
        best = rig.index;
      }
    });
    if (best !== frontIndex) {
      frontIndex = best;
      events.onFront(best);
    }

    // --- animated media ---
    rigs.forEach((rig) => {
      if (rig.frames && rig.duration > 0 && !reduced && rig.frames.length > 1) {
        let t = now % rig.duration;
        let i = 0;
        while (i < rig.delays.length - 1 && t >= rig.delays[i]) {
          t -= rig.delays[i];
          i++;
        }
        if (i !== rig.frameIndex) {
          rig.frameIndex = i;
          rig.windowMat.map = rig.frames[i];
        }
      }
    });
    const upload = uploadQueue.shift();
    if (upload) renderer.initTexture(upload);

    // --- camera ---
    const home = new THREE.Vector3(0, lookY + viewDist * Math.sin(pitch), viewDist * Math.cos(pitch));
    const look = new THREE.Vector3(0, lookY, 0);
    if (dolly > 0.0001 || extraZoom > 0) {
      const rig = rigs[selectedIndex >= 0 ? selectedIndex : Math.max(0, rigs.findIndex((r) => r.selected > 0.01))] ?? rigs[0];
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const need = Math.max((CARD_H * tagScale) / 0.74, (CARD_W * tagScale) / (0.74 * camera.aspect * (width < height ? 1 : 0.62))) / (2 * tanH);
      const centreY = cardWorldCentreY();
      const e = clamp(dolly, 0, 1);
      const closePos = new THREE.Vector3(0, centreY + 0.04, RING_R + need * (1 - 0.1 * extraZoom));
      const closeLook = new THREE.Vector3(0, centreY, RING_R);
      void rig;
      home.lerp(closePos, e);
      look.lerp(closeLook, e);
    }
    camera.position.copy(home);
    camera.lookAt(look);

    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      events.onReady();
    }

    const moving =
      !reduced ||
      dragging ||
      phiTween !== null ||
      dollyTween !== null ||
      extraTween !== null ||
      Math.abs(phiVel) > 0.001 ||
      Math.abs(pitch) > 0.002 ||
      uploadQueue.length > 0 ||
      rigs.some((r) => Math.abs(r.swingVel) > 0.01 || Math.abs(r.yawVel) > 0.01 || Math.abs(r.nodVel) > 0.01 || Math.abs(r.hover) > 0.001 && r.hover < 0.999);
    const keep = moving || needsFrame;
    needsFrame = false;
    if (keep) raf = requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf && active && !disposed) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  // Wake the loop whenever anything could have changed (needed only under reduced motion).
  const wakeTimer = window.setInterval(() => {
    if (needsFrame || pointerNeedsPick) schedule();
  }, 50);

  const ro = new ResizeObserver(() => {
    resize();
    schedule();
  });
  ro.observe(canvas);
  resize();
  const onVisibility = () => {
    if (document.hidden) {
      rigs.forEach((r) => r.video?.pause());
    } else if (active) {
      rigs.forEach((r) => r.videoReady && void r.video?.play().catch(() => undefined));
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  /* ---------- handle ---------- */
  const handle: RackHandle = {
    setActive(next) {
      active = next;
      if (next) {
        idleSince = performance.now();
        rigs.forEach((r) => r.videoReady && !reduced && void r.video?.play().catch(() => undefined));
        schedule();
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        rigs.forEach((r) => r.video?.pause());
      }
    },
    setReducedMotion(next) {
      reduced = next;
      if (next) {
        rigs.forEach((r) => r.video?.pause());
      } else {
        rigs.forEach((r) => r.videoReady && void r.video?.play().catch(() => undefined));
      }
      needsFrame = true;
      schedule();
    },
    setPaused(next) {
      paused = next;
      needsFrame = true;
      schedule();
    },
    focusTag(index) {
      selectedIndex < 0 && turnTo(index);
      idleSince = performance.now();
      schedule();
    },
    setKeyboardFocus(index) {
      keyboardIndex = index;
      if (index >= 0) turnTo(index);
      needsFrame = true;
      schedule();
    },
    step(direction) {
      const base = phiTween ? phiTween.to : phi;
      const to = base + direction * (TAU / count);
      phiTween = { from: phi, to, start: performance.now(), duration: reduced ? 1 : 780, ease: easeOut };
      if (reduced) phi = to;
      phiVel = 0;
      idleSince = performance.now();
      needsFrame = true;
      schedule();
    },
    select(index) {
      return new Promise<void>((resolve) => {
        selectedIndex = index;
        keyboardIndex = -1;
        hoverIndex = -1;
        events.onHover(-1, 0, 0);
        phiVel = 0;
        const rotate = nearestPhi(index) - phi;
        const rotateMs = reduced || Math.abs(rotate) < 0.002 ? 0 : clamp(520 + Math.abs(rotate) * 330, 560, 1100);
        turnTo(index, rotateMs || undefined);
        const start = performance.now() + rotateMs * 0.4;
        if (reduced) {
          dolly = 1;
          resolve();
          needsFrame = true;
          schedule();
          return;
        }
        dollyTween = { from: dolly, to: 1, start, duration: 1000, ease: easeInOut };
        window.setTimeout(resolve, rotateMs * 0.4 + 1000 * 0.62);
        schedule();
      });
    },
    arrive(index) {
      selectedIndex = -1;
      const rig = rigs[index];
      if (rig) {
        rig.selected = 1;
        rig.hover = 0;
      }
      extraZoom = 0;
      if (reduced) {
        dolly = 0;
      } else {
        dolly = 1;
        selectedIndex = index; // keep the camera framing this tag while pulling back
        dollyTween = {
          from: 1,
          to: 0,
          start: performance.now() + 120,
          duration: 1050,
          ease: easeOut,
          done: () => {
            selectedIndex = -1;
          },
        };
      }
      if (reduced) selectedIndex = -1;
      idleSince = performance.now();
      needsFrame = true;
      schedule();
    },
    finish() {
      extraTween = { from: extraZoom, to: 1, start: performance.now(), duration: 520, ease: easeOut };
      schedule();
    },
    cancelSelect() {
      selectedIndex = -1;
      dollyTween = { from: dolly, to: 0, start: performance.now(), duration: 700, ease: easeOut };
      extraTween = null;
      extraZoom = 0;
      idleSince = performance.now();
      schedule();
    },
    getState() {
      return { phi, front: frontIndex };
    },
    dispose() {
      disposed = true;
      abort.abort();
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(wakeTimer);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      rigs.forEach((r) => {
        r.video?.pause();
        r.video?.removeAttribute('src');
        r.video?.load();
        r.frames?.forEach((t) => t.dispose());
        r.videoTex?.dispose();
        r.posterTex?.dispose();
        r.cardTex?.dispose();
      });
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
      [chrome, blackTube, trolleyMat, wire, rodMat, plateMat, bagMat, edgeMat, hiddenMat].forEach((m) => m.dispose());
      rigs.forEach((r) => {
        r.cardMat.dispose();
        r.windowMat.dispose();
        r.halo.dispose();
      });
      (floor.material as THREE.Material).dispose();
      env.dispose();
      renderer.dispose();
    },
  };

  schedule();
  return handle;
}
