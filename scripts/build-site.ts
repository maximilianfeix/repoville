// Builds the GitHub Pages site into site-dist/: landing page, real demo cities and real screenshots.
// Usage: npx tsx scripts/build-site.ts [--skip-render]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { DEFAULTS } from '../src/config.js';
import { render } from '../src/render.js';
import { resolveSource } from '../src/source/resolve.js';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'site-dist');
const CACHE = join(ROOT, '.cache', 'site-renders');
export const DEMOS = [
  { slug: 'facebook/react', target: 'facebook/react', blurb: 'JavaScript · 7k files' },
  { slug: 'torvalds/linux', target: 'torvalds/linux', blurb: 'C · 96k files, folded into 4k buildings' },
  { slug: 'BurntSushi/ripgrep', target: 'BurntSushi/ripgrep', blurb: 'Rust · the nether district' },
  { slug: 'junegunn/fzf', target: 'junegunn/fzf', blurb: 'Go · frozen peaks' },
  { slug: 'pallets/flask', target: 'pallets/flask', blurb: 'Python · jungle' },
  { slug: 'maximilianfeix/repoville', target: ROOT, blurb: 'TypeScript · this project', extra: ['--timelapse'] },
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
    const log = execFileSync('node', [join(ROOT, 'dist', 'cli.js'), d.target, '-o', dir, '--format', 'html', ...((d as { extra?: string[] }).extra ?? [])], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
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

// Inspection strip: three real React files (a small, quiet file; a busy file; the largest
// reconciler file), with facts read from the same render the demo city comes from.
interface Inspect { key: string; label: string; path: string; lines: number; commits: number; todos: number; last: string; height: number; style: string; fire: number; mossy: boolean }
const inspect: Inspect[] = [];
let reactHead = '';
{
  const src = await resolveSource('facebook/react', { historyDays: 3 * 365 });
  const res = await render(src, { ...DEFAULTS, out: join(CACHE, 'inspect-tmp'), formats: ['schem'] });
  reactHead = (res.city.head ?? '').slice(0, 7);
  const facts = res.built.buildings.filter((b) => !b.merged && b.kind === 'tower');
  const day = (t: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : 'unknown');
  const pick = (key: string, label: string, b: (typeof facts)[number] | undefined) => {
    if (!b) throw new Error(`inspect: no building for ${key}`);
    inspect.push({ key, label, path: b.path, lines: b.loc, commits: b.churn, todos: b.todos, last: day(b.lastTouched), height: b.height, style: b.style, fire: b.fire, mossy: b.mossy });
  };
  const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : 1);
  const code = facts.filter((b) => !/__mocks__|__tests__|fixtures/.test(b.path) && (b.lang === 'javascript' || b.lang === 'typescript') && b.style !== 'testlab' && b.style !== 'lighthouse');
  pick('busy', 'The busiest file', [...code].sort((a, b) => b.churn - a.churn || byPath(a, b))[0]);
  pick('ruins', 'Most TODO markers', [...code].filter((b) => b.path !== inspect[0]!.path).sort((a, b) => b.todos - a.todos || byPath(a, b))[0]);
  pick('quiet', 'A quiet corner', [...code].filter((b) => b.lastTouched && b.loc >= 150).sort((a, b) => a.lastTouched! - b.lastTouched! || byPath(a, b))[0]);
}

// Real screenshots of the real viewer.
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function shot(slug: string, file: string, w: number, h: number, query = 'ui=off&quality=high', hash = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(OUT, 'r', slug, 'index.html')).href + `?${query}` + (hash ? `#${hash}` : ''));
  await page.waitForFunction('window.__repoville && window.__repoville.ready', null, { timeout: 180_000 });
  await page.waitForTimeout(query.includes('mc=1') ? 7000 : hash ? 2600 : 1200);
  await page.screenshot({ timeout: 120_000, path: join(OUT, 'media', file), type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 86 : undefined });
  await page.close();
}
for (const i of inspect) await shot('facebook/react', `inspect-${i.key}.jpg`, 1400, 900, 'ui=off&quality=high', `f=${encodeURIComponent(i.path)}`);
await shot('facebook/react', 'hero-react.jpg', 1920, 1080, 'ui=off&quality=high', 'f=packages/react-reconciler');
await shot('facebook/react', 'react-ui.jpg', 1440, 900, 'quality=high');
await shot('torvalds/linux', 'linux.jpg', 1280, 800);
await shot('BurntSushi/ripgrep', 'ripgrep.jpg', 1280, 800);
await shot('junegunn/fzf', 'fzf.jpg', 1280, 800);
await shot('pallets/flask', 'flask.jpg', 1280, 800);
await shot('facebook/react', 'react-clean.jpg', 1440, 900, 'ui=off&quality=high', 'f=packages/react-dom');
await shot('maximilianfeix/repoville', 'repoville.jpg', 1280, 800);
await shot('facebook/react', 'react-churn.jpg', 1280, 800, 'ui=off&view=churn&quality=low', 'f=packages/react-reconciler');
await shot('facebook/react', 'hero-portrait.jpg', 900, 1125, 'ui=off&quality=high', 'f=packages/react-reconciler');
await shot('facebook/react', 'react-night.jpg', 1440, 900, 'ui=off&quality=high&time=night', 'f=packages/react-reconciler/src/ReactFiberWorkLoop.js');
await shot('BurntSushi/ripgrep', 'ripgrep-closeup.jpg', 1440, 900, 'ui=off&quality=high', 'f=README.md');
await shot('BurntSushi/ripgrep', 'ripgrep-mc.jpg', 1440, 900, 'ui=off&quality=high&mc=1', 'f=README.md');
// Social preview 1280×640 from a real render, in the site's paper style.
{
  const shotB64 = readFileSync(join(OUT, 'media', `inspect-${inspect[0]!.key}.jpg`)).toString('base64');
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:1280px;height:640px;overflow:hidden;background:#F6F3EC;color:#20231F;display:grid;grid-template-columns:560px 1fr">
  <div style="padding:64px 0 56px 72px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:12px;font:800 30px 'Bricolage Grotesque'"><svg width="30" height="30" viewBox="0 0 24 24"><rect x="2" y="12" width="6" height="10" fill="#596057"/><rect x="9" y="4" width="6" height="18" fill="#20231F"/><rect x="16" y="9" width="6" height="13" fill="#356449"/></svg>repoville</div>
    <div style="font:800 92px/.92 'Bricolage Grotesque';letter-spacing:-4px;margin-top:auto">See your repo as a city.</div>
    <div style="font:500 19px/1.4 'JetBrains Mono';color:#596057;margin-top:34px">github.com/maximilianfeix/repoville</div>
  </div>
  <img src="data:image/jpeg;base64,${shotB64}" style="width:100%;height:640px;object-fit:cover;object-position:50% 45%">
  </body></html>`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, 'media', 'social.png') });
  await page.close();
}
await browser.close();

cpSync(join(ROOT, 'site'), OUT, { recursive: true });
cpSync(join(ROOT, 'assets', 'brand'), join(OUT, 'brand'), { recursive: true });
writeFileSync(join(OUT, 'demos.json'), JSON.stringify(meta, null, 2));
writeFileSync(join(OUT, 'inspect.json'), JSON.stringify({ repo: 'facebook/react', head: reactHead, files: inspect }, null, 2));
{
  // Fill the landing page from the same data, so the page also works without JavaScript.
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v: number) => v.toLocaleString('en-US');
  const facts = (i: Inspect) => [
    ['Lines', n(i.lines)], ['Height', `${i.height} blocks`], ['Commits, last year', n(i.commits)],
    ['TODO markers', n(i.todos)], ['Last change', i.last], ['Building', i.style],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const tabs = inspect.map((i, k) => `<button type="button" role="tab" aria-selected="${k === 0}" data-k="${k}"><span>${esc(i.label)}</span><code><i>${esc(i.path.slice(0, i.path.lastIndexOf('/') + 1))}</i><b>${esc(i.path.slice(i.path.lastIndexOf('/') + 1))}</b></code></button>`).join('');
  const first = inspect[0]!;
  const viewer = (i: Inspect) => `r/facebook/react/#f=${encodeURIComponent(i.path)}`;
  const strip = `<div class="inspect" data-files='${esc(JSON.stringify(inspect.map((i) => ({ ...i, facts: facts(i), href: viewer(i) }))))}'>
    <div class="pick" role="tablist" aria-label="Pick a file">${tabs}</div>
    <figure><a class="shot" href="${viewer(first)}"><img src="media/inspect-${first.key}.jpg" width="1400" height="900" alt="${esc(first.path)} as a building in the React city"></a>
    <figcaption><dl>${facts(first)}</dl><a class="open" href="${viewer(first)}">Open this building →</a></figcaption></figure>
  </div>
  <p class="prov">facebook/react at <code>${esc(reactHead)}</code>, rendered with repoville defaults. Commits counted over the last year.</p>`;
  const rows = meta.filter((d) => d.slug !== 'facebook/react').map((d) => {
    const file = d.slug.split('/')[1]!.toLowerCase();
    return `<a class="row" href="r/${d.slug}/"><img src="media/${file === 'linux' ? 'linux' : file}.jpg" alt="" loading="lazy" width="1280" height="800"><span class="nm">${esc(d.slug)}</span><span class="st">${esc(d.blurb.split(' · ')[0]!)} · ${esc(d.stats.replace(/^.*?: /, '').replace(/ of code\.$/, ''))}</span><span class="go">Open →</span></a>`;
  }).join('');
  let page = readFileSync(join(OUT, 'index.html'), 'utf8');
  page = page.replace('<!--INSPECT-->', strip).replace('<!--DEMOS-->', rows);
  writeFileSync(join(OUT, 'index.html'), page);
}
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`site built in ${OUT}`);
