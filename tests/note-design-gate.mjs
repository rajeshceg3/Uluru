import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "verification/note-design";
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
});
const read = (p) =>
  p.evaluate(() => {
    const c = document.querySelector("canvas");
    const n = document.querySelector("#note").getBoundingClientRect();
    const rk = (c.dataset.rockRect || "0,0,0,0").split(",").map(Number);
    return {
      mx: parseFloat(c.dataset.markerX),
      my: parseFloat(c.dataset.markerY),
      note: { l: n.left, t: n.top, r: n.right, b: n.bottom },
      rock: { l: rk[0], t: rk[1], r: rk[2], b: rk[3] },
      leader: document.querySelector("#leader path").getAttribute("d"),
      hidden: document.querySelector("#note").hidden,
    };
  });
const overlap = (a, b) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) *
  Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
async function aimAndOpen(p, w, h) {
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
  await new Promise((r) => setTimeout(r, 1200));
  const s = await read(p);
  await p.mouse.click(s.mx, s.my);
  await new Promise((r) => setTimeout(r, 350));
}
try {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const p = await browser.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.setViewport({ width: w, height: h });
    await p.evaluateOnNewDocument(() => {
      localStorage.setItem("uluru-chrome-pin", "1");
      localStorage.removeItem("uluru-found-v1");
    });
    await p.goto("http://127.0.0.1:8792");
    await p.waitForSelector("#veil.gone");
    await new Promise((r) => setTimeout(r, 800));
    // blush (marker on the crown)
    await aimAndOpen(p, w, h);
    let s = await read(p);
    assert.equal(s.hidden, false);
    assert.equal(overlap(s.note, s.rock), 0, `note covers rock: ${JSON.stringify(s)}`);
    assert.ok(s.leader.startsWith("M "), "leader tether drawn");
    assert.ok(s.note.r <= w - 11 && s.note.b <= h - 11, "note on screen");
    await p.screenshot({ path: `${out}/${w}-note-blush.png` });
    await p.keyboard.press("Escape");
    // green-sea (marker on the plain)
    await new Promise((r) => setTimeout(r, 400));
    await aimAndOpen(p, w, h);
    s = await read(p);
    assert.equal(overlap(s.note, s.rock), 0, `plain note covers rock: ${JSON.stringify(s)}`);
    await p.screenshot({ path: `${out}/${w}-note-plain.png` });
    await p.keyboard.press("Escape");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("note-design gate: all checks passed");
} finally {
  await browser.close();
}
