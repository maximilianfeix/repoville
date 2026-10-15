// E2E: open a rendered city.html from file://, wait for all chunks, measure fps, check the screenshot is not blank.
// Usage: npx tsx test/e2e/viewer-check.ts <city.html> [screenshot.png] [--max-mb 5] [--min-fps 55]
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name: string, def: number) => {
  const i = args.indexOf(name);
  return i === -1 ? def : Number(args[i + 1]);
};
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const html = resolve(positional[0]!);
const shot = positional[1] ? resolve(positional[1]) : null;
const maxMb = flag('--max-mb', 5);
const minFps = flag('--min-fps', 0);

const mb = statSync(html).size / 1024 / 1024;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await page.goto(pathToFileURL(html).href);
await page.waitForFunction('window.__repoville && window.__repoville.ready === true', null, { timeout: 120_000 });
const readyMs = Date.now() - t0;
// Measure frame rate over 3 seconds while the camera orbits.
// Passed as a string: tsx would otherwise inject helpers that do not exist in the page.
const fps = (await page.evaluate(`new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  const tick = () => {
    frames++;
    if (performance.now() - start < 3000) requestAnimationFrame(tick);
    else resolve((frames * 1000) / (performance.now() - start));
  };
  requestAnimationFrame(tick);
})`)) as number;
const stats = (await page.evaluate('window.__repoville')) as { quads: number; buildings: number } | undefined;
const png = await page.screenshot();
if (shot) writeFileSync(shot, png);
await browser.close();

// Count distinct colours in the PNG's raw scanlines as a "not blank" check.
function distinctColors(buf: Buffer): number {
  let off = 8;
  let width = 0, height = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4 + 1;
  const seen = new Set<number>();
  for (let y = 0; y < height; y += 7) for (let x = 0; x < width; x += 7) {
    const i = y * stride + 1 + x * 4;
    seen.add((raw[i]! << 16) | (raw[i + 1]! << 8) | raw[i + 2]!);
  }
  return seen.size;
}
const colors = distinctColors(png);
const result = { file: html, sizeMB: Number(mb.toFixed(2)), readyMs, fps: Math.round(fps), quads: stats?.quads, buildings: stats?.buildings, distinctColors: colors, errors };
console.log(JSON.stringify(result, null, 2));
const fail = [
  mb > maxMb && `file is ${mb.toFixed(2)} MB > ${maxMb} MB`,
  colors < 50 && `screenshot looks blank (${colors} colours)`,
  fps < minFps && `fps ${fps.toFixed(0)} < ${minFps}`,
  errors.length && `page errors: ${errors.join('; ')}`,
].filter(Boolean);
if (fail.length) {
  console.error('FAILED: ' + fail.join(', '));
  process.exit(1);
}
console.log('viewer check passed');
void readFileSync;
