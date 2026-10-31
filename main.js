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
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.position.set(0, 0, 10);
scene.fog = new THREE.FogExp2(0xf6bd97, 0.012);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = camera.aspect < 0.75 ? 15.5 : 10;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ---------- sky ---------- */
const skyMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { top: { value: new THREE.Color("#ffe8d6") }, bottom: { value: new THREE.Color("#f9c39a") } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.15, 0.85, vUv.y)), 1.0); }",
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

/* ---------- sun / moon ---------- */
const sunMat = new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 1 });
const sun = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), sunMat);
sun.position.set(-8, 4.6, -38);
scene.add(sun);
const haloMat = new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 0.28 });
const halo = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), haloMat);
halo.position.copy(sun.position);
scene.add(halo);

/* ---------- helpers ---------- */
function layer(shape, color, z, opacity = 1) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  m.position.z = z;
  scene.add(m);
  return m;
}
function ridgeShape(width, base, amp, freq, phase) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, -30);
  for (let x = -width / 2; x <= width / 2; x += 2) {
    s.lineTo(x, base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4);
  }
  s.lineTo(width / 2, -30);
  s.closePath();
  return s;
}

/* the monolith itself */
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
const rock = layer(rockShape(), "#a4553f", -30);
/* Kata Tjuta's distant domes */
const kata = layer(ridgeShape(70, -2.6, 1.5, 0.09, 2.0), "#c08a76", -38, 0.55);
kata.position.x = -26;
/* dune line + desert floor */
const dunes = layer(ridgeShape(240, -4.6, 0.5, 0.05, 1.0), "#d99a6c", -20);
const floor = layer(ridgeShape(240, -6.4, 0.4, 0.04, 4.0), "#c98a5f", -12);

/* spinifex tufts: three crossed blades */
const spiniMat = new THREE.MeshBasicMaterial({ color: "#c8a24f", transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const spinifex = new THREE.Group();
const spiniList = [];
{
  const spots = [[-15, -4.4], [-9, -5.0], [-3, -4.5], [4, -5.2], [9, -4.4], [14, -5.0], [-19, -5.2], [18, -4.5]];
  for (const [x, y] of spots) {
    const g = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.85), spiniMat);
      blade.rotation.z = (b - 1) * 0.5;
      blade.position.y = 0.35;
      g.add(blade);
    }
    g.position.set(x, y, -11);
    spinifex.add(g);
    spiniList.push({ g, phase: Math.random() * 6 });
  }
}
scene.add(spinifex);

/* desert oaks: slim dark silhouettes at the edges */
const oakMat = new THREE.MeshBasicMaterial({ color: "#5c4632", transparent: true, opacity: 0.8, side: THREE.DoubleSide });
{
  for (const [x, y, sc] of [[-22, -4.9, 1.1], [24, -5.1, 0.9]]) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.2), oakMat);
    trunk.position.y = 1.0;
    g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), oakMat);
    canopy.scale.set(0.8, 1.5, 1);
    canopy.position.y = 2.4;
    g.add(canopy);
    g.position.set(x, y, -19);
    g.scale.setScalar(sc);
    scene.add(g);
  }
}

/* heat shimmer lines (midday only) */
const shimMat = new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 0 });
const shimmers = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(26 - i * 5, 0.055), shimMat);
  m.position.set((i - 1) * 4, 4.15 + i * 0.45, -19.5);
  scene.add(m);
  shimmers.push({ m, phase: i * 1.7 });
}

/* stars */
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 320; i++) pts.push((Math.random() - 0.5) * 170, Math.random() * 52 - 4, -50 + Math.random() * 18);
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const starMat = new THREE.PointsMaterial({ color: "#fff7e6", size: 0.16, transparent: true, opacity: 0, sizeAttenuation: true });
scene.add(new THREE.Points(starGeo, starMat));

/* field of light: pre-seeded bulbs */
const bulbGeo = new THREE.BufferGeometry();
{
  const pts = [], cols = [];
  const palette = [[1.0, 0.85, 0.6], [1.0, 0.65, 0.65], [0.7, 0.8, 1.0], [1.0, 0.95, 0.75], [0.9, 0.7, 1.0]];
  for (let i = 0; i < 46; i++) {
    pts.push((Math.random() - 0.5) * 34, -5.9 + Math.random() * 1.6, -11.4 + Math.random() * 0.8);
    const c = palette[i % palette.length];
    cols.push(c[0], c[1], c[2]);
  }
  bulbGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  bulbGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
}
const bulbMat = new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
scene.add(new THREE.Points(bulbGeo, bulbMat));

/* planted bulbs (night tap) */
const planted = [];
const bulbPalette = ["#ffd9a0", "#ff9d9d", "#b3ccff", "#fff2c0", "#e0b3ff"];
function plantBulb(x, y) {
  if (planted.length >= 60) { const old = planted.shift(); scene.remove(old.m); }
  const c = new THREE.Color(bulbPalette[planted.length % bulbPalette.length]);
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(x, y, -11.2);
  m.scale.setScalar(0.01);
  scene.add(m);
  planted.push({ m, phase: Math.random() * 6 });
  spring(m.scale, "x", 1, { stiffness: 90, damping: 8 });
  spring(m.scale, "y", 1, { stiffness: 90, damping: 8 });
}

/* dust motes */
const moteGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 120; i++) pts.push((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 26, -30 + Math.random() * 24);
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const moteMat = new THREE.PointsMaterial({ color: "#ffe0b8", size: 0.2, transparent: true, opacity: 0.32, sizeAttenuation: true });
scene.add(new THREE.Points(moteGeo, moteMat));

/* tap effects: dawn bloom, heat ring, ember burst */
const fx = [];
function bloom(x, y) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: "#ffcf9e", transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(x, y, -29.8);
  scene.add(m);
  fx.push({ m, t: 0, kind: "bloom" });
}
function heatRing(x, y) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 48),
    new THREE.MeshBasicMaterial({ color: "#fff6e0", transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  m.position.set(x, y, -19.4);
  m.scale.y = 0.28;
  scene.add(m);
  fx.push({ m, t: 0, kind: "ring" });
}
function embers(x, y) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffb45e" : "#ff8b4a", transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, -19.3);
    scene.add(m);
    fx.push({ m, t: 0, kind: "ember", vx: (Math.random() - 0.5) * 3.2, vy: 1.6 + Math.random() * 2.4 });
  }
}

/* ---------- chapters: one day over the rock ---------- */
const CHAPTERS = [
  { skyTop: "#ffe8d6", skyBot: "#f9c39a", fog: ["#f6bd97", 0.012], rock: "#a4553f", kata: "#c08a76", dunes: "#d99a6c", floor: "#c98a5f",
    sun: [-8, 4.6], sunC: "#ffcf9e", sunO: 1, haloO: 0.28, stars: 0, shimmer: 0, bulbs: 0, motes: ["#ffe0b8", 0.32], spini: "#c8a24f", night: false,
    caption: "The rock wakes in blush.", whisper: "Six hundred million years old. Touch it awake." },
  { skyTop: "#bfe0ee", skyBot: "#f0e2c0", fog: ["#ecd9b4", 0.010], rock: "#b3402a", kata: "#c96f4e", dunes: "#d98e52", floor: "#cf8350",
    sun: [0, 8.6], sunC: "#fff3d0", sunO: 1, haloO: 0.2, stars: 0, shimmer: 1, bulbs: 0, motes: ["#fff2d8", 0.3], spini: "#d4b25c", night: false,
    caption: "Red centre, red heart.", whisper: "Tap the air - watch the heat shimmer." },
  { skyTop: "#8e4160", skyBot: "#ff8b4a", fog: ["#e0745a", 0.014], rock: "#e0562f", kata: "#a04a3a", dunes: "#b35c3a", floor: "#9c4f33",
    sun: [11.5, 1.1], sunC: "#ffb45e", sunO: 1, haloO: 0.4, stars: 0, shimmer: 0, bulbs: 0, motes: ["#ffc890", 0.36], spini: "#a8763a", night: false,
    caption: "Every evening, it catches fire.", whisper: "Tap the sky - scatter the embers." },
  { skyTop: "#0b1026", skyBot: "#1c2340", fog: ["#141a33", 0.024], rock: "#221733", kata: "#1c1428", dunes: "#191428", floor: "#171225",
    sun: [9, 7.4], sunC: "#e8e4d8", sunO: 0.85, haloO: 0.12, stars: 1, shimmer: 0, bulbs: 1, motes: ["#c8c0b0", 0.16], spini: "#2c2440", night: true,
    caption: "Fifty thousand lights bloom in the dark.", whisper: "Plant your own. Sacred Anangu land - seen, never climbed." },
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
let idleTimer, whisperTimer;
function wakeChrome() {
  chrome.forEach((c) => c.classList.remove("idle"));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => chrome.forEach((c) => c.classList.add("idle")), 4200);
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
  setTimeout(() => { caption.textContent = c.caption; caption.classList.add("show"); }, 1100);
  whisperTimer = setTimeout(() => { whisper.textContent = c.whisper; whisper.classList.add("show"); }, 3200);
  wakeChrome();
}
stops.forEach((d, i) => d.addEventListener("click", () => setChapter(i)));

/* ---------- pointer ---------- */
let px = 0, py = 0, dragging = false, moved = 0, downX = 0, downY = 0;
addEventListener("pointerdown", (e) => { dragging = true; moved = 0; downX = e.clientX; downY = e.clientY; wakeChrome(); });
addEventListener("pointermove", (e) => {
  if (dragging) { moved += Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY); }
  px = (e.clientX / innerWidth) * 2 - 1;
  py = (e.clientY / innerHeight) * 2 - 1;
});
addEventListener("pointerup", (e) => {
  dragging = false;
  if (moved >= 12) return;
  if (e.clientX > innerWidth - 220 && e.clientY > innerHeight - 200) return; /* dial zone stays tappable */
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -((e.clientY / innerHeight) * 2 - 1);
  if (chapter === 0 && ny > -0.35) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (-29.8 - camera.position.z) / dir.z;
    const hit = camera.position.clone().add(dir.multiplyScalar(t));
    if (hit.y > -3.5 && hit.y < 4.2 && hit.x > -32 && hit.x < 32) bloom(hit.x, hit.y);
  } else if (chapter === 1) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (-19.4 - camera.position.z) / dir.z;
    const hit = camera.position.clone().add(dir.multiplyScalar(t));
    heatRing(hit.x, Math.max(hit.y, -2.4));
  } else if (chapter === 2) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (-19.3 - camera.position.z) / dir.z;
    const hit = camera.position.clone().add(dir.multiplyScalar(t));
    embers(hit.x, hit.y);
  } else if (chapter === 3 && ny < -0.15) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (-11.2 - camera.position.z) / dir.z;
    const hit = camera.position.clone().add(dir.multiplyScalar(t));
    if (hit.y < -2.2 && hit.y > -6.6) plantBulb(hit.x, hit.y);
  }
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let camX = 0, camY = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  camX = lerp(camX, px * 1.1, 1 - Math.exp(-3.2 * dt));
  camY = lerp(camY, -py * 0.5, 1 - Math.exp(-3.2 * dt));
  camera.position.x = camX; camera.position.y = camY + 0.4;
  camera.lookAt(camX * 0.4, camY * 0.3 + 0.4, -20);

  const k = 1 - Math.exp(-1.6 * dt);
  lerpColor(skyMat.uniforms.top.value, target.skyTop, k);
  lerpColor(skyMat.uniforms.bottom.value, target.skyBot, k);
  lerpColor(scene.fog.color, target.fog, k);
  scene.fog.density = lerp(scene.fog.density, target.fogN, k);
  lerpColor(rock.material.color, target.rock, k);
  lerpColor(kata.material.color, target.kata, k);
  lerpColor(dunes.material.color, target.dunes, k);
  lerpColor(floor.material.color, target.floor, k);
  lerpColor(sunMat.color, target.sunC, k);
  lerpColor(haloMat.color, target.sunC, k);
  lerpColor(moteMat.color, target.motes, k);
  lerpColor(spiniMat.color, target.spini, k);
  sun.position.x = lerp(sun.position.x, target.sunX, k);
  sun.position.y = lerp(sun.position.y, target.sunY + Math.sin(t * 0.8) * 0.12, k);
  halo.position.copy(sun.position);
  sunMat.opacity = lerp(sunMat.opacity, target.sunO, k);
  haloMat.opacity = lerp(haloMat.opacity, target.haloO * (0.85 + Math.sin(t * 1.7) * 0.15), k);
  starMat.opacity = lerp(starMat.opacity, target.stars, k);
  moteMat.opacity = lerp(moteMat.opacity, target.motesO, k);
  bulbMat.opacity = lerp(bulbMat.opacity, target.bulbs * (0.75 + Math.sin(t * 2.1) * 0.25), k);

  const shimTarget = target.shimmer * (0.10 + Math.sin(t * 3.4) * 0.05);
  shimMat.opacity = lerp(shimMat.opacity, shimTarget, k);
  for (const s of shimmers) { s.m.position.y += Math.sin(t * 2.2 + s.phase) * 0.0015; s.m.scale.x = 1 + Math.sin(t * 1.9 + s.phase) * 0.05; }
  for (const s of spiniList) s.g.rotation.z = Math.sin(t * 0.7 + s.phase) * 0.04;
  for (const b of planted) b.m.material.opacity = 0.6 + Math.sin(t * 2.4 + b.phase) * 0.35;

  const pos = moteGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + dt * (0.3 + (i % 5) * 0.07);
    if (x > 46) x = -46;
    pos.setX(i, x);
  }
  pos.needsUpdate = true;

  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.kind === "bloom") {
      const s = 1 + f.t * 5;
      f.m.scale.set(s, s, 1);
      f.m.material.opacity = Math.max(0, 0.75 - f.t * 0.55);
      if (f.t > 1.4) { scene.remove(f.m); fx.splice(i, 1); }
    } else if (f.kind === "ring") {
      const s = 1 + f.t * 8;
      f.m.scale.set(s, s * 0.28, 1);
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
}, 2100);
