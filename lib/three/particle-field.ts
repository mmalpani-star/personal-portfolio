/**
 * GPU particle cloud for the Projects section background.
 *
 * A float position texture is advanced once per frame on the GPU: particles are pulled onto a smooth,
 * twisted ring-shaped signed-distance surface, drift with curl noise, spring back toward their origin,
 * and are pushed by a small GPU fluid simulation that the cursor stirs. The points are then drawn as
 * sprites that look their positions up from that texture. Only the particles: no UI.
 */
import * as THREE from 'three';

export type ParticleFieldOptions = {
  canvas: HTMLCanvasElement;
  /** Points per side of the position texture (points = side * side). */
  side: number;
  reducedMotion: boolean;
  light: boolean;
};

export type ParticleField = {
  setActive: (active: boolean) => void;
  setLight: (light: boolean) => void;
  dispose: () => void;
};

/* ---------------------------------------------------------------- shared GLSL */

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FLUID_VERT = /* glsl */ `
uniform vec2 texelSize;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
void main() {
  vUv = uv;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FLUID_HEAD = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
`;

const SPLAT = FLUID_HEAD + /* glsl */ `
uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 p0; uniform vec2 p1; uniform float radius;
void main() {
  vec2 a = vUv - p0, b = p1 - p0;
  a.x *= aspect; b.x *= aspect;
  float h = clamp(dot(a, b) / max(dot(b, b), 1e-8), 0.0, 1.0);
  vec2 d = a - b * h;
  float s = exp(-dot(d, d) / (radius * radius));
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s * color, 1.0);
}`;

const CURL = FLUID_HEAD + /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY = FLUID_HEAD + /* glsl */ `
uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
void main() {
  float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + force * dt, 0.0, 1.0);
}`;

const DIVERGENCE = FLUID_HEAD + /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CLEAR = FLUID_HEAD + /* glsl */ `
uniform sampler2D uTexture; uniform float value;
void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`;

const PRESSURE = FLUID_HEAD + /* glsl */ `
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = FLUID_HEAD + /* glsl */ `
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`;

const ADVECT = FLUID_HEAD + /* glsl */ `
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 velTexel; uniform float dt; uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * velTexel;
  gl_FragColor = dissipation * texture2D(uSource, coord);
}`;

/* ---------------------------------------------------------------- particle simulation */

const SIM = /* glsl */ `
precision highp float;
#define MOUSE_STRENGTH 0.16
varying vec2 vUv;
uniform sampler2D tPos; uniform sampler2D tOrigin; uniform sampler2D tVel; uniform sampler2D tDen;
uniform float uTime; uniform float uHZ; uniform float uMouse;
uniform mat4 uProjView; uniform mat4 uModel; uniform mat3 uCamRot;

vec3 qrot(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

// A smooth, slightly twisted ring with one big opening and soft lobes (~0.7 across).
float sdfShape(vec3 p) {
  float lp = length(p);
  if (lp > 0.8) return lp - 0.7;
  p.z = sqrt(p.z * p.z + 0.0215) - sqrt(0.012);           // mirrored front/back with a soft seam
  p = qrot(p, vec4(0.5));
  float a = atan(p.y, p.x);
  vec2 q = vec2(length(p.xy) - 0.40 * (1.0 + 0.14 * sin(2.0 * a + 0.6)), p.z - 0.09 * sin(a + 0.4));
  float c = cos(0.5 * a + 0.3), s = sin(0.5 * a + 0.3);
  q = mat2(c, -s, s, c) * q;                                // the cross-section turns as it goes round: the twist
  q.x /= 1.45;
  float r = 0.12 + 0.045 * sin(3.0 * a + 1.0);
  return (length(q) - r) * 0.8;
}
vec3 sdfNormal(vec3 p) {
  const vec2 e = vec2(0.001, 0.0);
  return vec3(sdfShape(p + e.xyy) - sdfShape(p - e.xyy), sdfShape(p + e.yxy) - sdfShape(p - e.yxy), sdfShape(p + e.yyx) - sdfShape(p - e.yyx)) / 0.002;
}

vec3 potential(vec3 p) {
  return vec3(sin(p.y * 2.1 + 1.3) + sin(p.z * 3.7 + 0.2), sin(p.z * 2.3 + 0.7) + sin(p.x * 3.1 + 1.9), sin(p.x * 2.7 + 2.1) + sin(p.y * 3.3 + 0.5));
}
vec3 curlNoise(vec3 p) {
  const float e = 0.01;
  vec3 dx = vec3(e, 0.0, 0.0), dy = vec3(0.0, e, 0.0), dz = vec3(0.0, 0.0, e);
  vec3 x0 = potential(p - dx), x1 = potential(p + dx), y0 = potential(p - dy), y1 = potential(p + dy), z0 = potential(p - dz), z1 = potential(p + dz);
  vec3 c = vec3((y1.z - y0.z) - (z1.y - z0.y), (z1.x - z0.x) - (x1.z - x0.z), (x1.y - x0.y) - (y1.x - y0.x));
  return c / (length(c) + 1e-6);
}

void main() {
  vec3 pos = texture2D(tPos, vUv).xyz;
  vec3 origin = texture2D(tOrigin, vUv).xyz;
  if (length(pos) > 0.7) pos /= 2.0;
  pos += curlNoise(pos * 0.1 + uTime * 0.05 * 0.5) * 0.0002 * uHZ;
  vec3 g = sdfNormal(pos);
  float d = sdfShape(pos);
  vec3 gn = normalize(g + 1e-6);
  pos += cross(normalize(pos + 1e-6), gn) * 0.0005;
  pos += -gn * d * 0.5;
  pos += (origin - pos) * 0.0002 * uHZ;

  vec4 clip = uProjView * uModel * vec4(pos, 1.0);
  vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
  if (uMouse > 0.0 && suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
    vec3 flow = uCamRot * vec3(texture2D(tVel, suv).xy, 0.0);
    pos += flow * 0.0001 * uHZ * MOUSE_STRENGTH * texture2D(tDen, suv).r;
  }
  gl_FragColor = vec4(pos, 1.0);
}`;

/* ---------------------------------------------------------------- point rendering */

const POINT_VERT = /* glsl */ `
#define POINT_K 0.72
attribute vec4 aRandom;
uniform sampler2D tPos; uniform float uDPR;
varying vec4 vRandom; varying float vScale;
void main() {
  vec3 pos = texture2D(tPos, position.xy).xyz;
  pos *= mix(1.0, 1.5, pow(aRandom.y, 150.0));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;
  vScale = smoothstep(3.0, 15.0, dist) * mix(0.5, 1.0, aRandom.z);
  gl_PointSize = 0.04 * uDPR * 2.0 * vScale * (1000.0 / dist) * POINT_K;
  gl_Position = projectionMatrix * mv;
  vRandom = aRandom;
}`;

const POINT_FRAG = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uLight;
varying vec4 vRandom; varying float vScale;
vec3 softLight(vec3 a, vec3 b) { return mix(2.0 * a * b + a * a * (1.0 - 2.0 * b), 2.0 * a * (1.0 - b) + sqrt(a) * (2.0 * b - 1.0), step(0.5, b)); }
vec3 overlay(vec3 a, vec3 b) { return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a)); }
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0 || vScale < 0.1) discard;
  float lav = pow(vRandom.z, 100.0);
  vec3 col = mix(vec3(mix(0.0, 0.2, vRandom.x)), vec3(0.6, 0.45, 1.0), lav);
  col *= 0.5 + (0.4 + sin(uTime * 4.0 + vRandom.y * 20.0)) * pow(vRandom.z, 10.0) * 2.5;
  // a soft sphere "matcap", turned per point
  float a = sin(uTime + vRandom.z * 20.0) * 0.5 + 1.0;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
  vec3 n = vec3(q, sqrt(max(0.0, 1.0 - r2)));
  vec3 m = vec3(clamp(0.25 + 0.75 * dot(n, normalize(vec3(-0.35, 0.45, 0.82))), 0.0, 1.0));
  col = clamp(col, 0.0, 1.0);
  col = mix(col, softLight(col, m), 0.8);
  col = mix(col, overlay(col, m), 0.2);
  if (uLight > 0.5) {
    // white page: dark ink points, normal blending
    vec3 ink = vec3(0.0, 0.48, 0.5); // deep cyan: pure #00FFFF all but vanishes on white
    gl_FragColor = vec4(ink, clamp(dot(col, vec3(0.3333)) * 1.1, 0.012, 0.3));
  } else {
    // it is a background behind text and models: keep piled-up sheets well short of pure white
    vec3 o = vec3(0.0, 1.0, 1.0) * (dot(col, vec3(0.3333)) * 0.46); // electric cyan #00FFFF
    gl_FragColor = vec4(o, max(o.r, max(o.g, o.b)));
  }
}`;

/* ---------------------------------------------------------------- setup */

type Target = THREE.WebGLRenderTarget;
type Double = { read: Target; write: Target; swap: () => void };

export function createParticleField({ canvas, side, reducedMotion, light }: ParticleFieldOptions): ParticleField | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
    // Without float render targets the position texture can't be simulated on the GPU.
    renderer.dispose();
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (material: THREE.Material, target: Target | null) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };

  const rt = (w: number, h: number, type: THREE.TextureDataType, filter: THREE.MagnificationTextureFilter) =>
    new THREE.WebGLRenderTarget(w, h, {
      type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false, stencilBuffer: false,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
  const double = (w: number, h: number, type: THREE.TextureDataType, filter: THREE.MagnificationTextureFilter): Double => {
    const d = { read: rt(w, h, type, filter), write: rt(w, h, type, filter), swap() { const t = d.read; d.read = d.write; d.write = t; } };
    return d;
  };

  /* ---- particle state */
  const count = side * side;
  const origin = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    origin[i * 4] = Math.random() * 2 - 1;
    origin[i * 4 + 1] = Math.random() * 2 - 1;
    origin[i * 4 + 2] = Math.random() * 2 - 1;
    origin[i * 4 + 3] = 1;
  }
  const originTex = new THREE.DataTexture(origin, side, side, THREE.RGBAFormat, THREE.FloatType);
  originTex.needsUpdate = true;
  const positions = double(side, side, THREE.FloatType, THREE.NearestFilter);
  const copy = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: 'precision highp float; uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
    uniforms: { t: { value: originTex } },
  });
  pass(copy, positions.read);

  /* ---- fluid */
  const SIM_RES = 256, DYE_RES = 512;
  const half = THREE.HalfFloatType, lin = THREE.LinearFilter;
  const velocity = double(SIM_RES, SIM_RES, half, lin);
  const density = double(DYE_RES, DYE_RES, half, lin);
  const pressure = double(SIM_RES, SIM_RES, half, THREE.NearestFilter);
  const divergenceRT = rt(SIM_RES, SIM_RES, half, THREE.NearestFilter);
  const curlRT = rt(SIM_RES, SIM_RES, half, THREE.NearestFilter);
  const simTexel = new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES);
  const dyeTexel = new THREE.Vector2(1 / DYE_RES, 1 / DYE_RES);
  const fluid = (frag: string, uniforms: Record<string, THREE.IUniform>, texel = simTexel) =>
    new THREE.ShaderMaterial({ vertexShader: FLUID_VERT, fragmentShader: frag, uniforms: { texelSize: { value: texel }, ...uniforms }, depthTest: false, depthWrite: false });
  const DT = 1 / 60;
  const mSplat = fluid(SPLAT, { uTarget: { value: null }, aspect: { value: 1 }, color: { value: new THREE.Vector3() }, p0: { value: new THREE.Vector2() }, p1: { value: new THREE.Vector2() }, radius: { value: 0.01 } });
  const mCurl = fluid(CURL, { uVelocity: { value: null } });
  const mVort = fluid(VORTICITY, { uVelocity: { value: null }, uCurl: { value: null }, curl: { value: 30 }, dt: { value: DT } });
  const mDiv = fluid(DIVERGENCE, { uVelocity: { value: null } });
  const mClear = fluid(CLEAR, { uTexture: { value: null }, value: { value: 0.95 } });
  const mPressure = fluid(PRESSURE, { uPressure: { value: null }, uDivergence: { value: null } });
  const mGrad = fluid(GRADIENT, { uPressure: { value: null }, uVelocity: { value: null } });
  const mAdvect = fluid(ADVECT, { uVelocity: { value: null }, uSource: { value: null }, velTexel: { value: simTexel }, dt: { value: DT }, dissipation: { value: 0.98 } });

  const stepFluid = () => {
    mCurl.uniforms.uVelocity.value = velocity.read.texture; pass(mCurl, curlRT);
    mVort.uniforms.uVelocity.value = velocity.read.texture; mVort.uniforms.uCurl.value = curlRT.texture; pass(mVort, velocity.write); velocity.swap();
    mDiv.uniforms.uVelocity.value = velocity.read.texture; pass(mDiv, divergenceRT);
    mClear.uniforms.uTexture.value = pressure.read.texture; pass(mClear, pressure.write); pressure.swap();
    mPressure.uniforms.uDivergence.value = divergenceRT.texture;
    for (let i = 0; i < 5; i++) { mPressure.uniforms.uPressure.value = pressure.read.texture; pass(mPressure, pressure.write); pressure.swap(); }
    mGrad.uniforms.uPressure.value = pressure.read.texture; mGrad.uniforms.uVelocity.value = velocity.read.texture; pass(mGrad, velocity.write); velocity.swap();
    mAdvect.uniforms.texelSize.value = simTexel;
    mAdvect.uniforms.uVelocity.value = velocity.read.texture; mAdvect.uniforms.uSource.value = velocity.read.texture; mAdvect.uniforms.dissipation.value = 0.98;
    pass(mAdvect, velocity.write); velocity.swap();
    mAdvect.uniforms.texelSize.value = dyeTexel;
    mAdvect.uniforms.uVelocity.value = velocity.read.texture; mAdvect.uniforms.uSource.value = density.read.texture; mAdvect.uniforms.dissipation.value = 0.97;
    pass(mAdvect, density.write); density.swap();
  };
  const splat = (target: Double, texel: THREE.Vector2, p0: THREE.Vector2, p1: THREE.Vector2, color: THREE.Vector3, radius: number, aspect: number) => {
    mSplat.uniforms.texelSize.value = texel;
    mSplat.uniforms.uTarget.value = target.read.texture;
    mSplat.uniforms.p0.value.copy(p0); mSplat.uniforms.p1.value.copy(p1);
    mSplat.uniforms.color.value.copy(color); mSplat.uniforms.radius.value = radius; mSplat.uniforms.aspect.value = aspect;
    pass(mSplat, target.write); target.swap();
  };

  /* ---- scene */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  const BASE = new THREE.Vector3(-1.17, 0, 6);
  camera.position.copy(BASE);
  camera.lookAt(0, 0, 0);
  const group = new THREE.Group();
  group.position.set(0.343, 0.16, -1);
  group.rotation.set(THREE.MathUtils.degToRad(-28.4), THREE.MathUtils.degToRad(390), THREE.MathUtils.degToRad(4.92));
  group.scale.set(5, 5, 6);
  scene.add(group);

  const uvs = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    uvs[i * 3] = ((i % side) + 0.5) / side;
    uvs[i * 3 + 1] = (Math.floor(i / side) + 0.5) / side;
    for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random();
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(uvs, 3));
  geom.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 4));
  const pointsMat = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { tPos: { value: positions.read.texture }, uDPR: { value: dpr }, uTime: { value: 0 }, uLight: { value: light ? 1 : 0 } },
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, pointsMat);
  points.frustumCulled = false;
  group.add(points);

  const simMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: SIM,
    uniforms: {
      tPos: { value: null }, tOrigin: { value: originTex }, tVel: { value: velocity.read.texture }, tDen: { value: density.read.texture },
      uTime: { value: 0 }, uHZ: { value: 1 }, uMouse: { value: reducedMotion ? 0 : 1 },
      uProjView: { value: new THREE.Matrix4() }, uModel: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix3() },
    },
    depthTest: false,
    depthWrite: false,
  });

  const applyLight = (isLight: boolean) => {
    pointsMat.uniforms.uLight.value = isLight ? 1 : 0;
    if (isLight) pointsMat.blending = THREE.NormalBlending;
    else {
      // additive colour, and its brightest channel as additive alpha: valid premultiplied pixels (see dot-bust.ts)
      pointsMat.blending = THREE.CustomBlending;
      pointsMat.blendEquation = THREE.AddEquation;
      pointsMat.blendSrc = THREE.OneFactor;
      pointsMat.blendDst = THREE.OneFactor;
      pointsMat.blendSrcAlpha = THREE.OneFactor;
      pointsMat.blendDstAlpha = THREE.OneFactor;
    }
    pointsMat.needsUpdate = true;
  };
  applyLight(light);

  /* ---- sizing */
  let width = 1, height = 1;
  const resize = () => {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
  ro.observe(canvas);

  /* ---- pointer */
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, px: NaN, py: NaN, last: 0 };
  const onPointer = (x: number, y: number) => { mouse.x = x; mouse.y = y; };
  const onMove = (e: PointerEvent) => onPointer(e.clientX, e.clientY);
  const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) onPointer(t.clientX, t.clientY); };
  if (!reducedMotion) {
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
  }
  const small = window.innerWidth < 768;
  const clampMap = (v: number, a: number, b: number, c: number, d: number) => c + (Math.min(Math.max(v, a), b) - a) / (b - a) * (d - c);
  const p0 = new THREE.Vector2(), p1 = new THREE.Vector2(), vColor = new THREE.Vector3(), white = new THREE.Vector3(1, 1, 1);

  const feedMouse = (now: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = mouse.x - rect.left, y = mouse.y - rect.top;
    if (Number.isNaN(mouse.px)) { mouse.px = x; mouse.py = y; }
    const dx = x - mouse.px, dy = y - mouse.py;
    const len = Math.hypot(dx, dy);
    if (len > 0.01 && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      const radius = clampMap(len, 0, 5, 0, 60) * 0.6 * (small ? 0.8 : 1);
      const mult = clampMap(len, 0, 15, 0, 10);
      const fresh = now - mouse.last > 50;
      p1.set(x / rect.width, 1 - y / rect.height);
      if (fresh) p0.copy(p1); else p0.set(mouse.px / rect.width, 1 - mouse.py / rect.height);
      const r = (radius / 200) * 0.25;
      const aspect = rect.width / rect.height;
      vColor.set(dx * mult, -dy * mult, 1);
      splat(velocity, simTexel, p0, p1, vColor, r, aspect);
      splat(density, dyeTexel, p0, p1, white, r, aspect);
      mouse.last = now;
    }
    mouse.px = x; mouse.py = y;
    return rect;
  };

  /* ---- frame */
  const target = new THREE.Vector3();
  const projView = new THREE.Matrix4();
  const stepParticles = (time: number, hz: number) => {
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    simMat.uniforms.uProjView.value.copy(projView);
    simMat.uniforms.uModel.value.copy(group.matrixWorld);
    simMat.uniforms.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    simMat.uniforms.tPos.value = positions.read.texture;
    simMat.uniforms.tVel.value = velocity.read.texture;
    simMat.uniforms.tDen.value = density.read.texture;
    simMat.uniforms.uTime.value = time;
    simMat.uniforms.uHZ.value = hz;
    pass(simMat, positions.write);
    positions.swap();
  };
  const draw = () => {
    pointsMat.uniforms.tPos.value = positions.read.texture;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };

  let running = false;
  let raf = 0;
  let prev = 0;
  let time = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // The landing hanger sits over the page: nothing here is visible while it is open.
    if (document.documentElement.dataset.hub === 'open') { prev = now; return; }
    const dt = prev ? Math.min((now - prev) / 1000, 1 / 20) : 1 / 60;
    prev = now;
    time += dt;
    const rect = feedMouse(now);
    // gaze: the camera leans a little toward the cursor
    const mx = ((mouse.x - rect.left) / rect.width) * 2 - 1;
    const my = ((mouse.y - rect.top) / rect.height) * 2 - 1;
    target.set(BASE.x - mx, BASE.y + my * 2, BASE.z);
    camera.position.lerp(target, 0.05);
    camera.lookAt(0, 0, 0);
    stepFluid();
    stepParticles(time, dt * 60);
    pointsMat.uniforms.uTime.value = time;
    draw();
  };

  // Form the cloud before the first frame so it never appears as a random cube of dots.
  for (let i = 0; i < (reducedMotion ? 600 : 180); i++) stepParticles(i / 60, 1);
  draw();

  return {
    setActive(active) {
      if (reducedMotion || active === running) return;
      running = active;
      if (active) { prev = 0; mouse.px = NaN; raf = requestAnimationFrame(frame); }
      else cancelAnimationFrame(raf);
    },
    setLight(isLight) {
      applyLight(isLight);
      if (!running) draw();
    },
    dispose() {
      cancelAnimationFrame(raf);
      running = false;
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      [positions, velocity, density, pressure].forEach((d) => { d.read.dispose(); d.write.dispose(); });
      divergenceRT.dispose(); curlRT.dispose(); originTex.dispose();
      [copy, mSplat, mCurl, mVort, mDiv, mClear, mPressure, mGrad, mAdvect, simMat, pointsMat].forEach((m) => m.dispose());
      geom.dispose(); quad.geometry.dispose();
      renderer.dispose();
    },
  };
}
