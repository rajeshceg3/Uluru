import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = process.env.OUT || "verification/browser";
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
});
const results = [];
try {
  for (const width of JSON.parse(process.env.WIDTHS || "[320,390,1440]"))
    for (const motion of JSON.parse(
      process.env.MOTIONS || '["reduce","no-preference"]',
    )) {
      const p = await browser.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e)));
      p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await p.setViewport({ width, height: 844 });
      await p.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: motion },
      ]);
      await p.goto(process.env.BASE_URL || "http://127.0.0.1:8792");
      await p.waitForSelector("#veil.gone");
      for (let chapter = 0; chapter < 4; chapter++) {
        await p.click(`[data-scene="${chapter}"]`);
        await new Promise((r) =>
          setTimeout(r, motion === "reduce" ? 300 : 5000),
        );
        await p.mouse.move(width * 0.75, 250);
        await p.mouse.down();
        await p.mouse.move(width * 0.2, 300, { steps: 12 });
        await p.mouse.up();
        await p.click("#reset-orb");
        await new Promise((r) => setTimeout(r, 1000));
        const state = await p.evaluate(() => {
          const c = document.querySelector("canvas");
          return {
            yaw: +c.dataset.yaw,
            pitch: +c.dataset.pitch,
            ey: +c.dataset.entryYaw,
            ep: +c.dataset.entryPitch,
            overflow: document.documentElement.scrollWidth > innerWidth,
            audio: document
              .querySelector("#audio-orb")
              .getAttribute("aria-pressed"),
            chapter: +document.body.dataset.chapter,
            targets: [...document.querySelectorAll("button")].map((b) => {
              const r = b.getBoundingClientRect();
              return {
                w: r.width,
                h: r.height,
                name: b.getAttribute("aria-label"),
              };
            }),
            labels: [...document.querySelectorAll(".stop span")].map((e) => ({
              visible: getComputedStyle(e).opacity,
              font: parseFloat(getComputedStyle(e).fontSize),
            })),
          };
        });
        assert.equal(state.chapter, chapter);
        assert.ok(
          Math.abs(state.yaw - state.ey) < 0.001 &&
            Math.abs(state.pitch - state.ep) < 0.001,
        );
        assert.equal(state.audio, "false");
        assert.equal(state.overflow, false);
        assert.ok(state.targets.every((t) => t.w >= 44 && t.h >= 44 && t.name));
        assert.ok(state.labels.every((t) => +t.visible === 1 && t.font >= 16));
        await p.screenshot({
          path: `${out}/${width}-${motion}-${chapter}.png`,
        });
        results.push({
          width,
          motion,
          chapter,
          resetHeld: true,
          audioOff: true,
          targets: true,
          labels: true,
          overflow: false,
        });
      }
      // Navigation swipe changes exactly one scene; it never rotates the world.
      await p.click('[data-scene="0"]');
      const rect = await p.$eval("#dial", (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width };
      });
      await p.mouse.move(rect.x + rect.w * 0.8, rect.y + 70);
      await p.mouse.down();
      await p.mouse.move(rect.x + rect.w * 0.2, rect.y + 70, { steps: 8 });
      await p.mouse.up();
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(await p.$eval("body", (e) => +e.dataset.chapter), 1);
      await p.keyboard.press("ArrowRight");
      assert.equal(await p.$eval("body", (e) => +e.dataset.chapter), 2);
      assert.deepEqual(errors, []);
      await p.close();
    }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
