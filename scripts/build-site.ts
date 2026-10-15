// Builds the GitHub Pages site into site-dist/: landing page, real demo cities and real screenshots.
// Usage: npx tsx scripts/build-site.ts [--skip-render]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'site-dist');
const CACHE = join(ROOT, '.cache', 'site-renders');
export const DEMOS = [
  { slug: 'facebook/react', target: 'facebook/react', blurb: 'JavaScript · 7k files' },
  { slug: 'torvalds/linux', target: 'torvalds/linux', blurb: 'C · 96k files, folded into 4k buildings' },
  { slug: 'BurntSushi/ripgrep', target: 'BurntSushi/ripgrep', blurb: 'Rust · the nether district' },
  { slug: 'junegunn/fzf', target: 'junegunn/fzf', blurb: 'Go · frozen peaks' },
  { slug: 'pallets/flask', target: 'pallets/flask', blurb: 'Python · jungle' },
  { slug: 'maximilianfeix/repoville', target: ROOT, blurb: 'TypeScript · this project' },
];

const skip = process.argv.includes('--skip-render');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'media'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const meta: Array<{ slug: string; blurb: string; stats: string }> = [];
for (const d of DEMOS) {
  const dir = join(CACHE, d.slug.replace('/', '__'));
  const html = join(dir, 'city.html');
  if (!skip || !existsSync(html)) {
    rmSync(dir, { recursive: true, force: true });
    const log = execFileSync('node', [join(ROOT, 'dist', 'cli.js'), d.target, '-o', dir, '--format', 'html'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    void log;
    const produced = execFileSync('ls', [dir]).toString().split('\n').find((f) => f.endsWith('.html'))!;
    cpSync(join(dir, produced), html);
  }
  const page = readFileSync(html, 'utf8');
  const desc = /<meta name="description" content="([^"]+)">/.exec(page)?.[1] ?? '';
  meta.push({ slug: d.slug, blurb: d.blurb, stats: desc.replace(/&#\d+;/g, '') });
  const dest = join(OUT, 'r', d.slug);
  mkdirSync(dest, { recursive: true });
  cpSync(html, join(dest, 'index.html'));
}

// Real screenshots of the real viewer.
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function shot(slug: string, file: string, w: number, h: number, query = 'ui=off&quality=high', hash = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(OUT, 'r', slug, 'index.html')).href + `?${query}` + (hash ? `#${hash}` : ''));
  await page.waitForFunction('window.__repoville && window.__repoville.ready', null, { timeout: 180_000 });
  await page.waitForTimeout(query.includes('mc=1') ? 7000 : hash ? 2600 : 1200);
  await page.screenshot({ path: join(OUT, 'media', file), type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 86 : undefined });
  await page.close();
}
await shot('facebook/react', 'hero-react.jpg', 1920, 1080, 'ui=off&quality=high', 'f=packages/react-reconciler');
await shot('facebook/react', 'react-ui.jpg', 1440, 900, 'quality=high');
await shot('torvalds/linux', 'linux.jpg', 1280, 800);
await shot('BurntSushi/ripgrep', 'ripgrep.jpg', 1280, 800);
await shot('junegunn/fzf', 'fzf.jpg', 1280, 800);
await shot('pallets/flask', 'flask.jpg', 1280, 800);
await shot('facebook/react', 'react-clean.jpg', 1440, 900, 'ui=off&quality=high', 'f=packages/react-dom');
await shot('maximilianfeix/repoville', 'repoville.jpg', 1280, 800);
await shot('facebook/react', 'react-churn.jpg', 1280, 800, 'ui=off&view=churn&quality=low', 'f=packages');
await shot('BurntSushi/ripgrep', 'ripgrep-closeup.jpg', 1440, 900, 'ui=off&quality=high', 'f=README.md');
await shot('BurntSushi/ripgrep', 'ripgrep-mc.jpg', 1440, 900, 'ui=off&quality=high&mc=1', 'f=README.md');
// Social preview 1280×640 composed from the real hero render.
{
  const hero = readFileSync(join(OUT, 'media', 'hero-react.jpg')).toString('base64');
  const mark = readFileSync(join(ROOT, 'assets', 'brand', 'mark.svg')).toString('base64');
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&family=JetBrains+Mono:wght@500&family=Silkscreen&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:1280px;height:640px;overflow:hidden;background:#191b20;position:relative;font-family:Inter">
  <img src="data:image/jpeg;base64,${hero}" style="position:absolute;right:-120px;top:-40px;width:1180px;height:720px;object-fit:cover;object-position:60% 50%">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,#191b20 0%,#191b20 30%,rgba(25,27,32,.6) 52%,rgba(25,27,32,0) 70%)"></div>
  <div style="position:absolute;left:72px;top:150px;color:#F6F1E4">
    <div style="display:flex;align-items:center;gap:16px;font:400 34px Silkscreen"><img src="data:image/svg+xml;base64,${mark}" width="64" height="64">repoville</div>
    <div style="font:800 76px/1 Inter;letter-spacing:-2.5px;margin:34px 0 22px;max-width:560px">Walk your<br>codebase.</div>
    <div style="font:500 22px/1.4 'JetBrains Mono';color:#E8D9A8;max-width:520px">Any Git repo as a voxel city.<br>Folders are districts, files are buildings.</div>
  </div>
  <div style="position:absolute;left:72px;bottom:44px;font:500 18px 'JetBrains Mono';color:rgba(246,241,228,.7)">github.com/maximilianfeix/repoville</div>
  </body></html>`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'media', 'social.png') });
  await page.close();
}
await browser.close();

cpSync(join(ROOT, 'site'), OUT, { recursive: true });
cpSync(join(ROOT, 'assets', 'brand'), join(OUT, 'brand'), { recursive: true });
writeFileSync(join(OUT, 'demos.json'), JSON.stringify(meta, null, 2));
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`site built in ${OUT}`);
