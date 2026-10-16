// Records a real flyover of a rendered city and converts it to GIF + MP4 with ffmpeg.
// Usage: npx tsx scripts/record-flyover.ts <city.html> <out-basename> <path1> [path2 …]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const noUi = args.includes('--no-ui');
const extra = args.find((a) => a.startsWith('--query='))?.slice(8) ?? '';
const hold = Number(args.find((a) => a.startsWith('--hold='))?.slice(7) ?? 0);
const [html, out, ...stops] = args.filter((a) => !a.startsWith('--'));
if (!html || !out) throw new Error('usage: record-flyover.ts <city.html> <out> <paths…>');
const dir = mkdtempSync(join(tmpdir(), 'rv-rec-'));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto(pathToFileURL(html).href + '?quality=high' + (noUi ? '&ui=off' : '') + (extra ? `&${extra}` : ''));
await page.waitForFunction('window.__repoville && window.__repoville.ready', null, { timeout: 180_000 });
const t0 = Date.now();
await page.waitForTimeout(1800 + hold);
for (const stop of stops) {
  await page.evaluate(`window.__repoville.focus(${JSON.stringify(stop)})`);
  await page.waitForTimeout(3600);
}
if (!hold) {
  await page.evaluate('window.__repoville.fit()');
  await page.waitForTimeout(2400);
}
const recorded = (Date.now() - t0) / 1000;
await ctx.close();
await browser.close();
const webm = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm'))!);
// Trim the loading part at the start so the clip begins with the finished city.
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString());
const start = Math.max(0, total - recorded);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', webm, '-vf', 'fps=30,scale=1280:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', `${out}.mp4`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', webm, '-vf', 'fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${out}.gif`]);
console.log(`wrote ${out}.mp4 and ${out}.gif (${recorded.toFixed(1)} s)`);
