// owns: fixed-pose golden screenshot capture and pixelmatch comparison (SwiftShader path only).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { launch, startServer } from "../tests/lib.mjs";

const THRESHOLD = 0.1; // per-pixel colour distance passed to pixelmatch
const MAX_DIFF_RATIO = 0.001; // fraction of differing pixels allowed
const goldenDir = resolve("tests/goldens");
const outDir = resolve("test-results");
await mkdir(outDir, { recursive: true });
const allPoses = JSON.parse(await readFile(resolve(goldenDir, "poses.json"), "utf8"));
// GOLDENS_ONLY=a,b limits the run to named poses (verification of a recapture under load).
const only = process.env.GOLDENS_ONLY ? new Set(process.env.GOLDENS_ONLY.split(",")) : null;
const poses = only ? Object.fromEntries(Object.entries(allPoses).filter(([n]) => only.has(n))) : allPoses;

const { server, url } = await startServer();
const browser = await launch();
let failed = 0;
try {
  for (const [name, p] of Object.entries(poses)) {
    const page = await browser.newPage({ viewport: { width: p.width, height: p.height } });
    page.setDefaultTimeout(180000);
    await page.goto(p.page ? new URL(p.page, url).href : url);
    await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
    await page.evaluate((p) => {
      const h = window.__hohenfeuer;
      if (h.setPose) return h.setPose(p);
      const { camera } = h;
      camera.position.set(...p.position);
      camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
    }, p);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    let shot;
    for(let attempt=0;attempt<3;attempt++) {
      try { shot=await page.screenshot({timeout:180000});break; }
      catch(error) { if(attempt===2)throw error;console.log(`${name}: screenshot retry ${attempt+1}`); }
    }
    await page.close();
    const goldenPath = resolve(goldenDir, `${name}.png`);
    if (!existsSync(goldenPath)) {
      await writeFile(goldenPath, shot);
      console.log(`${name}: golden written`);
      continue;
    }
    const a = PNG.sync.read(await readFile(goldenPath));
    const b = PNG.sync.read(shot);
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`${name}: FAIL size mismatch`);
      failed++;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
    const ratio = n / (a.width * a.height);
    if (ratio > MAX_DIFF_RATIO) {
      await writeFile(resolve(outDir, `${name}.diff.png`), PNG.sync.write(diff));
      await writeFile(resolve(outDir, `${name}.actual.png`), shot);
      console.log(`${name}: FAIL ${n} px differ (${(ratio * 100).toFixed(3)}%)`);
      failed++;
    } else {
      console.log(`${name}: ok (${n} px differ)`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exitCode = failed ? 1 : 0;
