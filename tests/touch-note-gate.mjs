import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
});
const read = (p) =>
  p.evaluate(() => {
    const c = document.querySelector("canvas");
    return {
      mx: parseFloat(c.dataset.markerX),
      my: parseFloat(c.dataset.markerY),
      discovery: c.dataset.discovery,
      hidden: document.querySelector("#note").hidden,
      found: +(c.dataset.found || 0),
    };
  });
async function aim(p, w, h) {
  let flip = 1;
  for (let i = 0; i < 30; i++) {
    const s = await read(p);
    if (!Number.isFinite(s.mx)) continue;
    const dx = s.mx - w / 2, dy = s.my - h / 2;
    if (Math.hypot(dx, dy) < 30) break;
    await p.mouse.move(w / 2, h / 2);
    await p.mouse.down();
    await p.mouse.move(w / 2 + dx * 0.6 * flip, h / 2 + dy * 0.6 * flip, { steps: 3 });
    await new Promise((r) => setTimeout(r, 110));
    await p.mouse.up();
    const s2 = await read(p);
    if (Math.hypot(s2.mx - w / 2, s2.my - h / 2) > Math.hypot(dx, dy) + 40) flip *= -1;
  }
}
try {
  const p = await browser.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.setViewport({ width: 390, height: 844, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem("uluru-chrome-pin", "1");
    localStorage.setItem(
      "uluru-found-v1",
      '["blush","green-sea","first-voices","water-writing","hidden-rock","many-heads","burning-face","shift-change","southern-cross","the-cold","first-people"]',
    );
  });
  await p.goto("http://127.0.0.1:8792");
  await p.waitForSelector("#veil.gone");
  await p.tap('[data-scene="3"]');
  await new Promise((r) => setTimeout(r, 1200));
  let s = await read(p);
  assert.equal(s.discovery, "lights");
  await aim(p, 390, 844);
  await new Promise((r) => setTimeout(r, 1200));
  s = await read(p);
  await p.touchscreen.tap(s.mx, s.my); // the failing touch path
  await new Promise((r) => setTimeout(r, 600));
  s = await read(p);
  assert.equal(s.hidden, false, "touch tap opens the lights note and it STAYS open");
  assert.equal(s.found, 12);
  // and the note must not sit under the tap point
  const rect = await p.evaluate(() => {
    const n = document.querySelector("#note").getBoundingClientRect();
    return { l: n.left, t: n.top, r: n.right, b: n.bottom };
  });
  await p.screenshot({ path: "verification/note-design/390-touch-lights.png" });
  assert.deepEqual(errs, []);
  await p.close();
  console.log("touch-note gate: lights note stays open on touch");
} finally {
  await browser.close();
}
