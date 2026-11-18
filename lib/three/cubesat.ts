/**
 * The 1U CubeSat scene: it flies up into frame in front of Earth, a burn wire releases a
 * restraint cord and a coiled steel tape antenna springs out and settles.
 *
 * What is original and what is not (see cad/README.md): the electronics are the original CAD
 * models; the frame, cassette, cord, burn wire and tape are reconstructed. The tape geometry
 * here is a port of cad/cubesat/tape.py, and `manifest.antenna.reference` carries that file's
 * numbers so the two can be compared (see `selfCheck`). Timings are a depiction, not data.
 * Loaded dynamically with the scene, so none of this is in the page's first JavaScript.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { base, clamp, loop, makeControls, smooth, type Stage, type StageOptions } from './scenes';

// ------------------------------------------------------------------ manifest --
export type TapeParams = {
  width: number;
  thickness: number;
  sagitta: number;
  length: number;
  core_radius: number;
  pitch: number;
  hub: [number, number];
  exit_x: number;
  top_z: number;
  stowed_stub: number;
  deployed_extension: number;
};

export type CubesatManifest = {
  antenna: {
    tape: TapeParams;
    cassette_origin_mm: [number, number, number];
    restraint: {
      cord_z: number;
      cord_radius: number;
      cord_x: number;
      posts_y: [number, number];
      nichrome: { helix_radius: number };
    };
    reference: Record<'stowed' | 'half' | 'deployed', { extension: number; coil_radius: number; total_length: number }>;
    sequence_s_illustrative: { heat: number; deploy: number; settle: number };
  };
  labels: Record<string, string>;
};

export type DeployState = 'stowed' | 'heating' | 'releasing' | 'deployed' | 'stowing';

export type CubesatOptions = StageOptions & {
  manifest: CubesatManifest;
  src: string;
  earth: { day: string; clouds: string };
  /** 0 (portfolio) .. 1 (deep space): drives the page-side background. */
  onSpace?: (amount: number) => void;
  onDeploy?: (state: DeployState) => void;
};

export type CubesatStage = Stage & {
  setDeployed: (on: boolean) => void;
  replay: () => void;
  setXray: (on: boolean) => void;
  deployState: () => DeployState;
  /** True once the satellite has flown in and settled. */
  arrived: () => boolean;
  labelPositions: () => { id: string; x: number; y: number; visible: boolean; internal: boolean }[];
  bounds: () => { left: number; right: number; top: number; bottom: number };
  /** Where the model should sit: centre and height in canvas pixels (the caption occupies the rest of the canvas). */
  setFrame: (centreY: number, height: number) => void;
  /** Largest difference between this file's tape solver and the CAD script's reference values, mm. */
  selfCheck: () => number;
};

const MM = 0.001;
const ENTRY_END = 0.34;          // scroll fraction at which the satellite has settled at the centre
const TRIGGER_AT = 0.5;          // ... and at which the burn wire fires
const RESET_BELOW = 0.28;        // scrolling back above the section re-arms it
const SPIN_TURNS = 1.25;

// ---------------------------------------------------------------- tape model --
type Pt = { x: number; z: number; sag: number };

function bezier(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Outer coil radius for extension e, and the lengths of the three pieces (matches tape.py `solve`). */
function solveCoil(e: number, P: TapeParams) {
  const [cx, cz] = P.hub;
  const dx = P.exit_x - cx;
  const k = 0.5523 * dx;
  const bendLength = (r: number) => {
    const za = cz - r + dx;
    const a: [number, number] = [P.exit_x, za];
    const b: [number, number] = [cx, cz - r];
    let len = 0;
    let prev = a;
    for (let i = 1; i <= 24; i++) {
      const q = bezier(a, [a[0], a[1] - k], [b[0] + k, b[1]], b, i / 24);
      len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    return len;
  };
  let lo = P.core_radius + 1e-6;
  let hi = dx + 1;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const za = cz - mid + dx;
    const l1 = P.top_z + e - za;
    const lsp = (Math.PI * (mid * mid - P.core_radius ** 2)) / P.pitch;
    if (l1 + bendLength(mid) + lsp > P.length) hi = mid;
    else lo = mid;
  }
  const r = 0.5 * (lo + hi);
  const za = cz - r + dx;
  return { r, za, l1: P.top_z + e - za, l2: bendLength(r), lsp: (Math.PI * (r * r - P.core_radius ** 2)) / P.pitch };
}

const ROWS_STRAIGHT = 72;
const ROWS_BEND = 20;
const ROWS_SPIRAL = 190;
const ROWS = ROWS_STRAIGHT + ROWS_BEND + ROWS_SPIRAL;
const COLS = 9;

/** The tape as a thin closed ribbon, rebuilt from the extension each frame. Units: mm, cassette frame. */
class TapeMesh {
  readonly mesh: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly attr: THREE.BufferAttribute;
  private readonly geo: THREE.BufferGeometry;
  private readonly pts: Pt[] = Array.from({ length: ROWS }, () => ({ x: 0, z: 0, sag: 0 }));

  constructor(
    private readonly P: TapeParams,
    material: THREE.Material,
  ) {
    this.pos = new Float32Array(2 * ROWS * COLS * 3);
    this.geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    const v = (layer: number, row: number, col: number) => (layer * ROWS + row) * COLS + col;
    for (let i = 0; i < ROWS - 1; i++) {
      for (let j = 0; j < COLS - 1; j++) {
        idx.push(v(0, i, j), v(0, i + 1, j), v(0, i + 1, j + 1), v(0, i, j), v(0, i + 1, j + 1), v(0, i, j + 1));
        idx.push(v(1, i, j), v(1, i + 1, j + 1), v(1, i + 1, j), v(1, i, j), v(1, i, j + 1), v(1, i + 1, j + 1));
      }
      for (const j of [0, COLS - 1]) {
        idx.push(v(0, i, j), v(1, i, j), v(1, i + 1, j), v(0, i, j), v(1, i + 1, j), v(0, i + 1, j));
      }
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.update(P.stowed_stub, 0);
  }

  /** Centreline of the tape for extension e: free tip -> straight run -> bend -> spiral onto the hub. */
  private centre(e: number, wobble: number) {
    const P = this.P;
    const { r, za, l1, lsp } = solveCoil(e, P);
    const [cx, cz] = P.hub;
    const dx = P.exit_x - cx;
    const k = 0.5523 * dx;
    const a: [number, number] = [P.exit_x, za];
    const b: [number, number] = [cx, cz - r];
    let n = 0;
    for (let i = 0; i < ROWS_STRAIGHT; i++) {
      const s = i / (ROWS_STRAIGHT - 1);
      const u = 1 - s; // 0 at the base of the free run, 1 at the tip
      const p = this.pts[n++];
      p.x = P.exit_x + wobble * u * u;
      p.z = P.top_z + e - s * l1;
      p.sag = P.sagitta;
    }
    for (let i = 1; i <= ROWS_BEND; i++) {
      const t = i / ROWS_BEND;
      const q = bezier(a, [a[0], a[1] - k], [b[0] + k, b[1]], b, t);
      const p = this.pts[n++];
      p.x = q[0];
      p.z = q[1];
      p.sag = P.sagitta * (1 - smooth(t));
    }
    const phiEnd = (2 * Math.PI * (r - P.core_radius)) / P.pitch;
    for (let i = 1; i <= ROWS_SPIRAL; i++) {
      const phi = (i / ROWS_SPIRAL) * phiEnd;
      const rad = r - (P.pitch * phi) / (2 * Math.PI);
      const th = -Math.PI / 2 - phi;
      const p = this.pts[n++];
      p.x = cx + rad * Math.cos(th);
      p.z = cz + rad * Math.sin(th);
      p.sag = 0;
    }
    return { l1, lsp, r };
  }

  update(e: number, wobble: number) {
    const P = this.P;
    this.centre(e, wobble);
    const half = P.thickness / 2;
    for (let i = 0; i < ROWS; i++) {
      const p0 = this.pts[Math.max(0, i - 1)];
      const p1 = this.pts[Math.min(ROWS - 1, i + 1)];
      let tx = p1.x - p0.x;
      let tz = p1.z - p0.z;
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      const nx = -tz;
      const nz = tx;
      const p = this.pts[i];
      for (let j = 0; j < COLS; j++) {
        const y = -P.width / 2 + (P.width * j) / (COLS - 1);
        const off = p.sag * (1 - ((2 * y) / P.width) ** 2);
        for (let layer = 0; layer < 2; layer++) {
          const o = off + (layer === 0 ? half : -half);
          const at = ((layer * ROWS + i) * COLS + j) * 3;
          this.pos[at] = p.x + nx * o;
          this.pos[at + 1] = y;
          this.pos[at + 2] = p.z + nz * o;
        }
      }
    }
    this.attr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  coilRadius(e: number) {
    return solveCoil(e, this.P).r;
  }

  /** Point on the free run, cassette frame, at fraction f from the tip (0) to its base (1). */
  runPoint(e: number, f: number, out: THREE.Vector3) {
    const { l1 } = solveCoil(e, this.P);
    return out.set(this.P.exit_x, 0, this.P.top_z + e - f * l1);
  }

  dispose() {
    this.geo.dispose();
  }
}

// ------------------------------------------------------------------- Earth ----
function glowMaterial(front: boolean, color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: front ? THREE.FrontSide : THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: front
      ? `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
         void main(){ float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.2); gl_FragColor = vec4(uColor * f, f * 0.9 * uOpacity); }`
      : `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
         void main(){ float f = pow(clamp(-dot(normalize(vN), normalize(vV)) * 2.8, 0.0, 1.0), 2.6); gl_FragColor = vec4(uColor * f, f * 0.8 * uOpacity); }`,
  });
}

function makeStars(count: number) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const s = new Float32Array(count);
  const c = new Float32Array(count * 3);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    p.set([r * Math.cos(a) * 24, u * 24, r * Math.sin(a) * 24 - 6], i * 3);
    const m = rnd();
    s[i] = 1.0 + m * m * m * 2.2;
    const warm = rnd();
    c.set([0.85 + warm * 0.15, 0.88 + warm * 0.05, 1.0 - warm * 0.12], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; uniform float uPx; varying vec3 vC; varying float vS;
      void main(){ vC = color; vS = size; gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vC; varying float vS;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(d)); gl_FragColor = vec4(vC, a * uOpacity * (0.35 + 0.22 * vS)); }`,
  });
  return new THREE.Points(g, mat);
}

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,150,1)');
  grad.addColorStop(0.25, 'rgba(255,130,40,0.65)');
  grad.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  return new THREE.Sprite(mat);
}

// ------------------------------------------------------------------- stage ----
export async function createCubesatStage(opts: CubesatOptions): Promise<CubesatStage> {
  const { canvas, reducedMotion, manifest } = opts;
  const P = manifest.antenna.tape;
  const seq = manifest.antenna.sequence_s_illustrative;
  const { renderer, scene, camera, shadow, dispose: disposeBase, onResize } = base(canvas);
  shadow.visible = false;
  const mobile = window.innerWidth < 768;
  renderer.toneMappingExposure = 1.0;

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(opts.src);
  } catch (error) {
    disposeBase();
    opts.onError?.(error);
    throw error;
  }

  // ---- satellite ------------------------------------------------------------
  const sat = new THREE.Group();
  const model = gltf.scene;
  sat.add(model);
  scene.add(sat);
  const root = (model.getObjectByName('cubesat') as THREE.Object3D | undefined) ?? model; // CAD frame, mm
  const [ox, oy, oz] = manifest.antenna.cassette_origin_mm;

  // own copies of the materials we change
  const mesh = (name: string) => model.getObjectByName(name) as THREE.Mesh | undefined;
  const cloneMat = (m: THREE.Mesh | undefined) => {
    if (!m) return undefined;
    const c = (m.material as THREE.MeshStandardMaterial).clone();
    m.material = c;
    return c;
  };
  const wireMats = ['nichrome_helix', 'nichrome_lead_a', 'nichrome_lead_b'].map((n) => cloneMat(mesh(n))).filter(Boolean) as THREE.MeshStandardMaterial[];
  const frameMats: THREE.MeshStandardMaterial[] = [];
  const frameGroup = model.getObjectByName('grp_frame');
  frameGroup?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const c = cloneMat(m);
      if (c) frameMats.push(c);
    }
  });

  // restraint cord: static mesh from CAD until it is cut, then two recoiling halves
  const cordStatic = mesh('restraint_cord');
  const cordMat = cordStatic ? ((cordStatic.material as THREE.MeshStandardMaterial).clone() as THREE.MeshStandardMaterial) : new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.7 });
  const R = manifest.antenna.restraint;
  const cassette = new THREE.Group(); // cassette frame: origin on the top plate, in the CAD (mm) frame
  cassette.position.set(ox, oy, oz);
  root.add(cassette);
  const halfGeo = new THREE.CylinderGeometry(R.cord_radius, R.cord_radius, 1, 6).translate(0, 0.5, 0);
  const halves = [-1, 1].map((sy) => {
    const h = new THREE.Mesh(halfGeo, cordMat);
    h.position.set(R.cord_x, sy * (Math.abs(R.posts_y[0]) - 1.1), R.cord_z);
    h.visible = false;
    cassette.add(h);
    return { h, sy, len: Math.abs(R.posts_y[0]) - 1.1 };
  });

  // tape
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd2d7de, metalness: 0.92, roughness: 0.3, side: THREE.DoubleSide });
  const tape = new TapeMesh(P, tapeMat);
  cassette.add(tape.mesh);

  // reel hub turns as tape pays out: pivot at the hub axis
  const hubMesh = mesh('cassette_hub');
  let hubPivot: THREE.Group | null = null;
  if (hubMesh?.parent) {
    hubPivot = new THREE.Group();
    hubPivot.position.set(ox + P.hub[0], oy, oz + P.hub[1]);
    hubMesh.parent.add(hubPivot);
    hubMesh.position.sub(hubPivot.position);
    hubPivot.add(hubMesh);
  }

  // burn-wire glow
  const glowPoint = new THREE.PointLight(0xff7a2a, 0, 0.035, 2);
  glowPoint.position.set(R.cord_x, 0, R.cord_z);
  cassette.add(glowPoint);
  const halo = glowSprite();
  halo.position.set(R.cord_x, 0, R.cord_z);
  halo.scale.setScalar(15);
  cassette.add(halo);
  const spark = glowSprite();
  spark.position.set(R.cord_x, 0, R.cord_z);
  spark.scale.setScalar(20);
  cassette.add(spark);

  // ---- space ----------------------------------------------------------------
  const space = new THREE.Group();
  scene.add(space);
  const stars = makeStars(mobile ? 900 : 1700);
  stars.renderOrder = -30;
  stars.frustumCulled = false;
  (stars.material as THREE.ShaderMaterial).uniforms.uPx.value = renderer.getPixelRatio();
  space.add(stars);

  const earth = new THREE.Group();
  earth.position.set(-0.55, -4.25, -5.2);
  earth.rotation.set(0.5, 3.6, 0.28);
  const R_EARTH = 3.5;
  const sphere = new THREE.SphereGeometry(R_EARTH, mobile ? 72 : 128, mobile ? 48 : 96);
  const dayMat = new THREE.MeshStandardMaterial({ color: 0xd9e0ee, roughness: 0.82, metalness: 0, transparent: true, opacity: 0 });
  const day = new THREE.Mesh(sphere, dayMat);
  day.renderOrder = -20;
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0, depthWrite: false });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.006, mobile ? 72 : 128, mobile ? 48 : 96), cloudMat);
  clouds.renderOrder = -19;
  earth.add(day, clouds);
  const rim = glowMaterial(true, 0x6aa8ff);
  const halo2 = glowMaterial(false, 0x4f8fff);
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.004, 96, 64), rim);
  const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.07, 96, 64), halo2);
  rimMesh.renderOrder = -18;
  haloMesh.renderOrder = -17;
  earth.add(rimMesh, haloMesh);
  space.add(earth);
  space.visible = false;

  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  let earthReady = false;
  const loadTex = (url: string, srgb: boolean) =>
    new Promise<THREE.Texture>((resolve, reject) =>
      loader.load(
        url,
        (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          textures.push(t);
          resolve(t);
        },
        undefined,
        reject,
      ),
    );
  let disposed = false;
  Promise.all([loadTex(opts.earth.day, true), loadTex(opts.earth.clouds, false)])
    .then(([d, c]) => {
      if (disposed) return;
      dayMat.map = d;
      cloudMat.map = null;
      cloudMat.alphaMap = c;
      dayMat.needsUpdate = true;
      cloudMat.needsUpdate = true;
      earthReady = true;
      run.wake();
    })
    .catch(() => undefined); // the scene still works against plain space

  // lights: base() leaves one white key light; in space it becomes a low, warm sun with a cool fill
  const key = scene.children.find((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
  const sunDir = new THREE.Vector3(-1.5, 1.15, 1.6);
  const fill = new THREE.DirectionalLight(0x6f9bff, 0);
  fill.position.set(1.8, -0.4, -1.4);
  scene.add(fill);
  const earthshine = new THREE.DirectionalLight(0x4f78d0, 0);
  earthshine.position.set(0.2, -1.6, 0.6);
  scene.add(earthshine);

  // ---- pose and camera ------------------------------------------------------
  const finalQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.5, -1.2, 'YXZ'));
  const spinAxis = new THREE.Vector3(0.35, 1, 0.2).normalize();
  const spinQ = new THREE.Quaternion();
  const dir = new THREE.Vector3(0.0, 0.1, 1).normalize();
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const home = new THREE.Vector3();

  const HALF = 50 * MM;
  const cubeCorners = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? HALF : -HALF, i & 2 ? HALF : -HALF, i & 4 ? HALF : -HALF));
  // glTF is Y-up: CAD z (antenna axis) is glTF y; points below are in the satellite's own glTF frame
  const cadToGl = (x: number, y: number, z: number) => new THREE.Vector3(x * MM, z * MM, -y * MM);
  const stowedPts = [
    ...cubeCorners,
    cadToGl(-15.5, -7, 50), cadToGl(12.5, 7, 50), cadToGl(-15.5, -7, 50 + P.top_z + 9), cadToGl(12.5, 7, 50 + P.top_z + 9),
  ];
  const tipTop = P.top_z + P.deployed_extension;
  const deployedPts = [...stowedPts, cadToGl(P.exit_x, -P.width / 2, 50 + tipTop), cadToGl(P.exit_x, P.width / 2, 50 + tipTop)];

  // the canvas fills the whole stage; the model sits in the part above the caption
  let frameC = -1;
  let frameH = -1;
  const frameFraction = () => (frameH > 0 ? clamp(frameH / (canvas.clientHeight || 1), 0.3, 1) : 1);
  const applyFrame = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const c = frameC > 0 ? frameC : h / 2;
    camera.setViewOffset(w, h, 0, h / 2 - c, w, h);
  };
  const q = new THREE.Vector3();
  /** Smallest distance that keeps every point inside the frame, looking from `dir` at `centre`. */
  const fitDistance = (pts: THREE.Vector3[], centre: THREE.Vector3) => {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * camera.aspect;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);
    let d = 0;
    for (const p of pts) {
      q.copy(p).applyQuaternion(finalQuat).sub(centre);
      const toward = q.dot(dir);
      d = Math.max(d, Math.abs(q.dot(right)) / (tanH * 0.84) + toward, Math.abs(q.dot(up)) / (tanV * frameFraction() * 0.8) + toward);
    }
    return d;
  };
  const bboxCentre = (pts: THREE.Vector3[]) => {
    const b = new THREE.Box3();
    pts.forEach((p) => b.expandByPoint(q.copy(p).applyQuaternion(finalQuat)));
    return b.getCenter(new THREE.Vector3());
  };
  const centreS = new THREE.Vector3();
  const centreD = bboxCentre(deployedPts);
  let distS = fitDistance(stowedPts, centreS);
  let distD = fitDistance(deployedPts, centreD);

  const controls = makeControls(camera, canvas, target);
  controls.maxPolarAngle = Math.PI;
  controls.minDistance = 0.07;
  controls.maxDistance = Math.max(distS, distD) * 3;
  controls.addEventListener('change', () => run.wake());
  applyFrame();
  onResize(() => {
    applyFrame();
    distS = fitDistance(stowedPts, centreS);
    distD = fitDistance(deployedPts, centreD);
    controls.maxDistance = Math.max(distS, distD) * 3;
    run.wake();
  });

  // ---- state ----------------------------------------------------------------
  const e0 = P.stowed_stub;
  const e1 = P.deployed_extension;
  let state: DeployState = reducedMotion ? 'deployed' : 'stowed';
  let clock = 0;
  let ext = reducedMotion ? e1 : e0;
  let extFrom = e0;
  let glow = 0;
  let snapT = reducedMotion ? 99 : -1;
  let wobbleT = reducedMotion ? 99 : 0;
  let armed = !reducedMotion;
  let progress = reducedMotion ? 1 : 0;
  let shown = progress;
  let xray = 0;
  let xrayTarget = 0;
  let lastSpace = -1;
  const setState = (s: DeployState) => {
    if (s === state) return;
    state = s;
    opts.onDeploy?.(s);
  };

  const HEAT = Math.max(0.4, seq.heat);
  const DEPLOY = Math.max(0.6, seq.deploy);
  const STOW = 0.9;

  const trigger = () => {
    if (state === 'heating' || state === 'releasing') return;
    clock = 0;
    snapT = -1;
    wobbleT = 0;
    ext = ext > e0 + 0.5 ? ext : e0;
    setState('heating');
  };
  const stow = (instant: boolean) => {
    if (instant) {
      ext = e0;
      glow = 0;
      snapT = -1;
      wobbleT = 99;
      setState('stowed');
      return;
    }
    clock = 0;
    extFrom = ext;
    setState('stowing');
  };

  const easeOut = (t: number) => 1 - (1 - t) ** 3;
  const entryAmount = () => (reducedMotion ? 1 : easeOut(clamp(shown / ENTRY_END)));
  const spaceAmount = () => (reducedMotion ? 1 : smooth(clamp(shown / 0.26)) * (1 - smooth(clamp((shown - 0.9) / 0.1))));

  const tmp = new THREE.Vector3();
  const camUp = new THREE.Vector3();

  const stepDeploy = (dt: number) => {
    if (state === 'heating') {
      clock += dt;
      glow = smooth(clamp(clock / HEAT));
      if (clock >= HEAT) {
        clock = 0;
        snapT = 0;
        extFrom = ext;
        setState('releasing');
      }
    } else if (state === 'releasing') {
      clock += dt;
      snapT += dt;
      const x = clamp(clock / DEPLOY);
      ext = extFrom + (e1 - extFrom) * easeOut(x);
      glow = 1 - smooth(clamp(clock / 0.9));
      if (x >= 1) {
        wobbleT = 0;
        glow = 0;
        setState('deployed');
      }
    } else if (state === 'deployed') {
      wobbleT += dt;
      snapT += dt;
      glow = 0;
    } else if (state === 'stowing') {
      clock += dt;
      const x = clamp(clock / STOW);
      ext = extFrom + (e0 - extFrom) * smooth(x);
      glow = 0;
      if (x >= 1) {
        ext = e0;
        snapT = -1;
        wobbleT = 99;
        setState('stowed');
      }
    }
  };

  const apply = () => {
    // choreography ---------------------------------------------------------------
    const e = entryAmount();
    const sp = spaceAmount();
    if (Math.abs(sp - lastSpace) > 0.002) {
      lastSpace = sp;
      opts.onSpace?.(sp);
    }
    space.visible = sp > 0.003;
    const op = sp * (earthReady ? 1 : 0);
    dayMat.opacity = op;
    cloudMat.opacity = op * 0.5;
    rim.uniforms.uOpacity.value = op;
    halo2.uniforms.uOpacity.value = op;
    (stars.material as THREE.ShaderMaterial).uniforms.uOpacity.value = sp;
    scene.environmentIntensity = 1 - 0.72 * sp;
    key.position.copy(sunDir);
    key.color.setHex(0xfff2e0);
    key.intensity = THREE.MathUtils.lerp(1.4, 3.6, sp);
    fill.intensity = 1.5 * sp;
    earthshine.intensity = 0.75 * sp;

    // pose: slowing spin that settles into the resting attitude
    spinQ.setFromAxisAngle(spinAxis, (1 - e) ** 1.6 * Math.PI * 2 * SPIN_TURNS);
    if (!controls.enabled) sat.quaternion.copy(spinQ).multiply(finalQuat);
    else sat.quaternion.copy(finalQuat);

    // camera follows the antenna out: dolly back and re-centre as the tape pays out
    const k = smooth(clamp((ext - e0) / (e1 - e0)));
    const dist = THREE.MathUtils.lerp(distS, distD, k);
    look.lerpVectors(centreS, centreD, k);
    if (!controls.enabled) {
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look);
    }
    camera.updateMatrixWorld();
    // flies up from below the frame
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const half = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const H = canvas.clientHeight || 1;
    const below = ((H - (frameC > 0 ? frameC : H / 2)) / H) * 2 * half;
    sat.position.copy(camUp).multiplyScalar(-(1 - e) * (below + 0.15));
    sat.updateMatrixWorld(true);

    // tape, hub, cord and wire --------------------------------------------------
    const amp =
      state === 'deployed'
        ? 3.4 * Math.exp(-wobbleT * 1.7) * Math.sin(wobbleT * Math.PI * 2 * 1.35)
        : state === 'releasing'
          ? 1.8 * Math.sin(clock * 11) * clamp(clock / DEPLOY) * (1 - clamp(clock / DEPLOY))
          : 0;
    tape.update(ext, amp);
    if (hubPivot) hubPivot.rotation.y = -(ext - e0) / 5;

    const cut = snapT >= 0;
    if (cordStatic) cordStatic.visible = !cut;
    halves.forEach(({ h, sy, len }) => {
      h.visible = cut;
      if (!cut) return;
      const t = clamp(snapT / 0.35);
      const recoil = 1 - 0.78 * smooth(t); // the cut ends snap back towards their posts
      const droop = smooth(clamp(snapT / 0.9)) * 0.9;
      h.scale.y = Math.max(0.01, len * recoil);
      tmp.set(0, -sy * Math.cos(droop), -Math.sin(droop));
      h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp);
    });
    wireMats.forEach((m) => {
      m.emissive.setRGB(1.0, 0.32 + 0.3 * glow, 0.06);
      m.emissiveIntensity = glow * 2.6;
    });
    glowPoint.intensity = glow * 0.0012;
    (halo.material as THREE.SpriteMaterial).opacity = glow * 0.7;
    (spark.material as THREE.SpriteMaterial).opacity = snapT >= 0 && snapT < 0.22 ? 1 - snapT / 0.22 : 0;

    // x-ray: the frame turns glassy so the electronics inside can be seen
    frameMats.forEach((m) => {
      const a = 1 - 0.86 * xray;
      m.transparent = a < 0.999;
      m.opacity = a;
      m.depthWrite = a > 0.6;
    });
  };
  apply();

  const run = loop((dt) => {
    const before = shown;
    shown += (progress - shown) * Math.min(1, dt * 6);
    if (Math.abs(progress - shown) < 0.0005) shown = progress;

    // scroll-linked trigger: fires once the satellite has settled, re-arms when scrolled back
    if (!reducedMotion) {
      if (armed && state === 'stowed' && shown >= TRIGGER_AT) trigger();
      if (shown < RESET_BELOW && state !== 'stowed') {
        stow(true);
        armed = true;
      }
      if (shown < RESET_BELOW) armed = true;
    }
    stepDeploy(dt);
    const xrayMoving = Math.abs(xrayTarget - xray) > 0.002;
    if (xrayMoving) xray += (xrayTarget - xray) * Math.min(1, dt * 9);
    else xray = xrayTarget;
    apply();
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    opts.onFrame?.();
    const settling = state !== 'stowed' && !(state === 'deployed' && wobbleT > 3.2);
    return shown !== before || controls.enabled || settling || xrayMoving || glow > 0.001;
  });
  opts.onReady?.();

  // ---- label anchors (CAD frame, mm) ---------------------------------------------
  const anchors: Record<string, { at: () => THREE.Vector3; internal: boolean }> = {
    frame: { at: () => leftmostCorner(), internal: false },
    tape: { at: () => tape.runPoint(ext, 0.5, new THREE.Vector3()).add(cassette.position), internal: false },
    burn: { at: () => new THREE.Vector3(R.cord_x, 0, R.cord_z).add(cassette.position), internal: false },
    nano: { at: () => new THREE.Vector3(-8, 30, -14), internal: true },
    cell: { at: () => new THREE.Vector3(0, 0, -37), internal: true },
  };
  const v = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const leftmostCorner = () => {
    let best = Infinity;
    const out = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? 50 : -50, i & 2 ? 50 : -50, i & 4 ? 50 : -50);
      v.copy(corner);
      root.localToWorld(v);
      v.project(camera);
      if (v.x < best) {
        best = v.x;
        out.copy(corner);
      }
    }
    return out;
  };
  const toScreen = (cad: THREE.Vector3) => {
    v.copy(cad);
    root.localToWorld(v);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight, behind: v.z > 1 };
  };

  const selfCheck = () => {
    let worst = 0;
    (Object.keys(manifest.antenna.reference) as (keyof CubesatManifest['antenna']['reference'])[]).forEach((key) => {
      const ref = manifest.antenna.reference[key];
      worst = Math.max(worst, Math.abs(solveCoil(ref.extension, P).r - ref.coil_radius));
    });
    return worst;
  };

  return {
    setProgress(p) {
      progress = reducedMotion ? 1 : clamp(p);
      run.wake();
    },
    setInspect(on) {
      controls.enabled = on;
      controls.enableZoom = on;
      if (on) controls.target.copy(look);
      run.wake();
    },
    zoom(f) {
      const d = camera.position.clone().sub(controls.target);
      d.setLength(clamp(d.length() * f, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(d);
      run.wake();
    },
    reset() {
      const k = smooth(clamp((ext - e0) / (e1 - e0)));
      controls.target.copy(look);
      home.copy(look).addScaledVector(dir, THREE.MathUtils.lerp(distS, distD, k));
      camera.position.copy(home);
      camera.lookAt(look);
      run.wake();
    },
    setDeployed(on) {
      armed = false;
      if (reducedMotion) {
        ext = on ? e1 : e0;
        snapT = on ? 99 : -1;
        wobbleT = 99;
        glow = 0;
        setState(on ? 'deployed' : 'stowed');
      } else if (on) {
        if (state === 'stowed' || state === 'stowing') trigger();
      } else if (state !== 'stowed') {
        stow(false);
      }
      run.wake();
    },
    replay() {
      armed = false;
      if (reducedMotion) {
        run.wake();
        return;
      }
      stow(true);
      trigger();
      run.wake();
    },
    setXray(on) {
      xrayTarget = on ? 1 : 0;
      run.wake();
    },
    deployState: () => state,
    arrived: () => entryAmount() > 0.98,
    labelPositions() {
      const arrivedNow = entryAmount() > 0.98;
      return Object.entries(anchors).map(([id, a]) => {
        const s = toScreen(a.at());
        return { id, x: s.x, y: s.y, visible: arrivedNow && !controls.enabled && !s.behind && (!a.internal || xrayTarget > 0.5), internal: a.internal };
      });
    },
    bounds() {
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      const pts = [
        ...Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? 50 : -50, i & 2 ? 50 : -50, i & 4 ? 50 : -50)),
        anchors.tape.at(),
      ];
      pts.forEach((p) => {
        const s = toScreen(p);
        left = Math.min(left, s.x);
        right = Math.max(right, s.x);
        top = Math.min(top, s.y);
        bottom = Math.max(bottom, s.y);
      });
      return { left, right, top, bottom };
    },
    setFrame(centreY, height) {
      frameC = centreY;
      frameH = height;
      applyFrame();
      distS = fitDistance(stowedPts, centreS);
      distD = fitDistance(deployedPts, centreD);
      run.wake();
    },
    selfCheck,
    setVisible: (vis) => run.setVisible(vis),
    dispose() {
      disposed = true;
      run.stop();
      controls.dispose();
      tape.dispose();
      textures.forEach((t) => t.dispose());
      [sphere, halfGeo].forEach((g) => g.dispose());
      [dayMat, cloudMat, rim, halo2, tapeMat, cordMat].forEach((m) => m.dispose());
      stars.geometry.dispose();
      (stars.material as THREE.Material).dispose();
      (halo.material as THREE.SpriteMaterial).map?.dispose();
      (spark.material as THREE.SpriteMaterial).map?.dispose();
      disposeBase();
    },
  };
}
