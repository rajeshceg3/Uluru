import * as THREE from "three";
import { createSoundscape } from './soundscape/soundscape-engine.js';
import soundProgram from './soundscape/soundscape-program.js';

// Illustrative exterior study. No climbing route or sacred-site reconstruction.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.querySelector("#rock");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(49, 1, 0.2, 1400);
camera.rotation.order = "YXZ";
const hemi = new THREE.HemisphereLight("#ffe3bf", "#714336", 1.6);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight("#ffd4a5", 3.1);
sunLight.position.set(-90, 35, 80);
scene.add(sunLight);
const fill = new THREE.DirectionalLight("#b9cbe7", 0.4);
fill.position.set(70, 40, -60);
scene.add(fill);
scene.fog = new THREE.FogExp2("#e5b592", 0.0015);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color("#9baecf") },
    horizon: { value: new THREE.Color("#edc4a4") },
  },
  vertexShader:
    "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:
    "uniform vec3 top;uniform vec3 horizon;varying vec3 p;void main(){float h=normalize(p).y;gl_FragColor=vec4(mix(horizon,top,smoothstep(0.,.7,h)),1.);\n#include <colorspace_fragment>\n}",
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1100, 40, 24), skyMat));
const hash = (x, z) => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
const mix = THREE.MathUtils.lerp;
function noise(x, z) {
  const a = Math.floor(x),
    b = Math.floor(z),
    u = x - a,
    v = z - b,
    s = u * u * (3 - 2 * u),
    t = v * v * (3 - 2 * v);
  return mix(
    mix(hash(a, b), hash(a + 1, b), s),
    mix(hash(a, b + 1), hash(a + 1, b + 1), s),
    t,
  );
}
function ground(x, z) {
  return (
    0.4 * Math.sin(x * 0.025 + z * 0.018) + noise(x * 0.03, z * 0.03) * 0.65
  );
}
const floorG = new THREE.PlaneGeometry(1600, 1600, 160, 160);
floorG.rotateX(-Math.PI / 2);
const fp = floorG.attributes.position,
  fc = [];
for (let i = 0; i < fp.count; i++) {
  const x = fp.getX(i),
    z = fp.getZ(i);
  fp.setY(i, ground(x, z) - 0.6);
  const c = new THREE.Color("#b66d43").lerp(
    new THREE.Color("#d29260"),
    noise(x * 0.06, z * 0.06),
  );
  fc.push(c.r, c.g, c.b);
}
floorG.setAttribute("color", new THREE.Float32BufferAttribute(fc, 3));
floorG.computeVertexNormals();
const floorMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
});
scene.add(new THREE.Mesh(floorG, floorMat));

// Continuous rounded, elongated sandstone mass with shallow rain-runoff channels.
// Hand-built silhouette, not survey geometry. Shared vertices and smooth normals.
const rockG = new THREE.BufferGeometry(),
  verts = [],
  indices = [],
  colors = [];
const segments = 240,
  rings = 46;
for (let j = 0; j <= rings; j++) {
  const t = j / rings;
  // Steep walls give way to the broad, rounded summit, rather than an ellipsoid.
  const r =
    t < 0.62
      ? 1 - 0.055 * (t / 0.62)
      : Math.pow(Math.cos((((t - 0.62) / 0.38) * Math.PI) / 2), 0.65) * 0.945;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a);
    const x0 = 31 * Math.sign(c) * Math.pow(Math.abs(c), 0.78);
    const z0 = 12.2 * Math.sign(s) * Math.pow(Math.abs(s), 0.82);
    const crown =
      17.6 +
      0.8 * Math.cos(x0 * r * 0.075) +
      0.3 * Math.sin(x0 * r * 0.16) -
      2.0 * THREE.MathUtils.smoothstep(x0 * r, 1, 30);
    let channels = 0;
    for (const [cx, w, depth] of [
      [-23, 1.0, 0.6],
      [-17, 0.7, 0.9],
      [-9, 1.1, 0.45],
      [-2, 0.45, 1.0],
      [4, 0.7, 0.65],
      [13, 1.3, 0.8],
      [22, 0.65, 0.5],
    ])
      channels +=
        depth *
        Math.exp(-Math.pow((x0 - cx + Math.sin(t * 4 + cx) * 0.25) / w, 2));
    const groove =
      (channels * Math.pow(Math.max(0, s), 1.4) * 1.8 +
        Math.pow(0.5 + 0.5 * Math.sin(a * 93 + noise(a * 19, t * 9) * 2), 22) *
          0.13) *
      Math.sin(t * Math.PI);
    const wobble =
      (0.14 * Math.sin(a * 9 + t * 3) + 0.09 * Math.sin(a * 17 - t * 4)) * r;
    const x = x0 * (r - groove * 0.026) + wobble,
      z = z0 * (r - groove * 0.065),
      y = t * crown;
    verts.push(x, y, z);
    const n = noise(a * 13, t * 13);
    const color = new THREE.Color("#975d48").lerp(
      new THREE.Color("#b78261"),
      n * 0.16 + t * 0.12,
    );
    color.multiplyScalar(1 - groove * 0.2);
    colors.push(color.r, color.g, color.b);
    if (j < rings && i < segments) {
      const k = j * (segments + 1) + i;
      indices.push(
        k,
        k + segments + 1,
        k + 1,
        k + 1,
        k + segments + 1,
        k + segments + 2,
      );
    }
  }
}
rockG.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
rockG.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
rockG.setIndex(indices);
rockG.computeVertexNormals();
const rockMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
  side: THREE.DoubleSide,
});
const contact = new THREE.Mesh(
  new THREE.CircleGeometry(1, 100),
  new THREE.MeshBasicMaterial({
    color: "#493325",
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  }),
);
contact.rotation.x = -Math.PI / 2;
contact.position.set(1, 0.02, 0);
contact.scale.set(34, 14, 1);
scene.add(contact);
const monolith = new THREE.Mesh(rockG, rockMat);
monolith.rotation.y = -0.13;
scene.add(monolith);

// The distant domed range is only an illustrative horizon silhouette.
const domeMat = new THREE.MeshStandardMaterial({
  color: "#87605b",
  roughness: 1,
});
for (let i = 0; i < 12; i++) {
  const g = new THREE.SphereGeometry(1, 24, 16),
    d = new THREE.Mesh(g, domeMat);
  d.position.set(-250 + i * 7, 3, -225 + Math.sin(i) * 12);
  d.scale.set(9 + hash(i, 1) * 5, 8 + hash(i, 2) * 9, 11);
  scene.add(d);
}
const grassMat = new THREE.MeshStandardMaterial({
  color: "#a39855",
  roughness: 1,
  side: THREE.DoubleSide,
});
const tuftG = new THREE.BufferGeometry(),
  tp = [];
for (let b = 0; b < 11; b++) {
  const a = b * 2.4;
  tp.push(
    0,
    0,
    0,
    Math.cos(a) * 0.65,
    0.12,
    Math.sin(a) * 0.65,
    Math.cos(a) * 0.7,
    0.95 + hash(b, 8) * 0.4,
    Math.sin(a) * 0.7,
  );
}
tuftG.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
tuftG.computeVertexNormals();
for (let i = 0; i < 250; i++) {
  const a = hash(i, 4) * Math.PI * 2,
    r = 45 + hash(i, 6) * 250;
  const x = Math.cos(a) * r,
    z = Math.sin(a) * r;
  const tuft = new THREE.Mesh(tuftG, grassMat);
  tuft.position.set(x, ground(x, z) - 0.5, z);
  tuft.rotation.y = i;
  tuft.scale.setScalar(0.45 + hash(i, 2) * 0.8);
  scene.add(tuft);
}
// Desert oaks provide parallax around the plain, not an invented village.
const trunkMat = new THREE.MeshStandardMaterial({
  color: "#4a3931",
  roughness: 1,
});
const leafMat = new THREE.MeshStandardMaterial({
  color: "#526049",
  roughness: 1,
});
for (let i = 0; i < 17; i++) {
  const a = hash(i, 12) * 6.28,
    r = 100 + hash(i, 14) * 180,
    x = Math.cos(a) * r,
    z = Math.sin(a) * r;
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.3, 7, 7),
    trunkMat,
  );
  trunk.position.y = 3.5;
  tree.add(trunk);
  for (let j = 0; j < 4; j++) {
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 8), leafMat);
    foliage.scale.set(1.3, 3.5, 1.3);
    foliage.position.set(
      Math.sin(j * 2) * 0.9,
      6 + j * 0.4,
      Math.cos(j * 2) * 0.9,
    );
    tree.add(foliage);
  }
  tree.position.set(x, ground(x, z) - 0.5, z);
  scene.add(tree);
}
const starsG = new THREE.BufferGeometry(),
  sp = [];
for (let i = 0; i < 800; i++) {
  const a = hash(i, 4) * 6.28,
    e = 0.12 + hash(i, 7) * 1.35,
    r = 950;
  sp.push(
    Math.cos(a) * Math.cos(e) * r,
    Math.sin(e) * r,
    Math.sin(a) * Math.cos(e) * r,
  );
}
starsG.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
const starsMat = new THREE.PointsMaterial({
  color: "#faf2db",
  size: 1.6,
  transparent: true,
  opacity: 0,
  fog: false,
});
scene.add(new THREE.Points(starsG, starsMat));
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(7, 24, 16),
  new THREE.MeshBasicMaterial({
    color: "#e4e9f7",
    transparent: true,
    opacity: 0,
    fog: false,
  }),
);
moon.position.set(230, 155, -450);
scene.add(moon);

const chapters = [
  {
    name: "Dawn",
    caption: "First light on sandstone.",
    detail: "About half a billion years in the making.",
    top: "#829bc2",
    horizon: "#edbea2",
    rock: "#fff2e6",
    ground: "#dba577",
    light: "#ffd1a2",
    power: 3.0,
    ambient: 1.4,
    eye: [5, 9, 158],
    look: [0, 8, 0],
    sun: [-90, 28, 90],
  },
  {
    name: "Midday",
    caption: "The red centre, in relief.",
    detail: "Rainwater has traced the grooves in its face.",
    top: "#5c9dc8",
    horizon: "#d7d1bd",
    rock: "#fff6ef",
    ground: "#dba074",
    light: "#fff3db",
    power: 2.6,
    ambient: 1.6,
    eye: [-18, 10, 154],
    look: [0, 8, 0],
    sun: [-50, 110, 40],
  },
  {
    name: "Sunset",
    caption: "Sandstone holds the last light.",
    detail: "Iron in the rock gives the surface its rusty red.",
    top: "#584b7e",
    horizon: "#df9471",
    rock: "#ffd9b9",
    ground: "#ae7658",
    light: "#ffab64",
    power: 3.4,
    ambient: 0.95,
    eye: [25, 10, 155],
    look: [0, 8, 0],
    sun: [65, 20, 90],
  },
  {
    name: "Night",
    caption: "A silhouette under southern stars.",
    detail: "Aṉangu country. Look with care, leave no trace.",
    top: "#070c21",
    horizon: "#28334b",
    rock: "#a7b9db",
    ground: "#555b70",
    light: "#91abdf",
    power: 1.25,
    ambient: 1.35,
    eye: [0, 9, 153],
    look: [0, 8, 0],
    sun: [50, 70, 40],
  },
];
let chapter = 0,
  yaw = 0,
  pitch = 0,
  vx = 0,
  vy = 0,
  drag = null,
  lastTime = performance.now();
const eye = new THREE.Vector3(),
  aim = new THREE.Vector3();
let entryYaw = 0,
  entryPitch = 0;
const caption = document.querySelector("#caption"),
  detail = document.querySelector("#whisper");
const buttons = [...document.querySelectorAll(".stop")];
function reset() {
  vx = vy = 0;
  drag = null;
  yaw = entryYaw;
  pitch = entryPitch;
}
function setChapter(i) {
  chapter = i;
  const c = chapters[i];
  soundscape.setScene(AUDIO_SCENES[i]);
  caption.textContent = c.caption;
  detail.textContent = c.detail;
  buttons.forEach((b, j) => {
    b.classList.toggle("active", j === i);
    b.setAttribute("aria-pressed", String(j === i));
  });
  document.body.dataset.chapter = i;
  eye.fromArray(c.eye);
  if (innerWidth >= 760) eye.multiplyScalar(0.72);
  aim.fromArray(c.look);
  const dir = aim.clone().sub(eye).normalize();
  entryYaw = Math.atan2(-dir.x, -dir.z);
  entryPitch = Math.asin(dir.y);
  reset();
}
buttons.forEach((b, i) => b.addEventListener("click", () => setChapter(i)));
document.querySelector("#reset-orb").addEventListener("click", reset);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  setChapter(chapter);
}
addEventListener("resize", resize);
canvas.addEventListener("pointerdown", (e) => {
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (reduced) {
    yaw -= dx * 0.003;
    pitch -= dy * 0.002;
  } else {
    vx = -dx * 0.0015;
    vy = -dy * 0.001;
  }
});
canvas.addEventListener("pointerup", () => (drag = null));
canvas.addEventListener("pointercancel", () => (drag = null));
const dial = document.querySelector("#dial");
let startX = null,
  swiping = false,
  suppressClick = false;
dial.addEventListener("pointerdown", (e) => {
  startX = e.clientX;
  swiping = false;
});
dial.addEventListener("pointermove", (e) => {
  if (startX !== null && Math.abs(e.clientX - startX) > 8) {
    swiping = true;
    dial.setPointerCapture(e.pointerId);
  }
});
dial.addEventListener("pointerup", (e) => {
  if (startX !== null && swiping) {
    suppressClick = true;
    if (Math.abs(e.clientX - startX) > 48)
      setChapter((chapter + (e.clientX < startX ? 1 : 3)) % 4);
  }
  startX = null;
  swiping = false;
});
dial.addEventListener("pointercancel", () => {
  startX = null;
  swiping = false;
});
dial.addEventListener(
  "click",
  (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }
  },
  true,
);
dial.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    setChapter((chapter + (e.key === "ArrowRight" ? 1 : 3)) % 4);
    buttons[chapter].focus();
  }
});
/* Opt-in red-centre sound, off by default. Synthesized from what the place
   holds: cool dawn air and sparse birds, hot wind over spinifex at midday,
   flock chatter as the light eases, cold night air with a distant dingo.
   Environmental only - no cultural music, no voice. Follows the chapter. */
const AUDIO_SCENES = ["dawn", "midday", "lastLight", "night"];
const soundscape = createSoundscape(soundProgram, { masterGain: 0.9 });
let audioStarted = false;
const audioButton = document.querySelector("#audio-orb");
audioButton.addEventListener("click", async () => {
  if (!audioStarted) {
    audioStarted = true;
    await soundscape.start(AUDIO_SCENES[chapter]);
  } else {
    soundscape.setOn(!soundscape.on);
  }
  audioButton.setAttribute("aria-pressed", String(soundscape.on));
  audioButton.setAttribute(
    "aria-label",
    soundscape.on ? "Mute desert wind" : "Play desert wind",
  );
  audioButton.textContent = soundscape.on ? "Sound on" : "Sound";
});
document.addEventListener("visibilitychange", () => soundscape.handleVisibility());
window.__soundscape = soundscape;
setChapter(0);
resize();
function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const c = chapters[chapter],
    k = reduced ? 1 : 1 - Math.exp(-dt * 2);
  if (!reduced) {
    yaw += vx * dt * 60;
    pitch += vy * dt * 60;
    vx *= Math.exp(-dt * 7);
    vy *= Math.exp(-dt * 7);
  }
  pitch = THREE.MathUtils.clamp(pitch, -0.6, 0.5);
  camera.position.copy(eye);
  camera.rotation.set(pitch, yaw, 0);
  canvas.dataset.yaw = yaw.toFixed(5);
  canvas.dataset.pitch = pitch.toFixed(5);
  canvas.dataset.entryYaw = entryYaw.toFixed(5);
  canvas.dataset.entryPitch = entryPitch.toFixed(5);
  skyMat.uniforms.top.value.lerp(new THREE.Color(c.top), k);
  skyMat.uniforms.horizon.value.lerp(new THREE.Color(c.horizon), k);
  scene.fog.color.lerp(new THREE.Color(c.horizon), k);
  rockMat.color.lerp(new THREE.Color(c.rock), k);
  floorMat.color.lerp(
    new THREE.Color(chapter === 3 ? "#8193af" : "#ffffff"),
    k,
  );
  grassMat.color.lerp(
    new THREE.Color(chapter === 3 ? "#46516a" : "#a39855"),
    k,
  );
  sunLight.color.lerp(new THREE.Color(c.light), k);
  sunLight.intensity = mix(sunLight.intensity, c.power, k);
  hemi.intensity = mix(hemi.intensity, c.ambient, k);
  hemi.color.lerp(new THREE.Color(chapter === 3 ? "#acbfdf" : "#ffe3bf"), k);
  hemi.groundColor.lerp(
    new THREE.Color(chapter === 3 ? "#626c84" : "#714336"),
    k,
  );
  sunLight.position.lerp(new THREE.Vector3(...c.sun), k);
  starsMat.opacity = mix(starsMat.opacity, chapter === 3 ? 1 : 0, k);
  moon.material.opacity = starsMat.opacity;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
setTimeout(() => document.querySelector("#veil").classList.add("gone"), 450);
