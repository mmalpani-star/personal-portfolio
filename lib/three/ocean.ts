/**
 * The About page's sea: a sky, an open ocean made of four Gerstner waves (crests foam, the sun or moon glints off
 * the water), and the Thousand Sunny under way through the swell: the ship holds its place in the frame while the
 * sea streams past, with a wake behind it and foam at the hull. Crew models listed in `crew` stand on its deck.
 * Day palette in the light theme, night in the dark theme.
 * The ship model is "[HW XYZ School] Detailing 3" by AlinaDracheva (Sketchfab), CC BY 4.0, credited on the page.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type OceanOptions = {
  canvas: HTMLCanvasElement;
  light: boolean;
  reducedMotion: boolean;
  /** URL of the ship model, or null to sail an empty sea (phones). */
  shipSrc: string | null;
  /** Crew models (.glb URLs) to stand on the deck, in order: the first takes the bow, the rest fill the deck. */
  crew?: string[];
  onShip?: () => void;
};

export type Ocean = {
  setActive: (active: boolean) => void;
  setLight: (light: boolean) => void;
  dispose: () => void;
};

/* the same four waves on the GPU (vertex shader) and the CPU (ship) */
const WAVES: Array<{ d: [number, number]; L: number; A: number; Q: number }> = [
  { d: [1, 0.25], L: 22, A: 0.42, Q: 0.55 },
  { d: [0.35, 1], L: 13, A: 0.22, Q: 0.5 },
  { d: [-0.6, 0.8], L: 9, A: 0.1, Q: 0.4 },
  { d: [0.8, -0.55], L: 6.5, A: 0.045, Q: 0.35 },
];
const norm2 = ([x, y]: [number, number]): [number, number] => { const l = Math.hypot(x, y); return [x / l, y / l]; };
const W = WAVES.map((w) => ({ ...w, d: norm2(w.d), k: (2 * Math.PI) / w.L, c: Math.sqrt(9.8 / ((2 * Math.PI) / w.L)) }));

/** Speed through the water, scene units per second. */
const SPEED = 1.9;
const HEADING = -1.2; // bow direction: sailing left across the frame and a little toward the camera, wake trailing behind

function waveHeight(x: number, z: number, t: number) {
  let y = 0;
  for (const w of W) y += w.A * Math.sin(w.k * (w.d[0] * x + w.d[1] * z - w.c * t * 0.6));
  return y;
}

const WAVE_GLSL = /* glsl */ `
uniform float uTime;
${W.map((w, i) => `const vec4 W${i} = vec4(${w.d[0].toFixed(5)}, ${w.d[1].toFixed(5)}, ${w.k.toFixed(5)}, ${w.c.toFixed(5)}); const vec2 P${i} = vec2(${w.A.toFixed(4)}, ${w.Q.toFixed(3)});`).join('\n')}
void gerstner(vec4 w, vec2 p, vec2 xz, inout vec3 pos, inout vec3 nrm) {
  float f = w.z * (dot(w.xy, xz) - w.w * uTime * 0.6);
  float a = p.x, q = p.y;
  pos.x += q * a * w.x * cos(f);
  pos.z += q * a * w.y * cos(f);
  pos.y += a * sin(f);
  nrm.x -= w.x * w.z * a * cos(f);
  nrm.z -= w.y * w.z * a * cos(f);
  nrm.y -= q * w.z * a * sin(f);
}
`;

const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uGlow;
uniform float uNight;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 skyColor(vec3 dir) {
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.55));
  float s = max(dot(dir, uSunDir), 0.0);
  col += uGlow * pow(s, 6.0) * 0.55;
  col += uSunCol * smoothstep(0.9990, 0.9996, s);
  if (uNight > 0.5 && dir.y > 0.02) {
    vec3 g = dir * 420.0;
    vec3 cell = floor(g);
    float pick = step(0.9982, hash(cell));
    float d = length(fract(g) - 0.5);
    float twinkle = 0.6 + 0.4 * hash(cell + 7.0);
    col += vec3(pick * smoothstep(0.22, 0.0, d) * twinkle) * smoothstep(0.02, 0.25, dir.y);
  }
  return col;
}
`;

const SKY_VERT = /* glsl */ `
varying vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const SKY_FRAG = /* glsl */ `
precision highp float;
${SKY_GLSL}
uniform mat4 uInvProjView; uniform vec3 uCam;
varying vec2 vNdc;
void main() {
  vec4 p = uInvProjView * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w - uCam);
  gl_FragColor = vec4(skyColor(dir), 1.0);
}`;

const SEA_VERT = /* glsl */ `
${WAVE_GLSL}
uniform vec2 uOffset;
varying vec3 vWorld; varying vec3 vNormal; varying float vHeight; varying vec2 vSea;
void main() {
  // lay the XY plane flat with its front face up (x, y) -> (x, 0, -y); mapping y -> +z would turn it face-down and cull it
  vec3 pos = vec3(position.x, 0.0, -position.y);
  vec3 base = (modelMatrix * vec4(pos, 1.0)).xyz;
  vec3 p = base; vec3 n = vec3(0.0, 1.0, 0.0);
  vec2 sea = base.xz + uOffset; // the ship is under way: the water under each point moves past it
  gerstner(W0, P0, sea, p, n);
  gerstner(W1, P1, sea, p, n);
  gerstner(W2, P2, sea, p, n);
  gerstner(W3, P3, sea, p, n);
  vWorld = p; vNormal = normalize(n); vHeight = p.y; vSea = sea;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const SEA_FRAG = /* glsl */ `
precision highp float;
${SKY_GLSL}
uniform vec3 uDeep, uShallow, uFoam;
uniform float uTime, uWake;
uniform vec2 uShip, uHead;
varying vec3 vWorld; varying vec3 vNormal; varying float vHeight; varying vec2 vSea;
float n2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(n2(i), n2(i + vec2(1, 0)), f.x), mix(n2(i + vec2(0, 1)), n2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n); r.y = abs(r.y);
  vec3 water = mix(uDeep, uShallow, clamp(vHeight * 0.9 + 0.35, 0.0, 1.0));
  vec3 col = mix(water, skyColor(r), fres);
  col += uSunCol * pow(max(dot(r, uSunDir), 0.0), 260.0) * mix(1.6, 0.55, uNight);
  float detail = vnoise(vSea * 0.9 + uTime * 0.25) * 0.5 + vnoise(vSea * 2.3 - uTime * 0.2) * 0.5;
  float foam = smoothstep(0.42, 0.72, vHeight + detail * 0.28) * mix(0.45, 0.28, uNight);

  // wake: in the ship's frame, 'behind' runs from the bow back past the stern, 'side' across the beam
  vec2 rel = vWorld.xz - uShip;
  float behind = -dot(rel, uHead);
  float side = dot(rel, vec2(uHead.y, -uHead.x));
  float churn = vnoise(vSea * 1.7) * 0.6 + vnoise(vSea * 4.1 + uTime * 0.6) * 0.4;
  float aft = behind - 3.6;                                              // measured from the stern
  float fade = exp(-max(aft, 0.0) / 34.0) * step(0.0, aft);
  float arms = smoothstep(1.1, 0.0, abs(abs(side) - (1.7 + aft * 0.36))) * fade;     // the V, ~20 degrees each side
  float trail = smoothstep(1.6 + aft * 0.06, 0.0, abs(side)) * fade;                  // churned water straight behind
  float e = length(vec2(side / 2.25, behind / 4.5));                                  // hull waterline (an ellipse)
  float hull = smoothstep(0.82, 1.0, e) * smoothstep(1.45, 1.0, e) * (1.0 + smoothstep(0.0, -4.5, behind)); // more at the bow
  float wake = clamp((arms * 1.3 + trail * 1.0 + hull * 1.2) * smoothstep(0.12, 0.6, churn), 0.0, 1.0) * uWake;
  foam = max(foam, wake * mix(0.85, 0.5, uNight));
  col = mix(col, uFoam, foam);
  float dist = length(vWorld.xz - cameraPosition.xz);
  col = mix(col, uHorizon, smoothstep(40.0, 140.0, dist));
  gl_FragColor = vec4(col, 1.0);
}`;

type Palette = { zenith: string; horizon: string; sunCol: string; glow: string; deep: string; shallow: string; foam: string; night: number; sun: [number, number, number]; hemi: [string, string, number]; key: [string, number] };
const DAY: Palette = {
  zenith: '#2f86e0', horizon: '#c6ecff', sunCol: '#fff6d8', glow: '#fff1c4', deep: '#2c82c9', shallow: '#4fd0f0', foam: '#f4fbff',
  night: 0, sun: [0.55, 0.32, -0.77], hemi: ['#dff3ff', '#2a5f8a', 1.4], key: ['#fff3dc', 2.4],
};
const NIGHT: Palette = {
  zenith: '#040a18', horizon: '#1c3157', sunCol: '#e9f1ff', glow: '#9fb8e8', deep: '#020b17', shallow: '#0b2c4d', foam: '#9fb6d6',
  night: 1, sun: [0.38, 0.2, -0.9], hemi: ['#8aa6d8', '#071425', 0.7], key: ['#c9d8ff', 1.1],
};

export function createOcean({ canvas, light, reducedMotion, shipSrc, crew = [], onShip }: OceanOptions): Ocean | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
  camera.position.set(0, 8.6, 34); // high enough to see down onto the deck, where the crew stand
  const look = new THREE.Vector3(0, 3.6, 0);
  camera.lookAt(look);

  const shared = {
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() },
    uSunCol: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uNight: { value: 0 },
    uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
    uOffset: { value: new THREE.Vector2() }, uShip: { value: new THREE.Vector2() }, uHead: { value: new THREE.Vector2(0, 1) },
    uWake: { value: 0 },
  };

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthWrite: false, depthTest: false,
      uniforms: { ...shared, uInvProjView: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() } },
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const seaGeo = new THREE.PlaneGeometry(300, 300, 480, 480);
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: shared }));
  sea.frustumCulled = false;
  sea.position.z = -95;
  scene.add(sea);

  const hemi = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  scene.add(hemi, key);

  const applyPalette = (isLight: boolean) => {
    const p = isLight ? DAY : NIGHT;
    shared.uZenith.value.set(p.zenith); shared.uHorizon.value.set(p.horizon); shared.uSunCol.value.set(p.sunCol);
    shared.uGlow.value.set(p.glow); shared.uDeep.value.set(p.deep); shared.uShallow.value.set(p.shallow); shared.uFoam.value.set(p.foam);
    shared.uNight.value = p.night;
    shared.uSunDir.value.set(...p.sun).normalize();
    hemi.color.set(p.hemi[0]); hemi.groundColor.set(p.hemi[1]); hemi.intensity = p.hemi[2];
    key.color.set(p.key[0]); key.intensity = p.key[1];
    key.position.copy(shared.uSunDir.value).multiplyScalar(50);
  };
  applyPalette(light);

  /* ---- the ship */
  const ship = new THREE.Group();
  const tilt = new THREE.Group();
  ship.add(tilt);
  const SHIP_X = 11, SHIP_Z = -6;
  ship.position.set(SHIP_X, 0, SHIP_Z);
  ship.rotation.y = HEADING;
  ship.visible = false;
  scene.add(ship);
  shared.uShip.value.set(SHIP_X, SHIP_Z);
  shared.uHead.value.set(Math.sin(HEADING), Math.cos(HEADING));
  let disposed = false;
  const shipGeos: THREE.BufferGeometry[] = [];
  const shipMats: THREE.Material[] = [];
  const crewRoots: THREE.Object3D[] = [];
  const mixers: THREE.AnimationMixer[] = [];

  /** Deck spots in the ship model's own units, relative to its bounding-box centre (bow is +z): the raised
   *  foredeck first, then the lawn either side of the mainmast. Each is dropped onto the deck by a ray. */
  const SPOTS: Array<[number, number]> = [
    [0, 2.35], [-0.7, 1.95], [0.7, 1.95],
    [-1.05, 0.2], [1.05, 0.2], [-1.0, -0.85], [1.0, -0.85], [0, -1.05], [-0.45, -0.5],
  ];
  /** Crew height in ship-model units (the ship is about 9 tall, keel to masthead): big enough to read at this distance. */
  const CREW_H = 1.2;

  if (shipSrc) {
    new GLTFLoader().loadAsync(shipSrc).then((gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material)) return;
        // the model ships on its own square slab of sea (a see-through blue material): leave it out, the ocean is ours
        if ((m.material as THREE.MeshPhysicalMaterial).transmission > 0) return;
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        const list = byMat.get(m.material) ?? [];
        list.push(g);
        byMat.set(m.material, list);
      });
      const hull = new THREE.Group();
      byMat.forEach((geos, mat) => {
        const indexed = geos.every((g) => g.index);
        const sameAttrs = geos.every((g) => Object.keys(g.attributes).sort().join() === Object.keys(geos[0].attributes).sort().join());
        const parts = indexed && sameAttrs ? [mergeGeometries(geos) ?? null] : geos;
        (parts.every(Boolean) ? (parts as THREE.BufferGeometry[]) : geos).forEach((g) => {
          shipGeos.push(g);
          hull.add(new THREE.Mesh(g, mat));
        });
        shipMats.push(mat);
      });
      const box = new THREE.Box3().setFromObject(hull);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());

      // find the deck under each spot: the highest up-facing surface below the sails
      hull.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      const deckTop = box.min.y + size.y * 0.45;
      const deck: THREE.Vector3[] = [];
      for (const [sx, sz] of SPOTS) {
        ray.set(new THREE.Vector3(centre.x + sx, box.max.y + 1, centre.z + sz), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(hull.children, false)
          .filter((h) => h.point.y < deckTop && h.face && Math.abs(h.face.normal.y) > 0.6)
          .sort((a, b) => b.point.y - a.point.y)[0];
        if (hit) deck.push(hit.point.clone());
      }
      tilt.userData.deck = deck;
      canvas.dataset.deckSpots = String(deck.length);

      const scale = 8.5 / Math.max(size.x, size.z);
      hull.scale.setScalar(scale);
      // sit deep in the water: about a fifth of the full height (keel to masthead) below the surface
      hull.position.set(-centre.x * scale, -box.min.y * scale - size.y * scale * 0.2, -centre.z * scale);
      tilt.add(hull);
      ship.visible = true;
      shared.uWake.value = 1;
      loadCrew(hull, deck);
      gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      onShip?.();
      if (!running) render();
    }).catch(() => undefined);
  }

  /* ---- crew on deck */
  function loadCrew(hull: THREE.Group, deck: THREE.Vector3[]) {
    const loader = new GLTFLoader();
    crew.slice(0, deck.length).forEach((src, i) => {
      loader.loadAsync(src).then((gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(root);
        const s = b.getSize(new THREE.Vector3());
        const c = b.getCenter(new THREE.Vector3());
        if (!(s.y > 0)) return;
        const k = CREW_H / s.y;
        const holder = new THREE.Group();
        root.position.set(-c.x, -b.min.y, -c.z); // feet on the origin, centred
        holder.add(root);
        holder.scale.setScalar(k);
        holder.position.copy(deck[i]);
        holder.rotation.y = (i % 2 ? 1 : -1) * 0.25 * Math.min(1, i); // face the bow (+z), a little turned
        hull.add(holder);
        crewRoots.push(holder);
        if (gltf.animations.length && !reducedMotion) {
          const mixer = new THREE.AnimationMixer(root);
          const clip = gltf.animations.find((a) => /idle|stand|breath/i.test(a.name)) ?? gltf.animations[0];
          mixer.clipAction(clip).play();
          mixer.update(Math.random() * 2); // not all in step
          mixers.push(mixer);
        }
        if (!running) render();
      }).catch(() => undefined);
    });
  }

  /* ---- sizing */
  const resize = () => {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // narrow screens: step back so the ship stays in frame
    camera.position.z = 34 * Math.max(1, 1.25 / camera.aspect);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) render(); });
  ro.observe(canvas);

  const inv = new THREE.Matrix4();
  const render = () => {
    camera.updateMatrixWorld();
    inv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    (sky.material as THREE.ShaderMaterial).uniforms.uInvProjView.value.copy(inv);
    (sky.material as THREE.ShaderMaterial).uniforms.uCam.value.copy(camera.position);
    renderer.render(scene, camera);
  };

  let running = false, raf = 0, prev = 0, t = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (document.documentElement.dataset.hub === 'open') { prev = now; return; }
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60;
    prev = now;
    t += dt;
    shared.uTime.value = t;
    // under way: a slow weave in the heading, and the sea streams past along it
    const yaw = HEADING + Math.sin(t * 0.09) * 0.07;
    const hx = Math.sin(yaw), hz = Math.cos(yaw);   // bow direction
    const px = Math.cos(yaw), pz = -Math.sin(yaw);  // starboard (+x of the ship)
    const off = shared.uOffset.value;
    off.x += hx * SPEED * dt;
    off.y += hz * SPEED * dt;
    shared.uHead.value.set(hx, hz);
    ship.rotation.y = yaw;
    // ride the swell: height from the water under the hull, pitch and roll from its slope along and across the ship
    const sx = ship.position.x + off.x, sz = ship.position.z + off.y;
    const h = (dx: number, dz: number) => waveHeight(sx + dx, sz + dz, t);
    const fore = h(hx * 2.8, hz * 2.8), aftH = h(-hx * 2.8, -hz * 2.8);
    const stbd = h(px * 1.6, pz * 1.6), port = h(-px * 1.6, -pz * 1.6);
    ship.position.y = (h(0, 0) * 0.6 + (fore + aftH + stbd + port) * 0.1) * 0.9;
    tilt.rotation.x = -Math.atan2(fore - aftH, 5.6) * 0.8;
    tilt.rotation.z = Math.atan2(stbd - port, 3.2) * 0.8;
    mixers.forEach((m) => m.update(dt));
    render();
  };

  render();
  return {
    setActive(active) {
      if (reducedMotion || disposed || active === running) { if (!running) render(); return; }
      running = active;
      if (active) { prev = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
    },
    setLight(next) { applyPalette(next); if (!running) render(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      seaGeo.dispose(); (sea.material as THREE.Material).dispose();
      sky.geometry.dispose(); (sky.material as THREE.Material).dispose();
      shipGeos.forEach((g) => g.dispose());
      shipMats.forEach((m) => m.dispose());
      mixers.forEach((m) => m.stopAllAction());
      crewRoots.forEach((r) => r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
      }));
      renderer.dispose();
    },
  };
}
