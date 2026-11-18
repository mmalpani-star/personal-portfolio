/**
 * Three.js scenes for the CAD models in /public/models (built by /cad).
 * Imported dynamically, so none of this ships until a scene nears the viewport.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type StageOptions = {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  /** Called after every rendered frame (used to move HTML labels). */
  onFrame?: () => void;
};

export type Stage = {
  /** Scroll progress through the scene, 0..1. */
  setProgress: (p: number) => void;
  /** Visitor can drag to rotate and use the zoom buttons / wheel. */
  setInspect: (on: boolean) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Renderer, camera, light and a soft contact shadow shared by both scenes. */
export function base(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 3, 2);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);

  // contact shadow: a radial gradient on a plane, cheaper than shadow maps
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(13,13,13,0.32)');
  grad.addColorStop(0.55, 'rgba(13,13,13,0.12)');
  grad.addColorStop(1, 'rgba(13,13,13,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(c);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const listeners: (() => void)[] = [];
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    listeners.forEach((f) => f());
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const dispose = () => {
    ro.disconnect();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
    shadowTex.dispose();
    env.dispose();
    renderer.dispose();
  };
  /** Pull the camera back on narrow (portrait) frames so the model still fits. */
  const fit = (home: THREE.Vector3, target: THREE.Vector3, out: THREE.Vector3, wideAspect = 1.5) => {
    const k = Math.max(1, wideAspect / camera.aspect) ** 0.85;
    return out.copy(home).sub(target).multiplyScalar(k).add(target);
  };
  const onResize = (f: () => void) => {
    listeners.push(f);           // called on later resizes; the first fit is done by the caller
  };
  return { renderer, scene, camera, shadow, resize, dispose, fit, onResize };
}

export function makeControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, target: THREE.Vector3) {
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.47;   // never orbit below the ground
  controls.enabled = false;            // off until the visitor turns inspection on
  controls.enableZoom = false;
  // OrbitControls writes an inline `touch-action: none` on construction, which would stop a finger
  // swipe that starts on the canvas from scrolling the page. Let the stylesheet decide instead:
  // `pan-y` normally, `none` only while the visitor is inspecting.
  canvas.style.touchAction = '';
  return controls;
}

/** Drive a render loop only while the canvas is on screen. */
export function loop(tick: (dt: number) => boolean | void) {
  let raf = 0;
  let last = performance.now();
  let visible = true;
  let dirty = true;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const keep = tick(dt);
    if (keep || dirty) {
      dirty = false;
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
    }
  };
  const wake = () => {
    dirty = true;
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  return {
    wake,
    setVisible(v: boolean) {
      visible = v;
      if (!v && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (v) wake();
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

// --------------------------------------------------------------------------
// Hexapod: walks in from the right on its own baked tripod gait, then settles.
// --------------------------------------------------------------------------
export type WalkerManifest = {
  animation: { name: string; period_s: number; body_advance_per_cycle_m: number };
};
/** @deprecated kept for existing imports */
export type HexapodManifest = WalkerManifest;

/**
 * A legged robot that walks in from the right on its own baked gait clip.
 * `facing` turns the model so its forward direction points screen-left
 * (hexapod GLB forward is -Z: PI / 2; quadruped GLB forward is +X: PI).
 */
export async function createWalkerStage(
  opts: StageOptions & {
    manifest: WalkerManifest;
    src: string;
    facing: number;
    /** Camera distance multiplier and look-at height (fraction of model height). */
    framing?: { distance?: number; target?: number };
  },
): Promise<Stage> {
  const facing = opts.facing;
  const framing = { distance: 1, target: 0.32, ...opts.framing };
  const { canvas, reducedMotion, manifest } = opts;
  const { renderer, scene, camera, shadow, dispose: disposeBase, fit, onResize } = base(canvas);

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(opts.src);
  } catch (error) {
    disposeBase();
    opts.onError?.(error);
    throw error;
  }

  const robot = new THREE.Group();
  robot.add(gltf.scene);
  scene.add(robot);
  // GLB forward is -Z; face -X so it walks right-to-left across the screen
  gltf.scene.rotation.y = facing;

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  gltf.scene.position.y -= box.min.y;                // feet on y = 0
  shadow.scale.set(size.x * 1.25, size.z * 1.25, 1);

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find((a) => a.name === manifest.animation.name) ?? gltf.animations[0];
  const action = clip ? mixer.clipAction(clip) : null;
  action?.play();

  const span = Math.max(size.x, size.z);
  const target = new THREE.Vector3(0, size.y * framing.target, 0);
  const baseHome = new THREE.Vector3(span * 0.55, span * 0.4, span * 1.2).multiplyScalar(framing.distance);
  const home = new THREE.Vector3();
  camera.position.copy(fit(baseHome, target, home));
  camera.lookAt(target);
  const controls = makeControls(camera, canvas, target);
  controls.minDistance = span * 0.8;
  controls.maxDistance = span * 5;
  controls.addEventListener('change', () => run.wake());
  onResize(() => {
    fit(baseHome, target, home);
    if (!controls.enabled) {
      camera.position.copy(home);
      camera.lookAt(target);
    }
    run.wake();
  });

  // walk-in geometry: start off the right edge, arrive at the centre
  const startX = span * 1.55;          // just past the right edge of the frame
  const perCycle = manifest.animation.body_advance_per_cycle_m;
  const period = manifest.animation.period_s;
  let progress = reducedMotion ? 1 : 0;
  let shown = progress;

  const apply = () => {
    const walk = smooth(clamp(shown / 0.64));          // reaches the centre at 64% of the scroll
    const x = startX * (1 - walk);
    robot.position.x = x;
    shadow.position.x = x;
    if (action) {
      // advance the clip by exactly the distance covered, so the feet never slip
      const travelled = startX - x;
      const t = ((travelled / perCycle) * period) % period;
      action.time = t;
      // settle into the standing pose once it has arrived
      action.weight = reducedMotion ? 0 : 1 - smooth(clamp((shown - 0.64) / 0.12));
      mixer.update(0);
    }
    // a slow quarter-turn as it settles shows the leg mechanism side-on
    gltf.scene.rotation.y = facing - 0.55 * smooth(clamp((shown - 0.62) / 0.3));
  };
  apply();

  const run = loop((dt) => {
    const before = shown;
    shown += (progress - shown) * Math.min(1, dt * 7);
    if (Math.abs(progress - shown) < 0.0005) shown = progress;
    apply();
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    opts.onFrame?.();
    return shown !== before || controls.enabled;
  });
  opts.onReady?.();

  return {
    setProgress(p) {
      progress = reducedMotion ? 1 : clamp(p);
      run.wake();
    },
    setInspect(on) {
      controls.enabled = on;
      controls.enableZoom = on;
      run.wake();
    },
    zoom(f) {
      const d = camera.position.clone().sub(controls.target);
      d.setLength(clamp(d.length() * f, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(d);
      run.wake();
    },
    reset() {
      camera.position.copy(home);
      controls.target.copy(target);
      camera.lookAt(target);
      run.wake();
    },
    setVisible: (v) => run.setVisible(v),
    dispose() {
      run.stop();
      controls.dispose();
      mixer.stopAllAction();
      disposeBase();
    },
  };
}

export function createHexapodStage(opts: StageOptions & { manifest: WalkerManifest; src: string }) {
  return createWalkerStage({ ...opts, facing: Math.PI / 2 });
}

// --------------------------------------------------------------------------
// Exploded assemblies: assembled -> exploded, with labelled component groups.
// Used by the air quality monitor and HydroSafe.
// --------------------------------------------------------------------------
export type ExplodeManifest = {
  groups: Record<string, { nodes: string[]; explode: number[] }>;
  labels: Record<string, string>;
};
export type AqmManifest = ExplodeManifest;

export type ExplodeStage = Stage & {
  /** Where each labelled group sits on screen, in CSS pixels. */
  labelPositions: () => { id: string; x: number; y: number; visible: boolean }[];
  /** Screen rectangle (CSS pixels) covered by the whole model right now. */
  bounds: () => { left: number; right: number; top: number; bottom: number };
  setExplode: (t: number | null) => void;
  setHighlight: (id: string | null) => void;
  pick: (clientX: number, clientY: number) => string | null;
};
export type AqmStage = ExplodeStage;

export type ExplodeOptions = StageOptions & {
  manifest: ExplodeManifest;
  src: string;
  /** Groups that carry no label and cannot be picked (the reference body). */
  unlabelled?: string[];
  /**
   * Dynamic mode: the model slides in from the right as the scroll starts, the
   * camera follows the model as it opens out, and the ground shadow stays under
   * the lowest part. Without it the camera is fixed (the air quality monitor).
   */
  dynamic?: {
    /** Scroll fraction at which the entry slide has finished. */
    entryEnd: number;
    /** Scroll fractions between which the assembly opens out. */
    explodeStart: number;
    explodeEnd: number;
    /** Camera direction (radians) and a multiplier on the fitted distance (1 fills ~90 % of the frame). */
    azimuth: number;
    elevation: number;
    margin?: number;
    /** Model yaw at the start of the entry and when fully open. */
    yaw?: [number, number];
  };
};

export async function createExplodedStage(opts: ExplodeOptions): Promise<ExplodeStage> {
  const { canvas, reducedMotion, manifest, dynamic } = opts;
  const unlabelled = new Set(opts.unlabelled ?? ['enclosure_body']);
  const { renderer, scene, camera, shadow, dispose: disposeBase, fit, onResize } = base(canvas);

  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(opts.src);
  } catch (error) {
    disposeBase();
    opts.onError?.(error);
    throw error;
  }
  const model = gltf.scene;
  scene.add(model);

  const assembled = new THREE.Box3().setFromObject(model);
  const size = assembled.getSize(new THREE.Vector3());
  model.position.y -= assembled.min.y;
  const baseY = model.position.y;
  if (dynamic) shadow.scale.set(Math.hypot(size.x, size.z) * 1.15, Math.hypot(size.x, size.z) * 1.0, 1);
  else shadow.scale.set(size.x * 2.2, size.z * 4.2, 1);
  shadow.position.y = 0.0005;

  const groups = Object.entries(manifest.groups).map(([id, g]) => {
    const node = model.getObjectByName(id)!;
    return { id, node, explode: new THREE.Vector3(...(g.explode as [number, number, number])) };
  });

  // tint helper for highlight: clone materials once per group
  const tint = new Map<string, THREE.MeshStandardMaterial[]>();
  groups.forEach(({ id, node }) => {
    const mats: THREE.MeshStandardMaterial[] = [];
    node?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        mesh.material = m;
        mats.push(m);
      }
    });
    tint.set(id, mats);
  });

  const setGroups = (t: number) => groups.forEach(({ node, explode }) => node?.position.copy(explode).multiplyScalar(t));

  // ---- camera --------------------------------------------------------------
  const span = Math.max(size.x, size.y, size.z);
  const target = new THREE.Vector3(0, size.y * 0.5, 0);
  const baseHome = new THREE.Vector3(-span * 1.9, span * 1.35, span * 2.9);
  const home = new THREE.Vector3();
  camera.position.copy(fit(baseHome, target, home));
  camera.lookAt(target);

  // Dynamic mode: vertical extent and footprint radius of the assembled and of the fully open model
  const extentOf = () => {
    model.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(model);
    let R = 0;
    const corner = new THREE.Vector3();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry.boundingBox) return;
      const bb = m.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld);
        R = Math.max(R, Math.hypot(corner.x - model.position.x, corner.z - model.position.z));
      }
    });
    return { c: new THREE.Vector3(model.position.x, (b.min.y + b.max.y) / 2, model.position.z), minY: b.min.y, maxY: b.max.y, R };
  };
  setGroups(0);
  const sphereA = extentOf();
  setGroups(1);
  const sphereE = extentOf();
  setGroups(0);
  const dir = new THREE.Vector3();
  if (dynamic) {
    dir.set(
      Math.sin(dynamic.azimuth) * Math.cos(dynamic.elevation),
      Math.sin(dynamic.elevation),
      Math.cos(dynamic.azimuth) * Math.cos(dynamic.elevation),
    );
  }
  /**
   * Smallest camera distance that keeps the whole model in frame. The model turns
   * about its vertical axis, so its footprint is treated as a circle of radius R
   * at the lowest and highest points, which holds at every yaw.
   */
  const fitDistance = (ext: { c: THREE.Vector3; minY: number; maxY: number; R: number }) => {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * camera.aspect;
    const fill = 0.9;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const upv = new THREE.Vector3().crossVectors(dir, right);
    const q = new THREE.Vector3();
    let d = 0;
    for (const y of [ext.minY, ext.maxY]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        q.set(ext.c.x + Math.cos(a) * ext.R, y, ext.c.z + Math.sin(a) * ext.R).sub(ext.c);
        const toward = q.dot(dir);
        d = Math.max(d, Math.abs(q.dot(right)) / (tanH * fill) + toward, Math.abs(q.dot(upv)) / (tanV * fill) + toward);
      }
    }
    return d * (dynamic?.margin ?? 1);
  };
  const pose = new THREE.Vector3();
  const look = new THREE.Vector3();
  let distA = dynamic ? fitDistance(sphereA) : 0;
  let distE = dynamic ? fitDistance(sphereE) : 0;

  const controls = makeControls(camera, canvas, target);
  controls.minDistance = dynamic ? sphereA.R * 0.9 : span * 1.6;
  controls.maxDistance = dynamic ? distE * 3 : span * 10;
  controls.addEventListener('change', () => run.wake());
  onResize(() => {
    if (dynamic) {
      distA = fitDistance(sphereA);
      distE = fitDistance(sphereE);
      controls.maxDistance = distE * 3;
    } else {
      fit(baseHome, target, home);
      if (!controls.enabled) {
        camera.position.copy(home);
        camera.lookAt(target);
      }
    }
    run.wake();
  });

  let progress = reducedMotion ? 1 : 0;
  let shown = progress;
  let manual: number | null = null;
  let highlight: string | null = null;
  let spin = 0;

  const entryAmount = () => (dynamic && !reducedMotion ? smooth(clamp(shown / dynamic.entryEnd)) : 1);
  const explodeAmount = () =>
    manual ??
    (dynamic
      ? smooth(clamp((shown - dynamic.explodeStart) / (dynamic.explodeEnd - dynamic.explodeStart)))
      : smooth(clamp((shown - 0.15) / 0.55)));

  const right = new THREE.Vector3();
  const apply = () => {
    const t = explodeAmount();
    setGroups(t);
    if (dynamic) {
      const e = entryAmount();
      const [y0, y1] = dynamic.yaw ?? [-0.9, -0.35];
      if (!controls.enabled) model.rotation.y = reducedMotion ? y1 : y0 + (y1 - y0) * smooth(clamp(shown / dynamic.explodeEnd));
      // follow the model: camera distance and look-at blend from assembled to open
      const dist = distA + (distE - distA) * t;
      look.lerpVectors(sphereA.c, sphereE.c, t);
      if (!controls.enabled) {
        pose.copy(look).addScaledVector(dir, dist);
        camera.position.copy(pose);
        camera.lookAt(look);
      }
      // slide in from the right of the frame, along the camera's own right-hand axis
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      const off = (1 - e) * distA * 1.1;
      model.position.set(right.x * off, baseY, right.z * off);
      // ground shadow stays under the lowest part and moves with the model
      const lowest = sphereA.minY + (sphereE.minY - sphereA.minY) * t;
      shadow.position.set(right.x * off, Math.min(sphereA.minY, lowest) + 0.0005, right.z * off);
    } else if (!controls.enabled) {
      // a slow turn while it opens shows the side grilles, then holds
      model.rotation.y = reducedMotion ? 0 : -0.5 + 0.7 * smooth(clamp(shown)) + spin;
    }
    groups.forEach(({ id }) =>
      tint.get(id)?.forEach((m) => m.emissive.setHex(highlight === id ? 0x332b00 : 0x000000)),
    );
  };
  apply();

  const run = loop((dt) => {
    const before = shown;
    shown += (progress - shown) * Math.min(1, dt * 6);
    if (Math.abs(progress - shown) < 0.0005) shown = progress;
    apply();
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    opts.onFrame?.();
    return shown !== before || controls.enabled;
  });
  opts.onReady?.();

  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3();

  return {
    setProgress(p) {
      progress = reducedMotion ? 1 : clamp(p);
      run.wake();
    },
    setExplode(t) {
      manual = t;
      run.wake();
    },
    setHighlight(id) {
      highlight = id;
      run.wake();
    },
    setInspect(on) {
      controls.enabled = on;
      controls.enableZoom = on;
      if (on) {
        spin = 0;
        if (dynamic) controls.target.copy(look);
      }
      run.wake();
    },
    zoom(f) {
      const d = camera.position.clone().sub(controls.target);
      d.setLength(clamp(d.length() * f, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(d);
      run.wake();
    },
    reset() {
      if (dynamic) {
        controls.target.copy(look);
        camera.position.copy(look).addScaledVector(dir, distA + (distE - distA) * explodeAmount());
      } else {
        camera.position.copy(home);
        controls.target.copy(target);
      }
      camera.lookAt(controls.target);
      run.wake();
    },
    labelPositions() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = explodeAmount();
      const arrived = entryAmount() > 0.98;
      return groups
        .filter(({ id }) => manifest.labels[id] && !unlabelled.has(id))
        .map(({ id, node }) => {
          const b = new THREE.Box3().setFromObject(node);
          b.getCenter(v);
          v.project(camera);
          return { id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: arrived && t > 0.55 && v.z < 1 };
        });
    },
    bounds() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      model.updateMatrixWorld(true);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry.boundingBox) return;
        const bb = m.geometry.boundingBox;
        for (let i = 0; i < 8; i++) {
          v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z)
            .applyMatrix4(m.matrixWorld)
            .project(camera);
          const x = (v.x * 0.5 + 0.5) * w;
          const y = (-v.y * 0.5 + 0.5) * h;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      });
      return { left, right, top, bottom };
    },
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1),
        camera,
      );
      const hit = ray.intersectObject(model, true)[0];
      if (!hit) return null;
      let o: THREE.Object3D | null = hit.object;
      while (o && !manifest.groups[o.name]) o = o.parent;
      return o && !unlabelled.has(o.name) && manifest.labels[o.name] ? o.name : null;
    },
    setVisible: (vis) => run.setVisible(vis),
    dispose() {
      run.stop();
      controls.dispose();
      disposeBase();
    },
  };
}

/** The air quality monitor: fixed camera, opens out as you scroll. */
export function createAqmStage(opts: StageOptions & { manifest: ExplodeManifest; src: string }) {
  return createExplodedStage({ ...opts, unlabelled: ['enclosure_body'] });
}
