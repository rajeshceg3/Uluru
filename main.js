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
  yawVel = 0, // rad/s, estimated while dragging, spent only after release
  drag = null,
  moved = 0,
  lastTime = performance.now();
const eye = new THREE.Vector3(),
  aim = new THREE.Vector3();
let entryYaw = 0,
  entryPitch = 0;
const caption = document.querySelector("#caption"),
  detail = document.querySelector("#whisper");
const buttons = [...document.querySelectorAll(".stop")];
function reset() {
  yawVel = 0;
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
  discoverySetChapter(i);
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
/* Look-around ported from the shore controller: the world follows the finger
   directly (drag distance scaled by the camera's field of view over the
   viewport, so one swipe covers the same scene fraction on any screen),
   angular velocity is only estimated for the release, and glide starts only
   after the finger lifts. A stationary hold longer than 90ms means the user
   is holding still, not winding up, so no glide is owed. */
canvas.addEventListener("pointerdown", (e) => {
  if (drag) return; // one finger steers; a second pointer never hijacks
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  moved = 0;
  yawVel = 0; // a fresh press owns the view; old glide dies here
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  moved += Math.abs(dx) + Math.abs(dy);
  const vf = (camera.fov * Math.PI) / 180,
    hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const gain = camera.aspect < 0.75 ? 1.8 : 1; // a narrow phone shows little of the circle, so a swipe turns further
  const dyaw = -dx * (hf / innerWidth) * gain;
  yaw += dyaw;
  pitch = THREE.MathUtils.clamp(
    pitch - dy * (vf / innerHeight) * gain,
    -0.6,
    0.5,
  );
  const now = performance.now(),
    dtm = Math.max(8, now - drag.t) / 1000;
  yawVel = mix(yawVel, dyaw / dtm, 0.35);
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.t = now;
});
canvas.addEventListener("pointerup", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (reduced || performance.now() - drag.t > 90) yawVel = 0; // held still: direct control, no glide
  yawVel = Math.max(-2.2, Math.min(2.2, yawVel));
  drag = null;
});
canvas.addEventListener("pointercancel", () => {
  drag = null;
  yawVel = 0;
});
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
/* ---------- quiet discoveries ----------
   Depth lives inside the world, one discovery at a time: a single soft
   glimmer marks something worth a longer look. Hold your gaze on it and it
   names itself; touch it and one note steps forward in the journey text's
   place - never stacked, never a panel farm. Facts are place-true and
   humble, and Aṉangu wishes about sacred detail are respected by omission:
   no sacred-site reconstruction, no restricted stories. */
const DISCOVERIES = [
  {
    chapter: 0,
    id: "blush",
    title: "The blush",
    invite: "The face warms before the sun ever clears it.",
    body: "Uluru is arkose - a sandstone rich in feldspar, pressed from sediment shed by mountains that wore away about 550 million years ago. The red is only a skin: iron in the rock, rusted by air. Where the surface flakes, the stone underneath is its original grey.",
    at: [2, 15, 12],
  },
  {
    chapter: 0,
    id: "green-sea",
    title: "The green sea",
    invite: "The plain is not as empty as it looks.",
    body: "Spinifex covers this country in pale waves, and young desert oaks stand over it like dark feathers. Rare rain changes everything within days - the red ground flowers, and for a while the desert turns quietly green.",
    at: [14, 0.5, 60],
  },
  {
    chapter: 1,
    id: "water-writing",
    title: "Water writing",
    invite: "The face keeps its rain.",
    body: "Every groove in the rock is rain. Storm water sheets down the steep walls along these channels and gathers in waterholes around the base, and after heavy rain the rock briefly wears waterfalls.",
    at: [-6, 13, 11],
  },
  {
    chapter: 1,
    id: "hidden-rock",
    title: "The hidden rock",
    invite: "What you see is the smaller half.",
    body: "The rock rises 348 metres above the plain, and a slow walk around its base runs about 9.4 kilometres. Like an iceberg, most of the slab is out of sight - the same great block of arkose continues underground for kilometres more.",
    at: [1, 1, 13],
  },
  {
    chapter: 2,
    id: "many-heads",
    title: "Many heads",
    invite: "The horizon has company.",
    body: "West along the horizon stand the 36 domes of Kata Tjuta - 'many heads' in Pitjantjatjara - the highest rising about 546 metres above the plain. Same deep story, different rock: cemented pebbles and boulders where Uluru is sand. For Aṉangu these domes carry men's business, and their stories are not shared publicly.",
    at: [-190, 8, -225],
  },
  {
    chapter: 2,
    id: "burning-face",
    title: "The burning face",
    invite: "The rock saves its loudest colour for last.",
    body: "At the day's lowest angle, sunlight crosses more of the desert air and arrives redder, and the rusted skin answers. People who live with this view still argue over whether dawn or dusk burns brighter.",
    at: [-28, 13, 4],
  },
  {
    chapter: 3,
    id: "southern-cross",
    title: "The southern sky",
    invite: "The sky is the second half of the place.",
    body: "Nights here fall cold and very clear. The Southern Cross stands low over the dark with its two bright Pointers, and the Milky Way runs overhead like smoke - a sky people have read from this plain for tens of thousands of years.",
    at: [0, 420, -700],
  },
  {
    chapter: 3,
    id: "first-people",
    title: "Aṉangu country",
    invite: "This country was never empty.",
    body: "This has always been Aṉangu land, read through Tjukurpa - the law and creation history held in the country itself. The park was handed back to its traditional owners in 1985 and is cared for together; the climb closed for good in 2019, out of respect. Some places here are asked not to be photographed. Looking gently is the way.",
    at: [0, 9, 12],
  },
  {
    chapter: 3,
    id: "lights",
    title: "A field of light",
    invite: "After dark, the plain answers.",
    body: "Out on the real plain, an artwork blooms after dark: Field of Light, more than 50,000 slender solar stems first lit in 2016, glowing softly until they sleep. This plain remembers a touch.",
    at: [0, 0.4, 42],
  },
];
const FOUND_KEY = "uluru-found-v1";
const found = new Set();
try {
  JSON.parse(localStorage.getItem(FOUND_KEY) || "[]").forEach((id) =>
    found.add(id),
  );
} catch (_) {}
let activeDiscovery = null,
  gazeT = 0,
  met = false,
  noteOpen = false,
  discoveryChapterNow = -1;
const glowCanvas = document.createElement("canvas");
glowCanvas.width = glowCanvas.height = 64;
{
  const g = glowCanvas.getContext("2d"),
    grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,242,200,1)");
  grad.addColorStop(0.35, "rgba(255,214,140,0.55)");
  grad.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
}
const glowTex = new THREE.CanvasTexture(glowCanvas);
const marker = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }),
);
marker.scale.setScalar(2.6);
marker.visible = false;
scene.add(marker);
/* night only: the plain remembers a touch - small planted lights */
const planted = [];
const LIGHT_CAP = 80;
function plantLight(x, z, calm) {
  if (planted.length >= LIGHT_CAP) {
    const old = planted.shift();
    scene.remove(old);
    old.material.dispose();
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: ["#fff2c8", "#ffd9a0", "#d9c8ff"][planted.length % 3],
    }),
  );
  s.position.set(x, ground(x, z) + 0.25, z);
  s.scale.setScalar(0.9 + Math.random() * 0.7);
  s.userData.born = performance.now() / 1000;
  s.userData.calm = calm;
  scene.add(s);
  planted.push(s);
}
const note = document.querySelector("#note"),
  noteTitle = document.querySelector("#note-title"),
  noteBody = document.querySelector("#note-body"),
  journeyText = document.querySelector("#journey-text"),
  resetOrb = document.querySelector("#reset-orb");
const allFound = () => found.size >= DISCOVERIES.length;
function chapterDone(j) {
  return DISCOVERIES.filter((d) => d.chapter === j).every((d) =>
    found.has(d.id),
  );
}
function refreshDial() {
  buttons.forEach((b, j) => b.classList.toggle("done", chapterDone(j)));
}
function pickActive() {
  activeDiscovery =
    DISCOVERIES.find((d) => d.chapter === chapter && !found.has(d.id)) || null;
  gazeT = 0;
  met = false;
  marker.visible = !!activeDiscovery;
  if (activeDiscovery) marker.position.fromArray(activeDiscovery.at);
  canvas.dataset.discovery = activeDiscovery ? activeDiscovery.id : "";
}
function discoverySetChapter(i) {
  if (i === discoveryChapterNow) return; // resize re-enters setChapter
  discoveryChapterNow = i;
  closeNote();
  pickActive();
}
function openNote(d) {
  if (!d || noteOpen) return;
  noteOpen = true;
  met = true;
  found.add(d.id);
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify([...found]));
  } catch (_) {}
  marker.material.opacity = 0.35;
  noteTitle.textContent = d.title;
  noteBody.textContent = d.body;
  journeyText.style.visibility = "hidden";
  note.hidden = false;
  refreshDial();
  canvas.dataset.found = String(found.size);
}
function closeNote() {
  if (!noteOpen) return;
  noteOpen = false;
  note.hidden = true;
  journeyText.style.visibility = "";
  const c = chapters[chapter];
  caption.textContent = c.caption;
  detail.textContent = allFound()
    ? "Every quiet thing found. The day is still yours to walk."
    : c.detail;
  resetOrb.querySelector("span").textContent = allFound()
    ? "Begin again"
    : "Reset";
  resetOrb.setAttribute(
    "aria-label",
    allFound() ? "Begin the journey again" : "Reset this view",
  );
  pickActive();
}
document.querySelector("#note-close").addEventListener("click", closeNote);
note.addEventListener("click", (e) => {
  if (e.target === note) closeNote();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNote();
});
resetOrb.addEventListener("click", () => {
  if (!allFound()) return;
  found.clear();
  try {
    localStorage.removeItem(FOUND_KEY);
  } catch (_) {}
  planted.splice(0).forEach((s) => {
    scene.remove(s);
    s.material.dispose();
  });
  refreshDial();
  pickActive();
  canvas.dataset.found = String(found.size);
  detail.textContent = chapters[chapter].detail;
  resetOrb.querySelector("span").textContent = "Reset";
  resetOrb.setAttribute("aria-label", "Reset this view");
});
/* touch the glimmer to read; at night, touch the plain to plant a light */
const tapRay = new THREE.Raycaster();
canvas.addEventListener("pointerup", (e) => {
  if (moved >= 12 || noteOpen) return;
  if (activeDiscovery && marker.visible) {
    const mx = +canvas.dataset.markerX,
      my = +canvas.dataset.markerY;
    if (
      Number.isFinite(mx) &&
      Math.hypot(e.clientX - mx, e.clientY - my) < 64
    ) {
      openNote(activeDiscovery);
      return;
    }
  }
  if (chapter !== 3) return;
  tapRay.setFromCamera(
    new THREE.Vector2(
      (e.clientX / innerWidth) * 2 - 1,
      -((e.clientY / innerHeight) * 2 - 1),
    ),
    camera,
  );
  const dir = tapRay.ray.direction;
  if (dir.y >= -0.01) return;
  const t = (0.2 - camera.position.y) / dir.y,
    hx = camera.position.x + dir.x * t,
    hz = camera.position.z + dir.z * t;
  if (t > 0 && t < 500 && Math.hypot(hx, hz) < 420) plantLight(hx, hz, false);
});
const gazeV = new THREE.Vector3();
let clockT = 0;
function discoveryTick(dt) {
  clockT += dt;
  for (const s of planted) {
    s.material.opacity = Math.min(
      0.85,
      s.material.opacity + dt * (s.userData.calm ? 0.4 : 1.6),
    );
    if (!reduced && !s.userData.calm)
      s.material.opacity =
        s.material.opacity * 0.97 +
        (0.62 + 0.2 * Math.sin(clockT * 1.7 + s.userData.born)) * 0.03;
  }
  canvas.dataset.lights = String(planted.length);
  if (!activeDiscovery || noteOpen) {
    marker.material.opacity = noteOpen ? 0.35 : marker.material.opacity;
    return;
  }
  marker.material.opacity = met
    ? 0.95
    : 0.55 + (reduced ? 0 : 0.2 * Math.sin(clockT * 2.1));
  if (!reduced) {
    const p = 1 + 0.1 * Math.sin(clockT * 2.1);
    marker.scale.setScalar(2.6 * p);
  }
  gazeV.fromArray(activeDiscovery.at).project(camera);
  const behind = gazeV.z > 1 || gazeV.z < -1;
  const sx = (gazeV.x * 0.5 + 0.5) * innerWidth,
    sy = (-gazeV.y * 0.5 + 0.5) * innerHeight;
  canvas.dataset.markerX = behind ? "" : sx.toFixed(1);
  canvas.dataset.markerY = behind ? "" : sy.toFixed(1);
  if (behind || drag) {
    gazeT = 0;
    return;
  }
  const gazeR = Math.hypot(sx - innerWidth / 2, sy - innerHeight / 2);
  if (gazeR < Math.min(innerWidth, innerHeight) * 0.16) {
    gazeT += dt;
    if (!met && gazeT > 0.9) {
      met = true;
      caption.textContent = activeDiscovery.title;
      detail.textContent = activeDiscovery.invite;
      if (activeDiscovery.id === "lights" && !planted.length)
        plantLight(...activeDiscovery.at.slice(0, 3).filter((_, i) => i !== 1), true);
    }
  } else {
    gazeT = 0;
  }
}
/* the glimmer is keyboard-reachable too: focus the world, press Enter */
canvas.tabIndex = 0;
canvas.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && activeDiscovery && !noteOpen) {
    e.preventDefault();
    openNote(activeDiscovery);
  }
});
refreshDial();
pickActive();
canvas.dataset.found = String(found.size);

setChapter(0);
resize();
function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const c = chapters[chapter],
    k = reduced ? 1 : 1 - Math.exp(-dt * 2);
  if (!drag && !reduced) {
    // release-only glide: nothing turns while a finger holds the world
    yaw += yawVel * dt;
    yawVel *= Math.exp(-3.6 * dt);
    if (Math.abs(yawVel) < 0.002) yawVel = 0;
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
  discoveryTick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
setTimeout(() => document.querySelector("#veil").classList.add("gone"), 450);

// Place-true chrome: the controls greet, retire, and visit when called.
{
  const body = document.body,
    top = document.querySelector("#masthead"),
    bottom = [document.querySelector("#orbs"), document.querySelector("#dial")],
    pin = document.querySelector("#pin-chrome"),
    hint = document.querySelector("#chrome-hint"),
    KEY = "uluru-chrome-pin",
    GREET = 2600;
  let pinned = false,
    timer = 0,
    zone = false;
  try {
    pinned = localStorage.getItem(KEY) === "1";
  } catch (_) {}
  const ui = [top, ...bottom];
  const held = () =>
    zone || ui.some((el) => el.matches(":focus-within") || el.matches(":hover"));
  const show = () => {
    clearTimeout(timer);
    body.classList.add("chrome-on");
    if (!pinned) timer = setTimeout(retire, GREET);
  };
  const retire = () => {
    if (pinned) return;
    if (held()) {
      timer = setTimeout(retire, GREET);
      return;
    }
    body.classList.remove("chrome-on");
    const a = document.activeElement;
    if (a && ui.some((el) => el.contains(a))) a.blur();
  };
  const setPin = (v) => {
    pinned = v;
    pin.setAttribute("aria-pressed", String(v));
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch (_) {}
    v ? (clearTimeout(timer), body.classList.add("chrome-on")) : show();
  };
  pin.addEventListener("click", () => setPin(!pinned));
  hint.addEventListener("click", () => {
    show();
    pin.focus({ preventScroll: true });
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    zone = e.clientY < 96 || e.clientY > innerHeight - 150;
    if (zone) show();
  });
  document.addEventListener("pointerleave", () => (zone = false));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pinned) {
      zone = false;
      body.classList.remove("chrome-on");
      clearTimeout(timer);
      const a = document.activeElement;
      if (a && ui.some((el) => el.contains(a))) a.blur();
    } else if (e.key === "Tab") show();
  });
  ui.forEach((el) =>
    el.addEventListener("pointerdown", () => {
      if (!pinned) show();
    }),
  );
  document
    .querySelector("#next-moment")
    .addEventListener("click", () => setChapter((chapter + 1) % chapters.length));
  pin.setAttribute("aria-pressed", String(pinned));
  body.classList.add("chrome-on");
  if (!pinned) timer = setTimeout(retire, GREET + 450);
}
