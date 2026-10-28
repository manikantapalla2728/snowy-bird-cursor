(() => {
'use strict';

/* ============ setup ============ */
const canvas = document.getElementById('stage');
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), RECORD = params.has('record'), DEMO_LEN = 15;
const SEEK = parseFloat(params.get('seek')) || 0;
const SCALE = parseFloat(params.get('scale')) || 1.35;   // overall bird size

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: RECORD });
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 10, 5000);
let W = 1, H = 1, camDist = 1000, particleMat;

const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); fsScene.add(fsQuad);
const LV = 4, rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType, depthBuffer: false };
let sceneRT = null, rtA = [], rtB = [], brightMat, blurMat, compMat;
const FSV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function initComposer() {
  sceneRT = new THREE.WebGLRenderTarget(2, 2, { ...rtOpt, depthBuffer: true, samples: 4 });
  for (let i = 0; i < LV; i++) { rtA.push(new THREE.WebGLRenderTarget(2, 2, rtOpt)); rtB.push(new THREE.WebGLRenderTarget(2, 2, rtOpt)); }
  brightMat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: null }, uThr: { value: 0.55 } }, vertexShader: FSV, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D uTex; uniform float uThr; varying vec2 vUv; void main(){ vec3 c = texture2D(uTex, vUv).rgb; float v = max(max(c.r, c.g), c.b); gl_FragColor = vec4(c * (max(0.0, v - uThr) / max(v, 1e-4)), 1.0); }' });
  blurMat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FSV, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D uTex; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(uTex, vUv).rgb * 0.2270270270; c += (texture2D(uTex, vUv + uDir * 1.3846153846).rgb + texture2D(uTex, vUv - uDir * 1.3846153846).rgb) * 0.3162162162; c += (texture2D(uTex, vUv + uDir * 3.2307692308).rgb + texture2D(uTex, vUv - uDir * 3.2307692308).rgb) * 0.0702702703; gl_FragColor = vec4(c, 1.0); }' });
  compMat = new THREE.ShaderMaterial({ uniforms: { uScene: { value: null }, uB0: { value: null }, uB1: { value: null }, uB2: { value: null }, uB3: { value: null }, uStr: { value: 0.85 } }, vertexShader: FSV, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D uScene, uB0, uB1, uB2, uB3; uniform float uStr; varying vec2 vUv; void main(){ vec3 c = texture2D(uScene, vUv).rgb; vec3 b = texture2D(uB0, vUv).rgb * 0.55 + texture2D(uB1, vUv).rgb * 0.5 + texture2D(uB2, vUv).rgb * 0.45 + texture2D(uB3, vUv).rgb * 0.4; c += b * uStr; gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0); }' });
}
function fsPass(mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
function renderFX() {
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  brightMat.uniforms.uTex.value = sceneRT.texture; fsPass(brightMat, rtA[0]);
  for (let i = 0; i < LV; i++) {
    const src = i === 0 ? rtA[0] : rtA[i - 1];
    blurMat.uniforms.uTex.value = src.texture; blurMat.uniforms.uDir.value.set(1 / src.width, 0); fsPass(blurMat, rtB[i]);
    blurMat.uniforms.uTex.value = rtB[i].texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB[i].height); fsPass(blurMat, rtA[i]);
  }
  compMat.uniforms.uScene.value = sceneRT.texture;
  for (let i = 0; i < LV; i++) compMat.uniforms['uB' + i].value = rtA[i].texture;
  fsPass(compMat, null);
}
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
  if (sceneRT) {
    const bw = Math.max(2, Math.floor(W * pr)), bh = Math.max(2, Math.floor(H * pr));
    sceneRT.setSize(bw, bh);
    for (let i = 0; i < LV; i++) { const w = Math.max(2, bw >> (i + 1)), h = Math.max(2, bh >> (i + 1)); rtA[i].setSize(w, h); rtB[i].setSize(w, h); }
  }
  camera.aspect = W / H;
  camDist = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(W / 2, -H / 2, camDist); camera.updateProjectionMatrix();
  if (particleMat) { particleMat.uniforms.uPR.value = pr; particleMat.uniforms.uDist.value = camDist; }
}

/* ============ lights ============ */
scene.add(new THREE.AmbientLight(0x6a8cd8, 0.9));
const key = new THREE.DirectionalLight(0xeaf6ff, 1.8); key.position.set(-300, 400, 700); scene.add(key);
const rimL = new THREE.DirectionalLight(0x4a7cff, 1.4); rimL.position.set(300, -300, -300); scene.add(rimL);
const auraLight = new THREE.PointLight(0x7ae0ff, 1.2, 260); scene.add(auraLight);

/* ============ helpers ============ */
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 70, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(180,235,255,0.9)'); gr.addColorStop(0.85, 'rgba(120,200,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
const glowTex = glowTexture(), ringTex = ringTexture();
function glowSprite(color, opacity, tex) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
}

/* ============ feather shader (ice) ============ */
const featherVS = `
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const featherFS = `
  uniform vec3 uBase; uniform vec3 uMid; uniform vec3 uTip; uniform float uTime; uniform float uAlpha; uniform float uSeed;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    float v = vUv.y, e = abs(vUv.x - 0.5) * 2.0;
    vec3 grad = mix(uBase, uMid, smoothstep(0.0, 0.5, v));
    grad = mix(grad, uTip, smoothstep(0.45, 1.0, v));
    float barbs = 0.5 + 0.5 * sin(e * 26.0 - v * 15.0 + uSeed * 6.0);
    float shaft = smoothstep(0.07, 0.0, abs(vUv.x - 0.5)) * (1.0 - v * 0.35);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    vec2 cell = floor(vec2(vUv.x * 14.0, v * 46.0) + uSeed * 31.0);
    float tw = step(0.985, hash(cell)) * (0.5 + 0.5 * sin(uTime * 4.0 + hash(cell + 3.0) * 20.0));
    vec3 col = grad * (0.55 + 0.35 * barbs);
    col += shaft * vec3(0.7, 0.92, 1.0) * 0.75;
    col += fres * vec3(0.4, 0.75, 1.0) * 0.9;
    col += tw * vec3(1.3);
    col += smoothstep(0.78, 1.0, e) * vec3(0.3, 0.7, 1.0) * 0.45;   // glowing edge
    float a = uAlpha * (1.0 - smoothstep(0.72, 1.0, e)) * smoothstep(0.0, 0.03, v) * (1.0 - smoothstep(0.93, 1.0, v));
    gl_FragColor = vec4(col, max(a, shaft * 0.9 * uAlpha));
  }`;
function featherMat(base, mid, tip, alpha, seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uBase: { value: new THREE.Color(base) }, uMid: { value: new THREE.Color(mid) }, uTip: { value: new THREE.Color(tip) }, uTime: { value: 0 }, uAlpha: { value: alpha }, uSeed: { value: seed || 0 } },
    vertexShader: featherVS, fragmentShader: featherFS, transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
}
const mats = {
  primary: featherMat(0xa8e2ff, 0x2f9bff, 0x2a3cff, 0.92, 0.1),
  secondary: featherMat(0xc4ecff, 0x4aaeff, 0x3550ff, 0.9, 0.5),
  covert: featherMat(0xcdeeff, 0x74c4ff, 0x3f7cff, 0.9, 0.9),
  body: featherMat(0xb8e4ff, 0x6cbcff, 0x3f7cff, 0.95, 0.3),
  crest: featherMat(0xbff0ff, 0x4ab8ff, 0x7a5cff, 0.95, 0.7),
  tail: featherMat(0xe8faff, 0x4fc0ff, 0x6a4cff, 0.9, 0.2)
};

/* unit feather: length 1 along +Z, width profile, slight downward arch */
function featherGeometry(segs = 12) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs, w = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.7)), 0.6), y = -0.09 * v * v;
    pos.push(-w, y, v, w, y, v); uvs.push(0, v, 1, v);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const featherGeo = featherGeometry();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
function orient(mesh, dir, upHint) {
  _z.copy(dir).normalize(); _x.crossVectors(upHint, _z);
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
  _x.normalize(); _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z); mesh.quaternion.setFromRotationMatrix(_m);
}
function makeFeather(parent, mat, order) {
  const m = new THREE.Mesh(featherGeo, mat); m.renderOrder = order; m.frustumCulled = false; parent.add(m); return m;
}

/* ============ bird root ============ */
const UP = new THREE.Vector3(0, 0.38, 0.93);
const bird = new THREE.Group(); bird.up.copy(UP); scene.add(bird);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfeaff, metalness: 0.15, roughness: 0.3, emissive: 0x1a5cd0, emissiveIntensity: 0.25 });
const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
const coneGeo = new THREE.ConeGeometry(1, 1, 12);
const octGeo = new THREE.OctahedronGeometry(1, 0); octGeo.scale(0.5, 1, 0.5);

// torso, neck, head
const torso = new THREE.Mesh(sphereGeo, bodyMat); torso.scale.set(8, 7, 19); bird.add(torso);
const chest = new THREE.Mesh(sphereGeo, bodyMat); chest.scale.set(8.5, 7.5, 11); chest.position.set(0, 0.5, 7); bird.add(chest);
const neck = new THREE.Mesh(sphereGeo, bodyMat); neck.scale.set(4.6, 4.6, 8); neck.position.set(0, 2.5, 19); bird.add(neck);
const head = new THREE.Group(); head.position.set(0, 4.2, 25); bird.add(head);
const skull = new THREE.Mesh(sphereGeo, bodyMat); skull.scale.set(5.2, 4.8, 6.4); head.add(skull);
const beakMat = new THREE.MeshStandardMaterial({ color: 0xffe8a0, emissive: 0xffb84a, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.4 });
const beakU = new THREE.Mesh(coneGeo, beakMat); beakU.scale.set(2.6, 9, 1.6); beakU.rotation.x = Math.PI / 2; beakU.position.set(0, -0.6, 10); head.add(beakU);
const beakL = new THREE.Mesh(coneGeo, beakMat); beakL.scale.set(2, 6, 1.1); beakL.rotation.x = Math.PI / 2; beakL.position.set(0, -2, 8.4); head.add(beakL);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8ffff });
for (const s of [-1, 1]) {
  const eye = new THREE.Mesh(sphereGeo, eyeMat); eye.scale.setScalar(1.25); eye.position.set(s * 3.9, 1.3, 2.6); head.add(eye);
  const g = glowSprite(0x9ae8ff, 0.9); g.scale.setScalar(11); g.position.copy(eye.position); head.add(g);
}
const gem = new THREE.Mesh(octGeo, new THREE.MeshBasicMaterial({ color: 0xaaf0ff })); gem.scale.set(2.6, 4, 2.6); gem.position.set(0, 5.6, 10); bird.add(gem);
const gemGlow = glowSprite(0x7ae6ff, 0.9); gemGlow.scale.setScalar(20); gemGlow.position.copy(gem.position); bird.add(gemGlow);
const bodyGlow = glowSprite(0x3a8cff, 0.2); bodyGlow.scale.setScalar(80); bodyGlow.position.set(0, 3, 6); bird.add(bodyGlow);

// body plumage (static, shader-lit)
const bodyFeathers = [];
{
  const up0 = new THREE.Vector3(0, 1, 0);
  for (let r = 0; r < 8; r++) {
    const z = 16 - r * 4.6, prof = Math.sqrt(Math.max(0.05, 1 - Math.pow(z / 19, 2)));
    const n = r < 2 ? 6 : 8;
    for (let k = 0; k < n; k++) {
      const phi = lerp(0.12, Math.PI - 0.12, (k + (r % 2) * 0.5) / (n - 1 + 0.001));
      const px = Math.cos(phi) * 8.2 * prof, py = Math.sin(phi) * 7.4 * prof;
      const f = makeFeather(bird, mats.body, 4);
      const L = 12 + (r % 3) * 1.5; f.scale.set(L * 0.5, 1, L);
      f.position.set(px, py + 0.4, z);
      const out = new THREE.Vector3(px * 0.06, py * 0.1, 0);
      orient(f, new THREE.Vector3(0, 0, -1).add(out), up0);
      f.rotateX(-0.18);
      bodyFeathers.push(f);
    }
  }
}
// head crest
const crest = [];
for (let k = 0; k < 5; k++) {
  const f = makeFeather(bird, mats.crest, 6); f.userData = { k, L: 18 + (k === 2 ? 8 : 0) - Math.abs(k - 2) * 2 };
  crest.push(f);
}

/* ============ wings ============ */
const wings = [];
function buildWing(side) {
  const w = { side, prim: [], sec: [], cov: [[], [], []], j: [0, 1, 2, 3].map(() => new THREE.Vector3()), dir: [0, 1, 2].map(() => new THREE.Vector3()) };
  for (let k = 0; k < 10; k++) w.prim.push(makeFeather(bird, mats.primary, 1));
  for (let k = 0; k < 9; k++) w.sec.push(makeFeather(bird, mats.secondary, 2));
  [10, 9, 8].forEach((n, r) => { for (let k = 0; k < n; k++) w.cov[r].push(makeFeather(bird, mats.covert, 3 + r)); });
  w.tipGlow = { position: new THREE.Vector3(), material: { opacity: 0 } };
  return w;
}
wings.push(buildWing(-1), buildWing(1));
const L1 = 30, L2 = 38, L3 = 34;
const UPH = new THREE.Vector3(0, 1, 0);
const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), back = new THREE.Vector3(), hv = new THREE.Vector3();

function poseWing(w, flap, sweep, time, vel, unfurl) {
  const s = w.side, J = w.j, D = w.dir;
  const a1 = 0.15 + flap, a2 = 0.15 + flap * 0.75 - 0.18 + sweep * 0.2, a3 = 0.1 + flap * 0.45 - 0.35 + sweep * 0.3;
  const sw = sweep * 0.9, sh = (1 - unfurl) * 0.8;                 // sweep back + folded when unfurl < 1
  J[0].set(s * 5, 3.5, 8);
  D[0].set(s * Math.cos(a1) * (1 - sh * 0.6), Math.sin(a1), -0.04 - sw * 0.5 - sh).normalize();
  J[1].copy(J[0]).addScaledVector(D[0], L1 * lerp(0.55, 1, unfurl));
  D[1].set(s * Math.cos(a2) * (1 - sh * 0.8), Math.sin(a2), -0.1 - sw * 0.9 - sh * 1.3).normalize();
  J[2].copy(J[1]).addScaledVector(D[1], L2 * lerp(0.55, 1, unfurl));
  D[2].set(s * Math.cos(a3) * (1 - sh * 0.9), Math.sin(a3), -0.18 - sw * 1.3 - sh * 1.6).normalize();
  J[3].copy(J[2]).addScaledVector(D[2], L3 * lerp(0.5, 1, unfurl));
  w.tipGlow.position.copy(J[3]);

  const lagPitch = cl(-vel * 0.012, -0.5, 0.5);                      // feathers bend against flap velocity
  const grow = unfurl;
  // primaries (hand)
  for (let k = 0; k < 10; k++) {
    const t = k / 9, f = w.prim[k];
    f.position.lerpVectors(J[2], J[3], t * 0.92 + 0.04);
    const beta = lerp(1.25, 0.5, t) + sweep * 0.25 + Math.sin(time * 5.5 + k * 0.7 + (s > 0 ? 1.3 : 0)) * 0.035;
    hv.copy(D[2]); back.set(0, 0, -1);
    tv.copy(hv).multiplyScalar(Math.cos(beta)).addScaledVector(back, Math.sin(beta));
    tv.y += lagPitch * (0.4 + t) + (1 - t) * 0.0;
    orient(f, tv, UPH);
    const L = (64 + 32 * Math.sin(Math.PI * Math.pow(t, 0.8)) + 8 * (1 - t)) * grow;
    f.scale.set(L * 0.27, 1, Math.max(0.01, L));
    f.position.y += 0.15 * k * 0.1;
  }
  // secondaries (forearm)
  for (let k = 0; k < 9; k++) {
    const t = k / 8, f = w.sec[k];
    f.position.lerpVectors(J[1], J[2], t);
    const out = lerp(0.1, 0.55, 1 - t);
    tv.set(s * out, lagPitch * (0.25 + t * 0.5), -1).addScaledVector(D[1], 0.25 + (1 - t) * 0.15).normalize();
    tv.y += Math.sin(time * 4.5 + k * 0.55) * 0.03;
    orient(f, tv, UPH);
    const L = (56 - 5 * t + Math.sin(t * 3) * 2) * grow;
    f.scale.set(L * 0.3, 1, Math.max(0.01, L)); f.position.y -= 0.35;
  }
  // coverts: 3 rows along shoulder→wrist polyline
  const rowL = [36, 26, 18], rowOff = [0.3, 0.7, 1.1];
  for (let r = 0; r < 3; r++) {
    const row = w.cov[r], n = row.length;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), f = row[k], u = t * 2.0;
      const seg = u < 1 ? 0 : 1, lt = u < 1 ? u : u - 1;
      f.position.lerpVectors(seg === 0 ? J[0] : J[1], seg === 0 ? J[1] : J[2], lt);
      if (r === 2 && t > 0.7) f.position.lerp(J[3], (t - 0.7) * 0.6);
      f.position.y += rowOff[r] + 0.3;
      tv.set(s * lerp(0.05, 0.4, t), lagPitch * 0.3, -1).addScaledVector(D[seg], 0.3).normalize();
      tv.y += Math.sin(time * 5 + k * 0.8 + r) * 0.03;
      orient(f, tv, UPH);
      const L = rowL[r] * lerp(1, 0.8, t) * grow;
      f.scale.set(L * 0.36, 1, Math.max(0.01, L));
    }
  }
}

/* ============ tail ribbons (world-space verlet) ============ */
const TAIL_N = 7, TAIL_P = 9;
const tails = [];
for (let j = 0; j < TAIL_N; j++) {
  const c = j - (TAIL_N - 1) / 2, len = 175 - Math.abs(c) * 22, spread = c * 0.2;
  const pts = []; for (let k = 0; k < TAIL_P; k++) pts.push({ x: 0, y: 0, px: 0, py: 0, init: false });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_P * 2 * 3), 3));
  const uv = []; for (let k = 0; k < TAIL_P; k++) { const v = k / (TAIL_P - 1); uv.push(0, v, 1, v); }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nrm = []; for (let k = 0; k < TAIL_P * 2; k++) nrm.push(0, 0, 1);
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  const id = []; for (let k = 0; k < TAIL_P - 1; k++) { const a = k * 2; id.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(id);
  const mesh = new THREE.Mesh(geo, mats.tail); mesh.frustumCulled = false; mesh.renderOrder = 0; scene.add(mesh);
  tails.push({ pts, geo, mesh, len, spread, seg: len / (TAIL_P - 1), phase: j * 0.9 });
}
function updateTails(rootX, rootY, hx, hy, dt, time, speedS, grow) {
  for (const t of tails) {
    const bx = -hx, by = -hy;                                          // back direction (world, y up)
    const ca = Math.cos(t.spread), sa = Math.sin(t.spread);
    const rdx = bx * ca - by * sa, rdy = bx * sa + by * ca;
    const rl = bx * 0.0, lat = (t.spread * 14) * grow;
    const P = t.pts; const sg = t.seg * grow;
    P[0].x = rootX - hy * 0 + (-hy) * lat * -0.0 + rdx * 2; P[0].y = rootY + rdy * 2;
    for (let k = 1; k < TAIL_P; k++) {
      const p = P[k];
      if (!p.init) { p.x = p.px = P[0].x + rdx * sg * k; p.y = p.py = P[0].y + rdy * sg * k; p.init = true; }
      const vx = (p.x - p.px) * 0.93, vy = (p.y - p.py) * 0.93;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy;
      const tx = P[0].x + rdx * sg * k + (-rdy) * Math.sin(time * 2.6 + t.phase - k * 0.55) * (2 + k * 0.9) * (1 + speedS * 0.5);
      const ty = P[0].y + rdy * sg * k + (rdx) * Math.sin(time * 2.6 + t.phase - k * 0.55) * (2 + k * 0.9) * (1 + speedS * 0.5);
      const pull = 0.05 + 0.07 * (1 - k / TAIL_P);
      p.x += (tx - p.x) * pull; p.y += (ty - p.y) * pull;
      for (let it = 0; it < 2; it++) {
        const q = P[k - 1]; let dx = p.x - q.x, dy = p.y - q.y; const d = Math.hypot(dx, dy) || 1;
        p.x = q.x + dx / d * sg; p.y = q.y + dy / d * sg;
      }
    }
    const a = t.geo.attributes.position.array;
    for (let k = 0; k < TAIL_P; k++) {
      const p = P[k], q = P[Math.min(k + 1, TAIL_P - 1)], o = P[Math.max(k - 1, 0)];
      let dx = o.x - q.x, dy = o.y - q.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const v = k / (TAIL_P - 1), w = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(Math.max(v, 0.001), 0.62)), 0.7) * (9 + t.len * 0.09) * grow + 0.01;
      a[k * 6] = p.x - dy * w; a[k * 6 + 1] = p.y + dx * w; a[k * 6 + 2] = -2 - k * 0.3;
      a[k * 6 + 3] = p.x + dy * w; a[k * 6 + 4] = p.y - dx * w; a[k * 6 + 5] = -2 - k * 0.3;
    }
    t.geo.attributes.position.needsUpdate = true;
  }
}

/* ============ ice crystals (instanced) ============ */
const NC = 80;
const crystalMat = new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x2ab0ff, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.88 });
const crystals = new THREE.InstancedMesh(octGeo, crystalMat, NC); crystals.frustumCulled = false; scene.add(crystals);
const cs = []; for (let i = 0; i < NC; i++) cs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0, life: 0, max: 1, size: 0 });
const dummy = new THREE.Object3D(), tmpCol = new THREE.Color();
let cc = 0;
function spawnCrystal(x, y, z, vx, vy, vz, size, life) {
  const c = cs[cc]; cc = (cc + 1) % NC;
  Object.assign(c, { x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, sx: (Math.random() - 0.5) * 4, sy: (Math.random() - 0.5) * 4, sz: (Math.random() - 0.5) * 4, life: 1, max: life, size });
}
for (let i = 0; i < NC; i++) { tmpCol.setHSL(0.53 + Math.random() * 0.1, 0.9, 0.7 + Math.random() * 0.2); crystals.setColorAt(i, tmpCol); }

/* ============ sparkle particles ============ */
const MAXP = 700;
const pPos = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP).fill(1), pSize = new Float32Array(MAXP);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
particleMat = new THREE.ShaderMaterial({
  uniforms: { uPR: { value: 1 }, uDist: { value: 1000 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aSize; attribute float aLife; varying float vLife; uniform float uPR; uniform float uDist;
    void main(){ vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPR * (uDist / -mv.z) * (0.35 + aLife * 0.65); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vLife;
    void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
      float star = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.2) + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
      float a = smoothstep(0.5, 0.0, d); a = a * a + star * 0.8;
      vec3 col = mix(vec3(0.15, 0.4, 1.0), vec3(0.8, 0.97, 1.0), vLife);
      gl_FragColor = vec4(col, a * vLife); }`
});
const points = new THREE.Points(pGeo, particleMat); points.frustumCulled = false; scene.add(points);
let pCur = 0;
function spawn(x, y, z, vx, vy, vz, life, size) {
  const i = pCur, j = i * 3; pCur = (pCur + 1) % MAXP;
  pPos[j] = x; pPos[j + 1] = y; pPos[j + 2] = z; pVel[j] = vx; pVel[j + 1] = vy; pVel[j + 2] = vz; pMax[i] = life; pLife[i] = 1; pSize[i] = size;
}
const ring = glowSprite(0x9fe6ff, 0, ringTex); ring.scale.setScalar(1); scene.add(ring);
let ringT = 9;

/* ============ input ============ */
const ptr = { x: 0, y: 0 };
let lastMove = 0, time = 0;
function nova(x, y) {
  ringT = 0; ring.position.set(x, y, 0);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + Math.random() * 0.2, s = 120 + Math.random() * 160; spawnCrystal(x, y, 0, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 60, 6 + Math.random() * 7, 1.6 + Math.random() * 0.9); }
  for (let i = 0; i < 90; i++) { const a = Math.random() * 6.283, s = 60 + Math.random() * 260; spawn(x, y, 0, Math.cos(a) * s, Math.sin(a) * s, 0, 0.8 + Math.random() * 0.9, 6 + Math.random() * 10); }
}
let flapBoost = 0;
window.addEventListener('pointermove', e => { if (!DEMO) { ptr.x = e.clientX; ptr.y = e.clientY; lastMove = time; } }, { passive: true });
window.addEventListener('pointerdown', e => { if (!DEMO) { ptr.x = e.clientX; ptr.y = e.clientY; lastMove = time; flapBoost = 1; nova(hp.x, -hp.y); } }, { passive: true });
window.addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') toggleFS(); });
window.addEventListener('dblclick', toggleFS);
function toggleFS() { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen && document.exitFullscreen(); }

/* ============ demo path ============ */
function pathA(t) { const u = t - 3, k = sm(cl(u / 1.2, 0, 1)); return [0.5 + 0.30 * Math.sin(u * 1.3) * k, 0.5 + 0.20 * Math.sin(u * 2.6) * k]; }
const WP = [[0.15, 0.25], [0.85, 0.30], [0.2, 0.78], [0.82, 0.72]];
function pathB(t, st) { const pts = [st, ...WP], u = cl((t - 7) / 4, 0, 1) * (pts.length - 1), i = Math.min(Math.floor(u), pts.length - 2), f = sm(u - i); return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; }
function demoPointer(t) {
  const bEnd = WP[WP.length - 1]; let p;
  if (t < 3) p = [0.5, 0.5]; else if (t < 7) p = pathA(t); else if (t < 11) p = pathB(t, pathA(7));
  else { const u = cl((t - 11) / 2.4, 0, 1), e = sm(u), th = u * Math.PI * 3, r = 0.3 * Math.sin(Math.PI * u); p = [bEnd[0] + (0.5 - bEnd[0]) * e + Math.cos(th) * r * 0.9, bEnd[1] + (0.5 - bEnd[1]) * e + Math.sin(th) * r * 0.9]; }
  return [p[0] * W, p[1] * H];
}

/* ============ state / frame ============ */
const hp = { x: 0, y: 0, vx: 0, vy: 0 };
let idleBlend = 0, speedS = 0, flapPhase = 0, prevFlap = 0, flapVel = 0, bank = 0, prevAng = 0, angVel = 0;
const headDir = new THREE.Vector3(1, 0, 0), tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
let last = performance.now(), rafId = 0, recorder = null, recChunks = [], recDone = false, emitAcc = 0, crystalAcc = 0, introDone = false, novaA = false, novaB = false;

function startRecording() {
  if (!RECORD || !window.MediaRecorder || !canvas.captureStream) return;
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  recorder = new MediaRecorder(canvas.captureStream(60), { mimeType: mime, videoBitsPerSecond: 14e6 });
  recorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(recChunks, { type: 'video/webm' })); a.download = 'ice_phoenix_preview.webm'; a.click(); };
  recorder.start();
}
function init() {
  initComposer(); resize();
  ptr.x = W / 2; ptr.y = H / 2; hp.x = ptr.x; hp.y = ptr.y;
  if (window.__PHOENIX_TIME !== undefined) time = window.__PHOENIX_TIME;
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  if (dt <= 0) return;
  if (SEEK) { dt = 1 / 60; for (let n = 0; n < 20 && time < SEEK; n++) update(dt); }
  update(dt);
  renderFX();
}
function update(dt) {
  time += dt;

  if (DEMO) {
    const [dx, dy] = demoPointer(Math.min(time, DEMO_LEN));
    if (Math.hypot(dx - ptr.x, dy - ptr.y) > 0.6) lastMove = time;
    ptr.x = dx; ptr.y = dy;
    if (!novaA && time > 9.2) { novaA = true; flapBoost = 1; nova(hp.x, -hp.y); }
    if (!novaB && time > 12.9) { novaB = true; flapBoost = 1; nova(hp.x, -hp.y); }
    if (RECORD && !recorder && !recDone) startRecording();
    if (RECORD && recorder && time >= DEMO_LEN && !recDone) { recDone = true; recorder.stop(); }
  }
  flapBoost = Math.max(0, flapBoost - dt * 1.2);

  idleBlend += (((time - lastMove) > 0.7 ? 1 : 0) - idleBlend) * (1 - Math.exp(-2.5 * dt));

  // spring to pointer
  const a = time * 0.75;
  const tx = ptr.x + 22 + Math.cos(a) * 70 * idleBlend, ty = ptr.y + 18 + Math.sin(a * 2) * 40 * idleBlend;
  hp.vx += ((tx - hp.x) * 70 - hp.vx * 13) * dt; hp.vy += ((ty - hp.y) * 70 - hp.vy * 13) * dt;
  hp.x += hp.vx * dt; hp.y += hp.vy * dt;
  const speed = Math.hypot(hp.vx, hp.vy);
  speedS += (cl(speed / 800, 0, 1) - speedS) * (1 - Math.exp(-5 * dt));

  // heading + banking
  if (speed > 25) tgt.set(hp.vx, -hp.vy, 0).normalize(); else tgt.copy(headDir);
  headDir.lerp(tgt, 1 - Math.exp(-(speed > 25 ? 8 : 2) * dt)).normalize();
  const ang = Math.atan2(headDir.y, headDir.x);
  let dAng = ang - prevAng; if (dAng > Math.PI) dAng -= 6.283; if (dAng < -Math.PI) dAng += 6.283; prevAng = ang;
  angVel += (dAng / dt - angVel) * (1 - Math.exp(-8 * dt));
  bank += (cl(angVel * 0.12, -0.7, 0.7) - bank) * (1 - Math.exp(-6 * dt));

  // intro
  const intro = cl(time / 2.6, 0, 1), grow = easeOutBack(cl(intro * 1.2, 0, 1)), unfurl = sm(cl((time - 0.4) / 2.0, 0, 1));
  if (!introDone && time > 0.05) { introDone = true; nova(hp.x, -hp.y); }

  // placement
  bird.position.set(hp.x, -hp.y, 0);
  bird.scale.setScalar(Math.max(0.0001, SCALE * Math.min(grow, 1.08)));
  tmp.copy(bird.position).add(headDir); bird.lookAt(tmp); bird.rotateZ(bank);
  bird.position.y += Math.sin(time * 2.2) * 2 * (0.3 + idleBlend);

  // flap
  const fFreq = 2.1 + speedS * 1.6 + flapBoost * 1.2 - idleBlend * 0.15;
  flapPhase += dt * fFreq * Math.PI * 2;
  const fAmp = lerp(0.78, 0.42, speedS) + flapBoost * 0.25;
  const flap = Math.sin(flapPhase) * fAmp + 0.12;
  flapVel += ((flap - prevFlap) / dt - flapVel) * (1 - Math.exp(-20 * dt)); prevFlap = flap;
  const sweep = speedS * 0.65 + (1 - unfurl) * 0.2;
  for (const w of wings) poseWing(w, flap, sweep, time, flapVel, unfurl);

  // breathing / head
  const br = 1 + Math.sin(time * 2.2) * 0.02; chest.scale.set(8.5 * br, 7.5 * br, 11);
  head.rotation.y = Math.sin(time * 0.9) * 0.18 * (0.4 + idleBlend); head.rotation.x = Math.sin(time * 1.3) * 0.06;
  for (const f of crest) {
    const { k, L } = f.userData, s = (k - 2) / 2;
    f.position.set(s * 1.6, 8.6, 21.5 - Math.abs(s) * 0.5);
    tv.set(s * 0.45 + Math.sin(time * 3 + k) * 0.06, 0.45 + (1 - Math.abs(s)) * 0.15 - speedS * 0.15, -1).normalize();
    orient(f, tv, UPH); f.scale.set(L * 0.22, 1, L * Math.max(0, grow));
  }
  gem.rotation.y = time * 1.2; gemGlow.material.opacity = 0.65 + 0.3 * Math.sin(time * 3);
  bodyGlow.material.opacity = 0.16 + 0.06 * Math.sin(time * 2) + speedS * 0.12;
  for (const w of wings) w.tipGlow.material.opacity = 0.35 + 0.25 * Math.sin(time * 3 + w.side) + speedS * 0.25;

  // tail
  const hx = headDir.x, hy = headDir.y;
  tmp.set(0, 0.2, -17); bird.updateMatrixWorld(true); bird.localToWorld(tmp);
  updateTails(tmp.x, tmp.y, hx, hy, dt, time, speedS, Math.min(grow, 1));
  for (const k in mats) mats[k].uniforms.uTime.value = time;

  auraLight.position.set(bird.position.x, bird.position.y, 90);

  // particles + crystals
  emitAcc += dt * (28 + speedS * 220);
  while (emitAcc > 1) {
    emitAcc -= 1; const w = wings[Math.random() < 0.5 ? 0 : 1];
    tv.copy(w.j[3]).lerp(w.j[1], Math.random() * 0.9); bird.localToWorld(tv);
    spawn(tv.x, tv.y, tv.z, (Math.random() - 0.5) * 50 - hp.vx * 0.05, (Math.random() - 0.5) * 50 + hp.vy * 0.05 - 14, (Math.random() - 0.5) * 30, 0.7 + Math.random() * 1.1, 4 + Math.random() * 8);
  }
  crystalAcc += dt * (5 + speedS * 22);
  while (crystalAcc > 1) {
    crystalAcc -= 1; const t = tails[Math.floor(Math.random() * TAIL_N)], p = t.pts[2 + Math.floor(Math.random() * (TAIL_P - 3))];
    spawnCrystal(p.x, p.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40 - hp.vx * 0.03, (Math.random() - 0.5) * 40 + hp.vy * 0.03 - 10, (Math.random() - 0.5) * 20, 4 + Math.random() * 5, 1.4 + Math.random() * 1.4);
  }
  for (let i = 0; i < MAXP; i++) {
    if (pLife[i] <= 0) { pSize[i] = 0; continue; }
    pLife[i] -= dt / pMax[i]; if (pLife[i] < 0) pLife[i] = 0;
    const k = i * 3, d = Math.exp(-1.4 * dt);
    pVel[k] = pVel[k] * d + Math.sin(pPos[k + 1] * 0.06 + time * 3 + i) * 30 * dt; pVel[k + 1] = pVel[k + 1] * d - 10 * dt; pVel[k + 2] *= d;
    pPos[k] += pVel[k] * dt; pPos[k + 1] += pVel[k + 1] * dt; pPos[k + 2] += pVel[k + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aLife.needsUpdate = true; pGeo.attributes.aSize.needsUpdate = true;

  for (let i = 0; i < NC; i++) {
    const c = cs[i];
    if (c.life <= 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); crystals.setMatrixAt(i, dummy.matrix); continue; }
    c.life -= dt / c.max; const d = Math.exp(-1.2 * dt);
    c.vx *= d; c.vy = c.vy * d - 8 * dt; c.vz *= d; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    c.rx += c.sx * dt; c.ry += c.sy * dt; c.rz += c.sz * dt;
    const s = c.size * Math.min(1, c.life * 3) * Math.min(1, (1 - c.life) * 6 + 0.2);
    dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.rx, c.ry, c.rz); dummy.scale.set(s, s, s); dummy.updateMatrix(); crystals.setMatrixAt(i, dummy.matrix);
  }
  crystals.instanceMatrix.needsUpdate = true;

  if (ringT < 1.2) { ringT += dt; const u = ringT / 1.2; ring.scale.setScalar(30 + u * 420); ring.material.opacity = (1 - u) * (1 - u) * 0.9; } else ring.material.opacity = 0;

}

function dispose() {
  cancelAnimationFrame(rafId);
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
  glowTex.dispose(); ringTex.dispose(); [sceneRT, ...rtA, ...rtB].forEach(t => t && t.dispose()); [brightMat, blurMat, compMat].forEach(m => m && m.dispose()); renderer.dispose();
}
window.addEventListener('pagehide', dispose);
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { last = performance.now(); });
init();
if (params.has('manual')) { window.__tick = dt => { update(dt / 2); update(dt / 2); renderFX(); return time; }; }
else rafId = requestAnimationFrame(frame);
})();
