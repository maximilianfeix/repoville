import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'fflate';
import { colorOf } from '../build/colors.js';
import type { BuiltCity } from '../build/city.js';
import type { VoxelGrid } from '../build/voxel-grid.js';
import type { CityTree } from '../model/city.js';
import type { Highlights } from '../summary.js';
import { encodePayload, type ViewerMeta } from '../../viewer/format.js';

export function kindOf(state: string): number {
  if (state === 'minecraft:air') return 0;
  if (/lantern|campfire|soul_fire|magma|end_rod|glowstone|sea_lantern/.test(state)) return 2;
  if (/glass/.test(state)) return 3;
  if (/vine|cobweb|fence|iron_bars|sign|scaffolding/.test(state)) return 4;
  return 1;
}

/** Column run-length encoding: for each (x, z) in z-major order, a run count then (id, length) pairs; trailing air is dropped. */
export function encodeColumns(grid: VoxelGrid, height: number): Uint16Array {
  const W = grid.width;
  const L = grid.length;
  const row = new Uint16Array(W);
  // Per x in the current z row: list of runs, built y-up.
  let out = new Uint16Array(1 << 20);
  let n = 0;
  const push = (v: number) => {
    if (n === out.length) {
      const bigger = new Uint16Array(out.length * 2);
      bigger.set(out);
      out = bigger;
    }
    out[n++] = v;
  };
  const curId = new Uint16Array(W);
  const curLen = new Uint16Array(W);
  const runs: number[][] = Array.from({ length: W }, () => []);
  for (let z = 0; z < L; z++) {
    for (let x = 0; x < W; x++) {
      runs[x]!.length = 0;
      curLen[x] = 0;
    }
    for (let y = 0; y < height; y++) {
      grid.row(y, z, row);
      for (let x = 0; x < W; x++) {
        const id = row[x]!;
        if (curLen[x] && curId[x] === id && curLen[x]! < 0xffff) curLen[x]!++;
        else {
          if (curLen[x]) runs[x]!.push(curId[x]!, curLen[x]!);
          curId[x] = id;
          curLen[x] = 1;
        }
      }
    }
    for (let x = 0; x < W; x++) {
      const r = runs[x]!;
      if (curLen[x] && curId[x] !== 0) r.push(curId[x]!, curLen[x]!);
      push(r.length / 2);
      for (const v of r) push(v);
    }
  }
  return out.subarray(0, n);
}

function viewerBundle(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, 'viewer.js'), join(here, '..', '..', 'dist', 'viewer.js')]) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
  }
  throw new Error('viewer bundle not found; run `npm run build` first');
}

export interface HtmlInput {
  city: CityTree;
  built: BuiltCity;
  highlights: Highlights;
  since: string;
  generator: string;
  site: string;
  badge: string;
  textured: boolean;
}

export function buildViewerMeta(input: HtmlInput, height: number): ViewerMeta {
  const { city, built } = input;
  const g = built.grid;
  return {
    name: city.name,
    head: city.head,
    headTime: city.headTime,
    since: input.since,
    generator: input.generator,
    site: input.site,
    badge: input.badge,
    width: g.width,
    length: g.length,
    height,
    stats: {
      files: city.stats.files,
      loc: city.stats.loc,
      commits: city.stats.commits,
      buildings: built.buildings.length,
      todos: city.stats.todos,
      languages: city.stats.languages.slice(0, 6),
    },
    highlights: input.highlights,
    colors: g.palette.map(colorOf),
    kinds: g.palette.map(kindOf),
    states: g.palette,
    buildings: built.buildings.map((b) => [
      b.path, b.x0, b.z0, b.x1, b.z1, b.height, b.loc, b.churn, b.todos, b.lastTouched ?? -1, b.fire, b.mossy ? 1 : 0, b.lang, b.style, b.merged ?? 0, b.landmark ? 1 : 0,
    ]),
    districts: built.districts.map((d) => [d.path, d.depth, d.x0, d.z0, d.x1, d.z1]),
    textured: input.textured,
  };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderHtml(input: HtmlInput): string {
  const g = input.built.grid;
  const height = Math.max(1, g.topY());
  const meta = buildViewerMeta(input, height);
  const payload = deflateSync(encodePayload(meta, encodeColumns(g, height)), { level: 9 });
  const data = Buffer.from(payload).toString('base64');
  const title = `${input.city.name} · Repoville`;
  const desc = `${input.city.name} as a walkable city: ${input.city.stats.files.toLocaleString('en-US')} files, ${input.city.stats.loc.toLocaleString('en-US')} lines of code.`;
  // Keep `</script` out of inline scripts.
  const js = viewerBundle().replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="generator" content="${escapeHtml(input.generator)}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&family=Silkscreen&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<canvas id="scene" aria-label="3D view of the city"></canvas>
<div id="ui"></div>
<noscript>This 3D city needs JavaScript.</noscript>
<script id="city-data" type="application/octet-stream">${data}</script>
<script>${js}</script>
</body>
</html>
`;
}

export function writeHtml(file: string, input: HtmlInput): number {
  const html = renderHtml(input);
  writeFileSync(file, html);
  return Buffer.byteLength(html);
}

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#16181D" d="M1.6 11.57L8 14.78L8 15.68L1.6 12.47Z"/><path fill="#23262E" d="M14.4 11.57L8 14.78L8 15.68L14.4 12.47Z"/><path fill="#2E323B" d="M8 8.38L14.4 11.57L8 14.78L1.6 11.57Z"/><path fill="#E8D9A8" d="M5.6 10.21L8 11.41L8 3.54L5.6 2.34Z"/><path fill="#A8996E" d="M10.4 10.21L8 11.41L8 3.54L10.4 2.34Z"/><path fill="#F6F1E4" d="M8 1.14L10.4 2.34L8 3.54L5.6 2.34Z"/><path fill="#FFB066" d="M8 0.92L9.2 1.52L8 2.12L6.8 1.52Z"/><path fill="#FF7A1A" d="M6.8 2.34L8 2.94L8 2.12L6.8 1.52Z"/><path fill="#D45F10" d="M9.2 2.34L8 2.94L8 2.12L9.2 1.52Z"/><path fill="#E8D9A8" d="M8.8 11.65L10.88 12.7L10.88 7.6L8.8 6.55Z"/><path fill="#A8996E" d="M12.96 11.65L10.88 12.7L10.88 7.6L12.96 6.55Z"/><path fill="#F6F1E4" d="M10.88 5.52L12.96 6.55L10.88 7.6L8.8 6.55Z"/><path fill="#E8D9A8" d="M4 11.65L6.08 12.7L6.08 9.7L4 8.65Z"/><path fill="#A8996E" d="M7.84 11.82L6.08 12.7L6.08 9.7L7.84 8.82Z"/><path fill="#F6F1E4" d="M5.76 7.78L7.84 8.82L6.08 9.7L4 8.65Z"/></svg>`;

const CSS = `
:root{--bg:#1c1e24;--deep:#23262E;--panel:rgba(28,30,36,.9);--panel-solid:#23262E;--moss:#4E8C3A;--moss-hi:#6fb352;--red:#D9382B;--lava:#FF7A1A;--dia:#3FD0C9;--sand:#E8D9A8;--bone:#F6F1E4;--mute:rgba(246,241,228,.62);--line:rgba(246,241,228,.12);--line-hi:rgba(246,241,228,.24);--r:6px;--mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--ui:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;--px:Silkscreen,var(--mono)}
*{box-sizing:border-box}
html,body{margin:0;height:100%;position:fixed;inset:0;overflow:hidden;overscroll-behavior:none;background:var(--bg);transition:background .6s;color:var(--bone);font:13px/1.45 var(--ui);-webkit-font-smoothing:antialiased}
#scene{position:fixed;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
#ui{position:fixed;inset:0;pointer-events:none;overflow:hidden}
#ui>*{pointer-events:auto}
#ui .labels,#ui .tip,#ui .progress{pointer-events:none}
button{font:inherit;color:inherit}
svg{fill:currentColor}
kbd{font:600 10px var(--mono);border:1px solid var(--line-hi);border-bottom-width:2px;border-radius:3px;padding:0 4px;color:var(--mute)}
:focus-visible{outline:2px solid var(--dia);outline-offset:2px}
.progress{position:absolute;left:0;top:0;height:2px;width:100%;background:linear-gradient(90deg,var(--moss) calc(var(--p,0)*100%),transparent 0);transition:opacity .6s}
body.ready .progress{opacity:0}
.brand{position:absolute;left:16px;top:14px;display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);max-width:min(420px,calc(100% - 32px))}
.brand svg{width:34px;height:34px;flex:none}
.brand .word{font:400 15px/1 var(--px);letter-spacing:.5px}
.brand .repo{font:500 12px/1.3 var(--mono);color:var(--sand);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand .repo span{color:var(--mute);margin-left:6px}
.stats{position:absolute;right:16px;top:14px;margin:0;display:flex;gap:2px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:4px}
.stats div{padding:4px 10px;border-right:1px solid var(--line)}
.stats div:last-child{border-right:0}
.stats dt{font:500 10px var(--mono);color:#A9ACB2;text-transform:uppercase;letter-spacing:.06em}
.stats dd{margin:0;font:600 15px var(--mono);color:var(--bone)}
.dock{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100% - 24px)}
.search{display:flex;align-items:center;gap:6px;background:#15171c;border:1px solid var(--line);border-radius:7px;padding:0 8px;height:36px;width:260px}
.search svg{width:14px;height:14px;color:var(--mute);flex:none}
.search input{all:unset;flex:1;min-width:0;font:12px var(--mono);color:var(--bone)}
.search input::placeholder{color:var(--mute)}
.search:focus-within{border-color:var(--dia)}
.tool{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;height:36px;padding:0 11px;border-radius:7px;color:var(--bone);font:500 12px var(--ui)}
.tool svg{width:14px;height:14px;color:var(--sand)}
.tool:hover{background:rgba(246,241,228,.07)}
.tool[aria-pressed=true],.tool[aria-expanded=true]{background:rgba(78,140,58,.22);box-shadow:inset 0 0 0 1px var(--moss)}
.tool:focus-visible{outline:2px solid var(--dia)}
.matches{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);width:min(560px,calc(100% - 24px));margin:0;padding:4px;list-style:none;background:var(--panel-solid);border:1px solid var(--line-hi);border-radius:8px;max-height:min(320px,50vh);overflow:auto}
.matches li.none{padding:8px 10px;color:var(--mute)}
.matches .path{display:flex;width:100%;gap:10px;padding:7px 10px;border-radius:5px}
.matches .path i{font-style:normal;color:var(--mute);width:58px;flex:none;text-align:right}
.matches .path:hover,.matches .path:focus-visible{background:rgba(63,208,201,.1)}
.path{all:unset;cursor:pointer;font:12px var(--mono);color:var(--dia);word-break:break-all}
.path:hover{text-decoration:underline}
.menu{position:absolute;bottom:84px;left:50%;transform:translateX(40px);width:220px;padding:6px;background:var(--panel-solid);border:1px solid var(--line-hi);border-radius:8px;display:flex;flex-direction:column;gap:2px}
.menu-h{font:400 10px var(--px);color:var(--mute);padding:6px 8px 2px;letter-spacing:.05em}
.menu button{all:unset;cursor:pointer;padding:6px 8px;border-radius:5px}
.menu button:hover{background:rgba(246,241,228,.07)}
.menu button[aria-pressed=true]{color:var(--moss-hi)}
.menu button[aria-pressed=true]::before{content:'● ';font-size:9px}
.menu label{display:flex;gap:8px;align-items:center;padding:5px 8px;cursor:pointer}
.menu input{accent-color:var(--moss)}
.metric-legend{position:absolute;left:50%;top:76px;transform:translateX(-50%);padding:8px 12px;max-width:min(560px,calc(100% - 32px));background:var(--panel);border:1px solid var(--line);border-radius:var(--r);font-size:12px;color:var(--mute);text-align:center}
.metric-legend b{color:var(--bone);margin-right:6px}
.metric-legend .ramp{display:block;height:6px;margin-top:6px;border-radius:3px;background:linear-gradient(90deg,#3a4252,#4E8C3A,#E8D9A8,#FF7A1A,#D9382B)}
.drawer{position:absolute;right:16px;top:76px;bottom:90px;width:340px;overflow:auto;background:var(--panel-solid);border:1px solid var(--line);border-radius:8px;padding:0 16px 16px}
.drawer-h{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:12px 0 8px;background:var(--panel-solid);font:400 13px var(--px);color:var(--sand)}
.drawer section{border-top:1px solid var(--line);padding:10px 0}
.drawer h3{margin:8px 0 6px;font:600 12px var(--ui);color:var(--bone);display:flex;align-items:center;gap:7px}
.drawer ul{margin:0;padding:0;list-style:none}
.drawer li{margin:0 0 8px;display:flex;flex-direction:column}
.drawer li span{color:var(--mute);font-size:12px}
.dot{display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--mute)}
.dot.lava{background:var(--lava)}.dot.red{background:var(--red)}.dot.moss{background:var(--moss)}
.legend,.keys{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:4px 0;font-size:12px}
.legend dt,.keys dt{color:var(--sand);display:flex;align-items:center;gap:6px;white-space:nowrap}
.legend dd,.keys dd{margin:0;color:var(--mute)}
.fine{font-size:11.5px;color:var(--mute);margin:8px 0 0}
.wide,.small{all:unset;cursor:pointer;display:block;text-align:center;border:1px solid var(--line-hi);border-radius:6px;padding:8px 10px;font-weight:600}
.small{display:inline-block;padding:5px 9px;font-weight:500;font-size:12px}
.wide:hover,.small:hover{border-color:var(--dia)}
.icon{all:unset;cursor:pointer;display:grid;place-items:center;width:26px;height:26px;border-radius:5px;color:var(--mute)}
.icon svg{width:12px;height:12px}
.icon:hover{color:var(--bone);background:rgba(246,241,228,.08)}
.card{position:absolute;left:16px;bottom:30px;width:300px;padding:10px 12px 12px;background:var(--panel-solid);border:1px solid var(--line-hi);border-left:3px solid var(--lava);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.card-h{display:flex;justify-content:space-between;align-items:center;gap:8px}
.card .district{font-size:11px;color:var(--mute)}
.path-full{font:600 15px/1.3 var(--mono);color:var(--bone);margin:4px 0 8px;word-break:break-all}
.path-full em{font:500 11px var(--ui);color:var(--mute);font-style:normal}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:0}
.facts dt{font:500 10px var(--mono);color:#A9ACB2;text-transform:uppercase;letter-spacing:.05em}
.facts dd{margin:0;font:600 13px var(--mono)}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.tag{font-size:11px;padding:2px 7px;border-radius:4px;border:1px solid}
.tag.lava{color:var(--lava);border-color:rgba(255,122,26,.5)}.tag.red{color:#ff8a7f;border-color:rgba(217,56,43,.55)}.tag.moss{color:var(--moss-hi);border-color:rgba(78,140,58,.6)}.tag.gold{color:#f6d03d;border-color:rgba(246,208,61,.5)}
.card-a{margin-top:10px}
.tip{position:absolute;left:0;top:0;display:none;padding:5px 8px;background:var(--panel-solid);border:1px solid var(--line-hi);border-radius:5px;font-size:12px;white-space:nowrap}
.tip b{font:600 12px var(--mono);margin-right:8px}
.tip span{color:var(--mute)}
.foot{position:absolute;right:16px;bottom:30px;max-width:230px;font-size:10.5px;line-height:1.35;color:rgba(246,241,228,.66);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 9px}
.foot a{color:var(--dia);pointer-events:auto}
.labels{position:absolute;inset:0}
.mc-note{position:absolute;right:16px;bottom:96px;max-width:300px;font-size:11px;color:var(--mute);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 9px}
.mc-note a{color:var(--dia)}
@media (max-width:720px){.mc-note{bottom:auto;top:62px;right:10px}}
.label{all:unset;position:absolute;left:0;top:0;cursor:pointer;pointer-events:auto;font:600 11px var(--mono);color:var(--bone);background:rgba(28,30,36,.82);border:1px solid var(--line);border-radius:4px;padding:2px 6px;white-space:nowrap;will-change:transform}
.label.d1{font:600 12px var(--mono);color:var(--bone);background:rgba(232,217,168,.16);border-color:rgba(232,217,168,.35)}
.label.d2{font-weight:400;color:rgba(246,241,228,.85)}
.label:hover{border-color:var(--dia)}
body.flying #ui>*:not(.foot){display:none!important}
body.no-ui #ui{display:none}
.fatal{position:fixed;inset:0;display:grid;place-items:center;padding:16px;text-align:center;color:var(--bone)}
[hidden]{display:none!important}
body.night{background:radial-gradient(120% 90% at 50% 30%,#1b2238 0%,#11131b 60%,#0b0c10 100%)!important}
@media (max-width:900px){.stats{display:none}.search{width:180px}}
@media (max-width:720px){
 .brand{top:10px;left:10px}
 .dock{bottom:24px;left:10px;right:10px;transform:none;max-width:none;justify-content:space-between}
 .search{width:auto;flex:1}
 .search kbd{display:none}
 .tool{padding:0 9px}
 .tool span{display:none}
 .menu{left:auto;right:10px;transform:none;bottom:80px}
 .matches{bottom:80px}
 .drawer{left:0;right:0;bottom:0;top:auto;width:auto;max-height:62vh;border-radius:12px 12px 0 0}
 .card{left:10px;right:10px;width:auto;bottom:80px}
 .metric-legend{top:66px}
 .foot{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
