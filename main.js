import * as THREE from "three";

/* ---------- tiny spring tween ---------- */
const springs = [];
function spring(obj, key, to, { stiffness = 60, damping = 11 } = {}) {
  let s = springs.find((e) => e.obj === obj && e.key === key);
  if (!s) { s = { obj, key, v: 0 }; springs.push(s); }
  s.to = to; s.stiffness = stiffness; s.damping = damping;
}
function stepSprings(dt) {
  for (let i = springs.length - 1; i >= 0; i--) {
    const s = springs[i];
    const x = s.obj[s.key];
    const F = -s.stiffness * (x - s.to) - s.damping * s.v;
    s.v += F * dt;
    s.obj[s.key] = x + s.v * dt;
    if (Math.abs(s.v) < 0.0004 && Math.abs(s.obj[s.key] - s.to) < 0.0004) {
      s.obj[s.key] = s.to; springs.splice(i, 1);
    }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (c, target, t) => { c.r = lerp(c.r, target.r, t); c.g = lerp(c.g, target.g, t); c.b = lerp(c.b, target.b, t); };

/* ---------- renderer ---------- */
const canvas = document.getElementById("rock");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);
/* the viewer stands in the desert; yaw 0 faces the rock (north) */
const HOME = new THREE.Vector3(0, 0.4, 10);
camera.position.copy(HOME);
scene.fog = new THREE.FogExp2(0xf6bd97, 0.012);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.75 ? 62 : 55;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ---------- sky (view-locked, works at every azimuth) ---------- */
const skyMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { top: { value: new THREE.Color("#ffe8d6") }, bottom: { value: new THREE.Color("#f9c39a") } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.15, 0.85, vUv.y)), 1.0); }",
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

/* ---------- sun / moon: fixed compass bearing, billboarded ---------- */
const sunMat = new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 1, side: THREE.DoubleSide, fog: false });
const sun = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), sunMat);
sun.position.set(-8, 9.7, -52);
scene.add(sun);
const haloMat = new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 0.28, side: THREE.DoubleSide, fog: false });
const halo = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), haloMat);
halo.position.copy(sun.position);
scene.add(halo);

/* ---------- the monolith: extruded, so it has a back and sides ---------- */
function rockShape() {
  const s = new THREE.Shape();
  s.moveTo(-34, -30);
  s.lineTo(-34, -4.2);
  s.bezierCurveTo(-33, -1.5, -29, 0.6, -24, 1.5);
  s.bezierCurveTo(-18, 2.6, -10, 3.4, -2, 3.5);
  s.bezierCurveTo(6, 3.6, 14, 3.0, 20, 2.0);
  s.bezierCurveTo(26, 1.0, 31, -0.8, 33, -3.0);
  s.lineTo(34, -30);
  s.closePath();
  return s;
}
const ROCK_DEPTH = 15;
const rockGeo = new THREE.ExtrudeGeometry(rockShape(), {
  depth: ROCK_DEPTH, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.8, bevelSegments: 5, curveSegments: 24,
});
const rock = new THREE.Mesh(rockGeo, new THREE.MeshBasicMaterial({ color: "#a4553f" }));
rock.position.set(0, 0, -34 - ROCK_DEPTH / 2);
scene.add(rock);

/* ---------- desert floor: a full disc under every azimuth ---------- */
const floorMat = new THREE.MeshBasicMaterial({ color: "#c98a5f" });
const floor = new THREE.Mesh(new THREE.CircleGeometry(120, 48), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -6.2;
scene.add(floor);

/* ---------- dune horizon: a wavy ring, no void at any bearing ---------- */
function duneRing(rIn, rOut, base, amp, freq, phase, segs = 128) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const h = base + Math.sin(a * freq + phase) * amp + Math.sin(a * freq * 2.3 + phase * 1.7) * amp * 0.4;
    pos.push(Math.cos(a) * rIn, -30, Math.sin(a) * rIn);
    pos.push(Math.cos(a) * rIn, h, Math.sin(a) * rIn);
    pos.push(Math.cos(a) * rOut, h * 0.92, Math.sin(a) * rOut);
    pos.push(Math.cos(a) * rOut, -30, Math.sin(a) * rOut);
  }
  for (let i = 0; i < segs; i++) {
    const b = i * 4;
    idx.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);       // inner wall
    idx.push(b + 1, b + 2, b + 5, b + 2, b + 6, b + 5);   // crest
    idx.push(b + 2, b + 3, b + 6, b + 3, b + 7, b + 6);   // outer wall
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const dunesMat = new THREE.MeshBasicMaterial({ color: "#d99a6c", side: THREE.DoubleSide });
const dunes = new THREE.Mesh(duneRing(56, 78, -4.4, 0.55, 7, 1.0), dunesMat);
scene.add(dunes);

/* ---------- Kata Tjuta: real domes to the west-north-west ---------- */
const kataMat = new THREE.MeshBasicMaterial({ color: "#c08a76", transparent: true, opacity: 0.75 });
const kata = new THREE.Group();
{
  const domes = [[0, 0, 0, 9, 4.6], [-11, 0, 3, 6.5, 3.6], [9, 0, 4, 7.5, 4.1], [-4, 0, 8, 5, 3.0], [16, 0, -2, 5.5, 3.2]];
  for (const [x, y, z, r, h] of domes) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), kataMat);
    d.scale.y = h / r;
    d.position.set(x, -6.2, z);
    kata.add(d);
  }
  kata.position.set(-42, 0, -20);
}
scene.add(kata);

/* ---------- mid-plain dune swales: concentric rings, true from every bearing ---------- */
const ridgeMat = new THREE.MeshBasicMaterial({ color: "#d99a6c", side: THREE.DoubleSide });
const swales = new THREE.Group();
{
  const r0 = new THREE.Mesh(duneRing(28, 33, -5.2, 0.5, 5, 1.0), ridgeMat);   // passes at the rock's foot
  const r1 = new THREE.Mesh(duneRing(38, 44, -4.9, 0.65, 6, 3.2), ridgeMat);
  const r2 = new THREE.Mesh(duneRing(47, 53, -4.7, 0.6, 8, 5.0), ridgeMat);
  swales.add(r0, r1, r2);
}
scene.add(swales);

/* ---------- spinifex tufts: crossed blades, scattered on all sides ---------- */
const spiniMat = new THREE.MeshBasicMaterial({ color: "#c8a24f", transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const spinifex = new THREE.Group();
const spiniList = [];
{
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const a = i < 12 ? Math.PI * 1.5 + (rnd() - 0.5) * 1.9 : rnd() * Math.PI * 2;
    const r = 5 + rnd() * 17;
    const g = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.85), spiniMat);
      blade.rotation.z = (b - 1) * 0.5;
      blade.rotation.y = b * 1.05;
      blade.position.y = 0.35;
      g.add(blade);
    }
    g.position.set(Math.cos(a) * r, -6.2, 10 + Math.sin(a) * r);
    g.scale.setScalar(0.8 + rnd() * 0.6);
    spinifex.add(g);
    spiniList.push({ g, phase: rnd() * 6 });
  }
}
scene.add(spinifex);

/* ---------- desert oaks: slim dark silhouettes around the compass ---------- */
const oakMat = new THREE.MeshBasicMaterial({ color: "#5c4632", transparent: true, opacity: 0.8, side: THREE.DoubleSide });
{
  for (const [x, z, sc] of [[-22, -19, 1.1], [24, -19, 0.9], [-20, 30, 1.0], [36, 22, 0.85], [-44, 4, 1.15], [14, 48, 0.95]]) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.2), oakMat);
    trunk.position.y = 1.0;
    g.add(trunk);
    const trunk2 = trunk.clone(); trunk2.rotation.y = Math.PI / 2; g.add(trunk2);
    const canopy = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), oakMat);
    canopy.scale.set(0.8, 1.5, 1);
    canopy.position.y = 2.4;
    g.add(canopy);
    const canopy2 = canopy.clone(); canopy2.rotation.y = Math.PI / 2; g.add(canopy2);
    g.position.set(x, -6.2, z);
    g.scale.setScalar(sc);
    scene.add(g);
  }
}

/* ---------- low desert stones: quiet anchors at every bearing ---------- */
const stoneMat = new THREE.MeshBasicMaterial({ color: "#8a5a40" });
{
  let seed = 29;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 8 + rnd() * 22;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rnd() * 0.9, 10, 7), stoneMat);
    s.scale.y = 0.45;
    s.position.set(Math.cos(a) * r, -6.2, 10 + Math.sin(a) * r);
    scene.add(s);
  }
}

/* ---------- heat shimmer lines (midday only), billboarded ---------- */
const shimMat = new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 0, side: THREE.DoubleSide });
const shimmers = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(26 - i * 5, 0.055), shimMat);
  const a = -0.5 + i * 0.45;
  m.position.set(Math.sin(a) * 24, -3.6 + i * 0.45, 10 - Math.cos(a) * 24);
  scene.add(m);
  shimmers.push({ m, phase: i * 1.7 });
}

/* soft round sprite for every point light */
function glowSprite() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = glowSprite();

/* ---------- stars: a full dome, not a sheet ---------- */
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 480; i++) {
    const a = Math.random() * Math.PI * 2;
    const el = 0.08 + Math.random() * 1.35;
    const r = 95;
    pts.push(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r - 4, Math.sin(a) * Math.cos(el) * r);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const starMat = new THREE.PointsMaterial({ color: "#fff7e6", size: 0.22, map: glowTex, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false });
scene.add(new THREE.Points(starGeo, starMat));

/* ---------- field of light: bulbs across the plain in every direction ---------- */
const bulbGeo = new THREE.BufferGeometry();
{
  const pts = [], cols = [];
  const palette = [[1.0, 0.85, 0.6], [1.0, 0.65, 0.65], [0.7, 0.8, 1.0], [1.0, 0.95, 0.75], [0.9, 0.7, 1.0]];
  let seed = 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 2.5 + rnd() * rnd() * 38;
    pts.push(Math.cos(a) * r, -6.0 + rnd() * 1.4, 10 + Math.sin(a) * r);
    const c = palette[i % palette.length];
    cols.push(c[0], c[1], c[2]);
  }
  bulbGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  bulbGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
}
const bulbMat = new THREE.PointsMaterial({ size: 0.24, vertexColors: true, map: glowTex, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
scene.add(new THREE.Points(bulbGeo, bulbMat));

/* planted bulbs (night tap): real points on the ground, wherever you look */
const planted = [];
const bulbPalette = ["#ffd9a0", "#ff9d9d", "#b3ccff", "#fff2c0", "#e0b3ff"];
function plantBulb(x, y, z) {
  if (planted.length >= 60) { const old = planted.shift(); scene.remove(old.m); }
  const c = new THREE.Color(bulbPalette[planted.length % bulbPalette.length]);
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.scale.setScalar(0.01);
  scene.add(m);
  planted.push({ m, phase: Math.random() * 6 });
  spring(m.scale, "x", 1, { stiffness: 90, damping: 8 });
  spring(m.scale, "y", 1, { stiffness: 90, damping: 8 });
}

/* ---------- dust motes, drifting through the air around you ---------- */
const moteGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 120; i++) {
    let x = (Math.random() - 0.5) * 60, z = 10 + (Math.random() - 0.5) * 60;
    if (Math.hypot(x, z - 10) < 6) { x = x < 0 ? x - 8 : x + 8; }
    pts.push(x, (Math.random() - 0.5) * 14 - 1, z);
  }
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const moteMat = new THREE.PointsMaterial({ color: "#ffe0b8", size: 0.13, map: glowTex, transparent: true, opacity: 0.32, sizeAttenuation: true, depthWrite: false });
scene.add(new THREE.Points(moteGeo, moteMat));

/* ---------- tap effects: dawn bloom, heat ring, ember burst ---------- */
const fx = [];
function bloom(p) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(p);
  scene.add(m);
  fx.push({ m, t: 0, kind: "bloom" });
}
function heatRing(p) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 48),
    new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  m.position.copy(p);
  m.userData.flat = 0.28;
  scene.add(m);
  fx.push({ m, t: 0, kind: "ring" });
}
function embers(p) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffb45e" : "#ff8b4a", transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(p);
    scene.add(m);
    fx.push({ m, t: 0, kind: "ember", vx: (Math.random() - 0.5) * 3.2, vy: 1.6 + Math.random() * 2.4 });
  }
}

/* ---------- chapters: one day over the rock ---------- */
const CHAPTERS = [
  { skyTop: "#ffe8d6", skyBot: "#f9c39a", fog: ["#f6bd97", 0.012], rock: "#a4553f", kata: "#c08a76", dunes: "#d99a6c", floor: "#c98a5f",
    sun: [-8, 9.7], sunC: "#ffcf9e", sunO: 1, haloO: 0.28, stars: 0, shimmer: 0, bulbs: 0, motes: ["#ffe0b8", 0.32], spini: "#c8a24f", night: false,
    caption: "The rock wakes in blush.", whisper: "Six hundred million years old." },
  { skyTop: "#bfe0ee", skyBot: "#f0e2c0", fog: ["#ecd9b4", 0.010], rock: "#b3402a", kata: "#c96f4e", dunes: "#d98e52", floor: "#cf8350",
    sun: [0, 12.6], sunC: "#fff3d0", sunO: 1, haloO: 0.2, stars: 0, shimmer: 1, bulbs: 0, motes: ["#fff2d8", 0.3], spini: "#d4b25c", night: false,
    caption: "Red centre, red heart.", whisper: "" },
  { skyTop: "#8e4160", skyBot: "#ff8b4a", fog: ["#e0745a", 0.014], rock: "#e0562f", kata: "#a04a3a", dunes: "#b35c3a", floor: "#9c4f33",
    sun: [11.5, 4.6], sunC: "#ffb45e", sunO: 1, haloO: 0.4, stars: 0, shimmer: 0, bulbs: 0, motes: ["#ffc890", 0.36], spini: "#a8763a", night: false,
    caption: "Every evening, it catches fire.", whisper: "" },
  { skyTop: "#0b1026", skyBot: "#1c2340", fog: ["#141a33", 0.024], rock: "#221733", kata: "#1c1428", dunes: "#191428", floor: "#171225",
    sun: [9, 9.4], sunC: "#e8e4d8", sunO: 0.85, haloO: 0.12, stars: 1, shimmer: 0, bulbs: 1, motes: ["#c8c0b0", 0.16], spini: "#2c2440", night: true,
    caption: "Fifty thousand lights bloom in the dark.", whisper: "Sacred Anangu land - seen, never climbed." },
];
let chapter = 0;
const target = {
  skyTop: new THREE.Color(CHAPTERS[0].skyTop), skyBot: new THREE.Color(CHAPTERS[0].skyBot),
  fog: new THREE.Color(CHAPTERS[0].fog[0]), rock: new THREE.Color(CHAPTERS[0].rock),
  kata: new THREE.Color(CHAPTERS[0].kata), dunes: new THREE.Color(CHAPTERS[0].dunes), floor: new THREE.Color(CHAPTERS[0].floor),
  sunC: new THREE.Color(CHAPTERS[0].sunC), motes: new THREE.Color(CHAPTERS[0].motes[0]), spini: new THREE.Color(CHAPTERS[0].spini),
  fogN: CHAPTERS[0].fog[1], sunX: CHAPTERS[0].sun[0], sunY: CHAPTERS[0].sun[1],
  sunO: 1, haloO: 0.28, stars: 0, shimmer: 0, bulbs: 0, motesO: 0.32,
};

/* ---------- chrome ---------- */
const veil = document.getElementById("veil");
const caption = document.getElementById("caption");
const whisper = document.getElementById("whisper");
const chrome = [...document.querySelectorAll(".chrome")];
const stops = [...document.querySelectorAll(".stop")];
let idleTimer, whisperTimer, cueTimer, cueFirst;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function wakeChrome() {
  chrome.forEach((c) => c.classList.remove("idle"));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    /* never fade chrome out from under someone using it */
    if (chrome.some((c) => c.contains(document.activeElement))) { wakeChrome(); return; }
    chrome.forEach((c) => c.classList.add("idle"));
  }, 4200);
}
chrome.forEach((c) => {
  c.addEventListener("focusin", wakeChrome);
  c.addEventListener("focusout", wakeChrome);
});
/* bearings are relative to the viewer's current gaze, so cues happen where you look */
function gazePoint(dist, spread, yMin, yMax) {
  const a = yaw + (Math.random() - 0.5) * spread;
  return new THREE.Vector3(
    camera.position.x - Math.sin(a) * dist,
    yMin + Math.random() * (yMax - yMin),
    camera.position.z - Math.cos(a) * dist
  );
}
function startCue(i) {
  clearTimeout(cueFirst); clearInterval(cueTimer);
  if (reduceMotion) return;
  if (i === 0) { /* dawn: a soft bloom wakes on the rock face */
    const rockBloom = () => {
      const a = (Math.random() - 0.5) * 0.9;
      bloom(new THREE.Vector3(Math.sin(a) * 26, -0.5 + Math.random() * 3, -34 + ROCK_DEPTH / 2 + 3.4));
    };
    cueFirst = setTimeout(rockBloom, 3000);
    cueTimer = setInterval(rockBloom, 7000);
  } else if (i === 1) { /* midday: a heat ring rises through the shimmer */
    const ring = () => { const p = gazePoint(22, 0.7, -2.4, -1.4); heatRing(p); };
    cueFirst = setTimeout(ring, 3200);
    cueTimer = setInterval(ring, 8000);
  } else if (i === 2) { /* sunset: a small scatter of embers drifts up */
    const emb = () => { const p = gazePoint(15, 0.7, 1.2, 4.2); embers(p); };
    cueFirst = setTimeout(emb, 3000);
    cueTimer = setInterval(emb, 7000);
  } else if (i === 3) { /* night: a new light plants itself in the field */
    const plant = () => { const p = gazePoint(9 + Math.random() * 8, 0.8, -6.0, -6.0); plantBulb(p.x, -5.9 + Math.random() * 1.2, p.z); };
    cueFirst = setTimeout(plant, 3400);
    cueTimer = setInterval(plant, 9000);
  }
}
function setChapter(i) {
  if (i === chapter) return;
  chapter = i;
  const c = CHAPTERS[i];
  target.skyTop.set(c.skyTop); target.skyBot.set(c.skyBot); target.fog.set(c.fog[0]);
  target.rock.set(c.rock); target.kata.set(c.kata); target.dunes.set(c.dunes); target.floor.set(c.floor);
  target.sunC.set(c.sunC); target.motes.set(c.motes[0]); target.spini.set(c.spini);
  target.fogN = c.fog[1]; target.sunX = c.sun[0]; target.sunY = c.sun[1];
  target.sunO = c.sunO; target.haloO = c.haloO; target.stars = c.stars;
  target.shimmer = c.shimmer; target.bulbs = c.bulbs; target.motesO = c.motes[1];
  document.body.classList.toggle("night", c.night);
  stops.forEach((d, j) => d.classList.toggle("active", j === i));
  caption.classList.remove("show"); whisper.classList.remove("show");
  clearTimeout(whisperTimer);
  startCue(i);
  setTimeout(() => { caption.textContent = c.caption; caption.classList.add("show"); }, 1100);
  if (c.whisper) whisperTimer = setTimeout(() => { whisper.textContent = c.whisper; whisper.classList.add("show"); }, 3200);
  wakeChrome();
}
stops.forEach((d, i) => d.addEventListener("click", () => setChapter(i)));

/* ---------- home: a deliberate way back, never a forced one ---------- */
const homeBtn = document.getElementById("home");
let returningHome = false, homeWasShown = false;
homeBtn.addEventListener("click", () => {
  yawVel = 0; pitchVel = 0;
  lastTouch = performance.now();
  if (reduceMotion) {
    yaw = Math.round(yaw / (Math.PI * 2)) * (Math.PI * 2); pitch = 0;
  } else {
    returningHome = true;
  }
  wakeChrome();
});

/* ---------- dial gestures: swipe to change moment, arrows to step ---------- */
const dial = document.getElementById("dial");
let dialDownX = 0, dialDownY = 0, dialSwiping = false, dialGestureId = null, suppressDialClick = false;
dial.addEventListener("pointerdown", (e) => {
  dialDownX = e.clientX; dialDownY = e.clientY; dialSwiping = false; dialGestureId = e.pointerId;
});
dial.addEventListener("pointermove", (e) => {
  if (dialGestureId !== e.pointerId) return;
  const dx = e.clientX - dialDownX, dy = e.clientY - dialDownY;
  if (!dialSwiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
    dialSwiping = true;
    try { dial.setPointerCapture(e.pointerId); } catch (_) {}
  }
});
dial.addEventListener("pointerup", (e) => {
  if (dialGestureId !== e.pointerId) return;
  const dx = e.clientX - dialDownX;
  dialGestureId = null;
  if (dialSwiping) {
    suppressDialClick = true;
    if (dx <= -48) setChapter((chapter + 1) % CHAPTERS.length);
    else if (dx >= 48) setChapter((chapter + CHAPTERS.length - 1) % CHAPTERS.length);
  }
  dialSwiping = false;
});
dial.addEventListener("pointercancel", () => { dialGestureId = null; dialSwiping = false; });
dial.addEventListener("click", (e) => {
  if (suppressDialClick) { e.preventDefault(); e.stopPropagation(); suppressDialClick = false; }
}, true);
dial.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    e.preventDefault();
    setChapter((chapter + 1) % CHAPTERS.length);
    stops[chapter] && stops[chapter].focus();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    setChapter((chapter + CHAPTERS.length - 1) % CHAPTERS.length);
    stops[chapter] && stops[chapter].focus();
  }
});

/* ---------- 360 look-around: drag orbits the gaze, taps touch the world ---------- */
let yaw = 0, pitch = 0;           /* yaw 0 faces the rock; unbounded azimuth */
let yawVel = 0, pitchVel = 0;
const PITCH_MIN = -0.14, PITCH_MAX = 0.32;
let dragging = false, moved = 0, downX = 0, downY = 0, lastX = 0, lastY = 0;
let dialPointer = null;
let lastTouch = 0;                /* last scene interaction, for the quiet return home */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 6.2);

function tapRay(e) {
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -((e.clientY / innerHeight) * 2 - 1);
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  return raycaster;
}
addEventListener("pointerdown", (e) => {
  returningHome = false;
  dragging = true; moved = 0;
  downX = lastX = e.clientX; downY = lastY = e.clientY;
  yawVel = 0; pitchVel = 0;
  lastTouch = performance.now();
  wakeChrome();
  dialPointer = e.target.closest && e.target.closest("#dial") ? e.pointerId : null;
});
addEventListener("pointermove", (e) => {
  if (!dragging || dialPointer === e.pointerId) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 8) {
    yaw -= dx * 0.0034;
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy * 0.0024));
    yawVel = Math.max(-0.9, Math.min(0.9, yawVel * 0.82 - dx * 0.0034 * 18));
    pitchVel = Math.max(-0.5, Math.min(0.5, pitchVel * 0.82 + dy * 0.0024 * 18));
    lastTouch = performance.now();
  }
});
addEventListener("pointercancel", (e) => { if (dialPointer === e.pointerId) dialPointer = null; dragging = false; });
addEventListener("pointerup", (e) => {
  dragging = false;
  if (reduceMotion) { yawVel = 0; pitchVel = 0; }
  if (dialPointer === e.pointerId) { dialPointer = null; return; } // dial taps never touch the scene
  if (moved >= 12) return;
  if (e.clientX > innerWidth - 220 && e.clientY > innerHeight - 200) return; /* dial zone stays tappable */
  lastTouch = performance.now();
  const rc = tapRay(e);
  if (chapter === 0) {
    const hit = rc.intersectObject(rock, false)[0];
    if (hit && hit.point.y > -3.5 && hit.point.y < 4.2) {
      const p = hit.point.clone().add(rc.ray.direction.clone().multiplyScalar(-0.4));
      bloom(p);
    }
  } else if (chapter === 1) {
    const p = new THREE.Vector3();
    if (rc.ray.intersectPlane(groundPlane, p) && p.distanceTo(camera.position) < 60) {
      p.y = Math.max(p.y + 1.6, -2.4);
    } else {
      p.copy(camera.position).add(rc.ray.direction.clone().multiplyScalar(22)); p.y = -1.8;
    }
    heatRing(p);
  } else if (chapter === 2) {
    const p = camera.position.clone().add(rc.ray.direction.clone().multiplyScalar(15));
    embers(p);
  } else if (chapter === 3) {
    const p = new THREE.Vector3();
    if (rc.ray.intersectPlane(groundPlane, p)) {
      const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
      if (d > 2 && d < 45) plantBulb(p.x, -5.9 + Math.random() * 1.2, p.z);
    }
  }
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const lookTarget = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const tA = reduceMotion ? 0 : t;

  /* orbit: inertia after release; the view only returns home when asked */
  if (!dragging) {
    yaw += yawVel * dt; pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + pitchVel * dt));
    const damp = Math.exp(-2.4 * dt);
    yawVel *= damp; pitchVel *= damp;
    if (returningHome) {
      const home = Math.round(yaw / (Math.PI * 2)) * (Math.PI * 2);
      const kh = 1 - Math.exp(-2.2 * dt);
      yaw = lerp(yaw, home, kh);
      pitch = lerp(pitch, 0, kh);
      if (Math.abs(yaw - home) < 0.003 && Math.abs(pitch) < 0.003) { yaw = home; pitch = 0; returningHome = false; }
    }
  }
  /* the home control appears only once you have actually looked away */
  {
    const twoPi = Math.PI * 2;
    const drifted = Math.abs(yaw - Math.round(yaw / twoPi) * twoPi) > 0.35 || Math.abs(pitch) > 0.12;
    if (drifted !== homeWasShown) {
      homeWasShown = drifted;
      homeBtn.classList.toggle("show", drifted);
      homeBtn.setAttribute("aria-hidden", drifted ? "false" : "true");
      homeBtn.tabIndex = drifted ? 0 : -1;
    }
  }
  const sway = reduceMotion ? 0 : Math.sin(tA * 0.07) * 0.006;
  camera.position.copy(HOME);
  lookTarget.set(
    HOME.x - Math.sin(yaw + sway) * Math.cos(pitch),
    HOME.y + Math.sin(pitch),
    HOME.z - Math.cos(yaw + sway) * Math.cos(pitch)
  );
  camera.lookAt(lookTarget);

  const k = 1 - Math.exp(-1.6 * dt);
  lerpColor(skyMat.uniforms.top.value, target.skyTop, k);
  lerpColor(skyMat.uniforms.bottom.value, target.skyBot, k);
  lerpColor(scene.fog.color, target.fog, k);
  scene.fog.density = lerp(scene.fog.density, target.fogN, k);
  lerpColor(rock.material.color, target.rock, k);
  lerpColor(kataMat.color, target.kata, k);
  lerpColor(dunesMat.color, target.dunes, k);
  lerpColor(ridgeMat.color, target.dunes, k);
  lerpColor(floorMat.color, target.floor, k);
  lerpColor(stoneMat.color, target.dunes, k);
  lerpColor(sunMat.color, target.sunC, k);
  lerpColor(haloMat.color, target.sunC, k);
  lerpColor(moteMat.color, target.motes, k);
  lerpColor(spiniMat.color, target.spini, k);
  sun.position.x = lerp(sun.position.x, target.sunX, k);
  sun.position.y = lerp(sun.position.y, target.sunY + Math.sin(tA * 0.8) * 0.12, k);
  halo.position.copy(sun.position);
  sun.lookAt(camera.position); halo.lookAt(camera.position);
  sunMat.opacity = lerp(sunMat.opacity, target.sunO, k);
  haloMat.opacity = lerp(haloMat.opacity, target.haloO * (0.85 + Math.sin(tA * 1.7) * 0.15), k);
  starMat.opacity = lerp(starMat.opacity, target.stars, k);
  moteMat.opacity = lerp(moteMat.opacity, target.motesO, k);
  bulbMat.opacity = lerp(bulbMat.opacity, target.bulbs * (0.75 + Math.sin(tA * 2.1) * 0.25), k);

  const shimTarget = target.shimmer * (0.10 + Math.sin(tA * 3.4) * 0.05);
  shimMat.opacity = lerp(shimMat.opacity, shimTarget, k);
  for (const s of shimmers) { s.m.lookAt(camera.position); s.m.scale.x = 1 + Math.sin(tA * 1.9 + s.phase) * 0.05; }
  for (const s of spiniList) s.g.rotation.y = Math.sin(tA * 0.7 + s.phase) * 0.05;
  for (const b of planted) { b.m.lookAt(camera.position); b.m.material.opacity = 0.6 + Math.sin(tA * 2.4 + b.phase) * 0.35; }

  if (!reduceMotion) {
    const pos = moteGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + dt * (0.3 + (i % 5) * 0.07);
      if (x > 30) x = -30;
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  }

  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    f.m.lookAt(camera.position);
    if (f.kind === "bloom") {
      const s = 1 + f.t * 5;
      f.m.scale.set(s, s, 1);
      f.m.material.opacity = Math.max(0, 0.75 - f.t * 0.55);
      if (f.t > 1.4) { scene.remove(f.m); fx.splice(i, 1); }
    } else if (f.kind === "ring") {
      const s = 1 + f.t * 8;
      f.m.scale.set(s, s, 1);
      f.m.scale.y = s * (f.m.userData.flat || 0.28);
      f.m.material.opacity = Math.max(0, 0.8 - f.t * 0.8);
      if (f.t > 1.1) { scene.remove(f.m); fx.splice(i, 1); }
    } else {
      f.m.position.x += f.vx * dt;
      f.m.position.y += f.vy * dt;
      f.vy -= 2.6 * dt;
      f.m.material.opacity = Math.max(0, 0.95 - f.t * 1.1);
      if (f.t > 1.0) { scene.remove(f.m); fx.splice(i, 1); }
    }
  }

  stepSprings(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ---------- veil ---------- */
setTimeout(() => {
  veil.classList.add("gone");
  stops[0].classList.add("active");
  caption.textContent = CHAPTERS[0].caption;
  setTimeout(() => caption.classList.add("show"), 900);
  whisper.textContent = CHAPTERS[0].whisper;
  whisperTimer = setTimeout(() => whisper.classList.add("show"), 3000);
  wakeChrome();
  startCue(0);
  lastTouch = performance.now();
}, 2100);
