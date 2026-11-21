import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const read = (p) => p.evaluate(() => { const c = document.querySelector("canvas"); return { mx: parseFloat(c.dataset.markerX), my: parseFloat(c.dataset.markerY) }; });
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument(() => { localStorage.setItem("uluru-chrome-pin", "1"); localStorage.removeItem("uluru-found-v1"); });
  await p.goto("http://127.0.0.1:8792");
  await p.waitForSelector("#veil.gone");
  await new Promise((r) => setTimeout(r, 700));
  let flip = 1;
  for (let i = 0; i < 30; i++) {
    const s = await read(p);
    if (!Number.isFinite(s.mx)) continue;
    const dx = s.mx - w / 2, dy = s.my - h / 2;
    if (Math.hypot(dx, dy) < 30) break;
    await p.mouse.move(w / 2, h / 2); await p.mouse.down();
    await p.mouse.move(w / 2 + dx * 0.6 * flip, h / 2 + dy * 0.6 * flip, { steps: 3 });
    await new Promise((r) => setTimeout(r, 110));
    await p.mouse.up();
    const s2 = await read(p);
    if (Math.hypot(s2.mx - w / 2, s2.my - h / 2) > Math.hypot(dx, dy) + 40) flip *= -1;
  }
  await new Promise((r) => setTimeout(r, 1200));
  const s = await read(p);
  await p.mouse.click(s.mx, s.my);
  await new Promise((r) => setTimeout(r, 400));
  await p.click("#note-deeper");
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: `verification/note-design/${w}-note-deeper.png` });
  await p.close();
}
await browser.close();
console.log("frames done");
