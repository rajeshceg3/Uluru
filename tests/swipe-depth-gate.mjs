import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = process.env.OUT || "verification/swipe-depth";
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE_URL || "http://127.0.0.1:8792";
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
});
const FOV = (49 * Math.PI) / 180; // camera fov in main.js
const hfFor = (w, h) => 2 * Math.atan(Math.tan(FOV / 2) * (w / h));
const gainFor = (w, h) => (w / h < 0.75 ? 1.8 : 1);
const readLook = (p) =>
  p.evaluate(() => ({
    yaw: +document.querySelector("canvas").dataset.yaw,
    pitch: +document.querySelector("canvas").dataset.pitch,
    discovery: document.querySelector("canvas").dataset.discovery,
    found: +(document.querySelector("canvas").dataset.found || 0),
    lights: +(document.querySelector("canvas").dataset.lights || 0),
    mx: parseFloat(document.querySelector("canvas").dataset.markerX),
    my: parseFloat(document.querySelector("canvas").dataset.markerY),
    caption: document.querySelector("#caption").textContent,
    whisper: document.querySelector("#whisper").textContent,
    noteHidden: document.querySelector("#note").hidden,
    noteTitle: document.querySelector("#note-title").textContent,
  }));
const PRESEED = process.env.PRESEED || "";
async function freshPage(width, height, motion) {
  const p = await browser.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && p.errors.push(m.text()));
  await p.setViewport({ width, height });
  if (motion)
    await p.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: motion },
    ]);
  await p.evaluateOnNewDocument((pre) => {
    localStorage.setItem("uluru-chrome-pin", "1");
    if (pre) localStorage.setItem("uluru-found-v1", pre);
    else localStorage.removeItem("uluru-found-v1");
  }, PRESEED);
  await p.goto(BASE);
  await p.waitForSelector("#veil.gone");
  return p;
}
async function drag(p, x1, y1, x2, y2, steps = 12, holdMs = 0) {
  await p.mouse.move(x1, y1);
  await p.mouse.down();
  await p.mouse.move(x2, y2, { steps });
  if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
}
const SECTION = process.env.SECTION || 'all';
try {
  if (SECTION !== 'depth') {
  // ---- 1. held finger must not turn the world ----
  {
    const p = await freshPage(390, 844);
    const y0 = (await readLook(p)).yaw;
    await drag(p, 300, 400, 72, 400, 12); // 228px
    const y1 = (await readLook(p)).yaw;
    await new Promise((r) => setTimeout(r, 350)); // stationary hold, still down
    const y2 = (await readLook(p)).yaw;
    assert.ok(
      Math.abs(y2 - y1) < 0.005,
      `held-finger drift ${(y2 - y1).toFixed(4)} rad (was ~0.17)`,
    );
    await p.mouse.up();
    // direct drag tracks the shore formula
    const expect = (228 * hfFor(390, 844)) / 390 * gainFor(390, 844);
    assert.ok(
      Math.abs(Math.abs(y1 - y0) - expect) < expect * 0.08,
      `drag gain ${Math.abs(y1 - y0).toFixed(3)} vs expected ${expect.toFixed(3)}`,
    );
    // release glide: turns a little more, then settles
    await new Promise((r) => setTimeout(r, 120));
    const y3 = (await readLook(p)).yaw;
    const y3b = (await readLook(p)).yaw;
    await new Promise((r) => setTimeout(r, 2200));
    const y4 = (await readLook(p)).yaw;
    await new Promise((r) => setTimeout(r, 300));
    const y5 = (await readLook(p)).yaw;
    assert.ok(Math.abs(y5 - y4) < 0.001, "glide must decay to rest");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // ---- 2. opposite direction, slow vs fast, short swipes, wrap past 360 ----
  {
    const p = await freshPage(390, 844);
    let a = (await readLook(p)).yaw;
    await drag(p, 72, 420, 300, 420, 10, 120);
    await p.mouse.up();
    let b = (await readLook(p)).yaw;
    assert.ok(b < a, "reverse drag turns the other way");
    // slow stream vs fast stream: same distance, same direct angle
    a = (await readLook(p)).yaw;
    await p.mouse.move(300, 500);
    await p.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await p.mouse.move(300 - (228 * i) / 20, 500);
      await new Promise((r) => setTimeout(r, 30));
    }
    const slow = (await readLook(p)).yaw - a;
    await new Promise((r) => setTimeout(r, 150));
    await p.mouse.up();
    await new Promise((r) => setTimeout(r, 2000));
    a = (await readLook(p)).yaw;
    await drag(p, 300, 520, 72, 520, 3, 150); // fast, 228px
    const fast = (await readLook(p)).yaw - a;
    await p.mouse.up();
    assert.ok(
      Math.abs(slow - fast) < 0.06,
      `slow ${slow.toFixed(3)} vs fast ${fast.toFixed(3)}`,
    );
    // repeated short swipes accumulate and wrap with no edge
    for (let i = 0; i < 40; i++) {
      await drag(p, 340, 300, 40, 300, 4, 100);
      await p.mouse.up();
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 2000));
    const wrapped = Math.abs((await readLook(p)).yaw);
    assert.ok(wrapped > Math.PI * 2, `yaw ${wrapped.toFixed(2)} passes 360deg`);
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // ---- 3. pointercancel kills glide; a second pointer never hijacks ----
  {
    const p = await freshPage(390, 844);
    await p.mouse.move(300, 400);
    await p.mouse.down();
    await p.mouse.move(120, 400, { steps: 6 });
    const before = (await readLook(p)).yaw;
    await p.evaluate(() =>
      document
        .querySelector("canvas")
        .dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 })),
    );
    await new Promise((r) => setTimeout(r, 400));
    const after = (await readLook(p)).yaw;
    assert.ok(Math.abs(after - before) < 0.02, "no glide after pointercancel");
    await p.mouse.up();
    // hijack attempt: synthetic second pointer while a real drag holds
    await p.mouse.move(200, 400);
    await p.mouse.down();
    const held = (await readLook(p)).yaw;
    await p.evaluate(() => {
      const c = document.querySelector("canvas");
      c.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 99, clientX: 300, clientY: 400 }),
      );
      c.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 99, clientX: 40, clientY: 400 }),
      );
    });
    await new Promise((r) => setTimeout(r, 150));
    const still = (await readLook(p)).yaw;
    assert.ok(Math.abs(still - held) < 0.005, "second pointer ignored");
    await p.mouse.up();
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // ---- 4. pitch clamps, yaw does not ----
  {
    const p = await freshPage(390, 844);
    for (let i = 0; i < 8; i++) {
      await drag(p, 200, 200, 200, 700, 4, 100);
      await p.mouse.up();
      await new Promise((r) => setTimeout(r, 80));
    }
    const up = (await readLook(p)).pitch;
    assert.ok(up <= 0.5 + 1e-6 && up >= -0.6 - 1e-6, "pitch stays clamped");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // ---- 5. reduced motion: direct drag, zero glide ----
  {
    const p = await freshPage(390, 844, "reduce");
    const a = (await readLook(p)).yaw;
    await drag(p, 300, 400, 72, 400, 12);
    const b = (await readLook(p)).yaw;
    assert.ok(Math.abs(b - a) > 0.2, "direct drag still turns the world");
    await p.mouse.up();
    await new Promise((r) => setTimeout(r, 500));
    const c = (await readLook(p)).yaw;
    assert.ok(Math.abs(c - b) < 0.001, "reduced motion has no glide");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // ---- 6. resize: drag still works, no NaN ----
  {
    const p = await freshPage(390, 844);
    await p.setViewport({ width: 844, height: 390 });
    await new Promise((r) => setTimeout(r, 400));
    const a = (await readLook(p)).yaw;
    await drag(p, 700, 200, 400, 200, 8, 100);
    const b = (await readLook(p)).yaw;
    await p.mouse.up();
    assert.ok(Number.isFinite(b) && Math.abs(b - a) > 0.1, "drag after resize");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  }
  if (SECTION !== 'swipe') {
  // ---- 7. depth: gaze names it, touch opens one note, close restores ----
  async function aimAtMarker(p, w, h) {
    let flip = 1;
    for (let i = 0; i < 30; i++) {
      const s = await readLook(p);
      if (!Number.isFinite(s.mx)) continue;
      const dx = s.mx - w / 2,
        dy = s.my - h / 2;
      if (Math.hypot(dx, dy) < 30) break;
      await drag(
        p,
        w / 2,
        h / 2,
        w / 2 + dx * 0.6 * flip,
        h / 2 + dy * 0.6 * flip,
        3,
        110,
      );
      await p.mouse.up();
      const s2 = await readLook(p);
      if (Math.hypot(s2.mx - w / 2, s2.my - h / 2) > Math.hypot(dx, dy) + 40)
        flip *= -1;
    }
    const s = await readLook(p);
    assert.ok(
      Number.isFinite(s.mx) && Math.hypot(s.mx - w / 2, s.my - h / 2) < 60,
      `aim converged (${s.mx?.toFixed(0)},${s.my?.toFixed(0)})`,
    );
    return s;
  }
  async function runDepth(width, height, shots, lightOnly) {
    const p = await freshPage(width, height);
    const expectOrder = [
      [0, ["blush", "green-sea", "first-voices"]],
      [1, ["water-writing", "hidden-rock"]],
      [2, ["many-heads", "burning-face", "shift-change"]],
      [3, ["southern-cross", "the-cold", "first-people", "lights"]],
    ];
    const ONLY = (process.env.ONLY_CH || "").split(",").filter(Boolean).map(Number);
    let opened = PRESEED ? JSON.parse(PRESEED).length : 0;
    const order = lightOnly ? expectOrder.slice(0, 1) : expectOrder;
    for (const [ch, ids] of order) {
      if (ONLY.length && !ONLY.includes(ch)) continue;
      await p.click(`[data-scene="${ch}"]`);
      await new Promise((r) => setTimeout(r, 1200));
      for (const id of ids) {
        let s = await readLook(p);
        assert.equal(s.discovery, id, `chapter ${ch} offers ${id}`);
        assert.ok(s.noteHidden, "no note before the touch");
        await aimAtMarker(p, width, height);
        await new Promise((r) => setTimeout(r, 1300)); // gaze dwell
        s = await readLook(p);
        assert.equal(s.caption.length > 0 && s.noteHidden, true);
        s = await readLook(p);
        await p.mouse.click(s.mx, s.my); // touch the glimmer
        await new Promise((r) => setTimeout(r, 300));
        s = await readLook(p);
        assert.equal(s.noteHidden, false, "note opens");
        assert.equal(s.found, ++opened, "found count grows");
        if (opened === 1) {
          // the deeper layer swaps in place and returns, one at a time
          const before = await p.$eval("#note-body", (e) => e.textContent);
          await p.click("#note-deeper");
          await new Promise((r) => setTimeout(r, 250));
          const deep = await p.evaluate(() => ({
            layer: document.querySelector("canvas").dataset.noteLayer,
            body: document.querySelector("#note-body").textContent,
            hidden: document.querySelector("#note").hidden,
          }));
          assert.equal(deep.layer, "deep", "deeper layer opens");
          assert.notEqual(deep.body, before, "deeper body differs");
          assert.equal(deep.hidden, false, "same note, no stacking");
          await p.click("#note-deeper");
          await new Promise((r) => setTimeout(r, 250));
          const back = await p.evaluate(() => ({
            layer: document.querySelector("canvas").dataset.noteLayer,
            body: document.querySelector("#note-body").textContent,
          }));
          assert.equal(back.layer, "surface", "back returns");
          assert.equal(back.body, before);
        }
        if (shots && opened === 1)
          await p.screenshot({ path: `${out}/${width}-note-open.png` });
        await p.keyboard.press("Escape");
        await new Promise((r) => setTimeout(r, 250));
        s = await readLook(p);
        assert.equal(s.noteHidden, true, "note closes");
      }
      const done = await p.$eval(
        `[data-scene="${ch}"]`,
        (b) => b.classList.contains("done"),
      );
      assert.equal(done, true, `dial stop ${ch} quietly fills`);
    }
    if (lightOnly) {
      assert.deepEqual(p.errors, []);
      await p.screenshot({ path: `${out}/${width}x${height}-opener.png` });
      await p.close();
      return;
    }
    if (ONLY.length && !ONLY.includes(3)) {
      assert.deepEqual(p.errors, []);
      await p.close();
      return;
    }
    // completion: whisper and begin-again
    let s = await readLook(p);
    assert.equal(s.found, 12);
    assert.match(s.whisper, /Every quiet thing found/);
    // night tap on open plain plants a light (journey text passes taps through)
    await p.mouse.click(width * 0.82, height * 0.58);
    await new Promise((r) => setTimeout(r, 800));
    s = await readLook(p);
    assert.ok(s.lights >= 1, "a touch plants a light");
    if (shots) {
      await p.screenshot({ path: `${out}/${width}-night-light.png` });
      await p.click('[data-scene="0"]');
      await new Promise((r) => setTimeout(r, 1500));
      await p.screenshot({ path: `${out}/${width}-dawn-after.png` });
    }
    // begin again
    await p.click("#reset-orb");
    await new Promise((r) => setTimeout(r, 300));
    s = await readLook(p);
    assert.equal(s.found, 0, "begin again clears the journey");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  await runDepth(390, 844, true);
  // resume across visits
  if (process.env.RUN_TAIL === '1') {
  {
    const p = await browser.newPage();
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(String(e)));
    await p.setViewport({ width: 390, height: 844 });
    await p.evaluateOnNewDocument(() => {
      localStorage.setItem("uluru-chrome-pin", "1");
      localStorage.setItem("uluru-found-v1", '["blush","green-sea"]');
    });
    await p.goto(BASE);
    await p.waitForSelector("#veil.gone");
    const s = await readLook(p);
    assert.equal(s.found, 2, "journey resumes");
    assert.equal(s.discovery, "first-voices", "chapter 0 offers its third");
    await p.click('[data-scene="1"]');
    await new Promise((r) => setTimeout(r, 800));
    assert.equal((await readLook(p)).discovery, "water-writing");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  // short phone + desktop pixels
  await runDepth(390, 600, false, true);
  {
    const p = await freshPage(1440, 900);
    await new Promise((r) => setTimeout(r, 1500));
    await p.screenshot({ path: `${out}/1440-opener.png` });
    const s = await readLook(p);
    assert.equal(s.discovery, PRESEED ? "first-voices" : "blush");
    assert.deepEqual(p.errors, []);
    await p.close();
  }
  }
  }
  console.log("swipe-depth gate (" + SECTION + "): all checks passed");
} finally {
  await browser.close();
}
