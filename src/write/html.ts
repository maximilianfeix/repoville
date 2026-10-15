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
      b.path, b.x0, b.z0, b.x1, b.z1, b.height, b.loc, b.churn, b.todos, b.lastTouched ?? -1, b.fire, b.mossy ? 1 : 0, b.lang, b.style, b.merged ?? 0,
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

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 1l7 3.5-7 3.5-7-3.5z" fill="#4E8C3A"/><path d="M1 4.5l7 3.5v7l-7-3.5z" fill="#2E323B"/><path d="M15 4.5l-7 3.5v7l7-3.5z" fill="#23262E"/><path d="M3 10v-1l1 .5v1zM5 11.5v-3l1 .5v3zM7 13v-5l1 .5v5z" fill="#E8D9A8"/><path d="M7 8l1 .5v1l-1-.5z" fill="#FF7A1A"/></svg>`;

const CSS = `
:root{--bg:#23262E;--moss:#4E8C3A;--redstone:#D9382B;--lava:#FF7A1A;--diamond:#3FD0C9;--sand:#E8D9A8;--bone:#F6F1E4;--panel:rgba(35,38,46,.88);--line:rgba(246,241,228,.14)}
*{box-sizing:border-box}html,body{margin:0;height:100%;position:fixed;inset:0;overscroll-behavior:none;background:var(--bg);color:var(--bone);font:14px/1.45 Inter,system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#scene{position:fixed;inset:0;width:100%;height:100%;display:block;outline:none}
#ui{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.panel{pointer-events:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.top{position:absolute;left:16px;top:16px;right:16px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.brand{display:flex;gap:10px;align-items:center;padding:10px 14px}
.brand svg{width:28px;height:28px;flex:none}
.brand .word{font-family:Silkscreen,monospace;font-size:18px;letter-spacing:.5px}
.brand .repo{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--sand);word-break:break-all}
.stats{padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--sand);display:flex;gap:14px;flex-wrap:wrap}
.stats b{color:var(--bone);font-weight:600}
.side{position:absolute;left:16px;bottom:44px;width:min(360px,calc(100% - 32px));max-height:calc(100% - 140px);overflow:auto;padding:12px 14px}
.side h2{font-family:Silkscreen,monospace;font-weight:400;font-size:13px;margin:10px 0 6px;color:var(--sand)}
.side h2:first-child{margin-top:0}
.side ul{list-style:none;margin:0;padding:0}
.side li{margin:3px 0;font-size:12.5px}
.side button.link{all:unset;cursor:pointer;color:var(--diamond);font-family:'JetBrains Mono',monospace;font-size:12px;word-break:break-all}
.side button.link:hover,.side button.link:focus-visible{text-decoration:underline}
.legend{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12px}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.toggle{all:unset;cursor:pointer;font-family:Silkscreen,monospace;font-size:12px;color:var(--sand);padding:2px 0}
.tip{position:absolute;pointer-events:none;padding:9px 11px;font-size:12px;max-width:340px;display:none;z-index:3}
.tip .p{font-family:'JetBrains Mono',monospace;color:var(--bone);word-break:break-all;margin-bottom:4px}
.tip .k{color:var(--sand)}
.tip .hot{color:var(--lava)}.tip .moss{color:#8fc46a}.tip .ruin{color:var(--redstone)}
.bottom{position:absolute;left:16px;right:16px;bottom:10px;display:flex;justify-content:space-between;gap:12px;font-size:11px;color:rgba(246,241,228,.65);flex-wrap:wrap}
.bottom a{color:var(--diamond)}
.right{position:absolute;right:16px;bottom:44px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;width:min(300px,calc(100% - 32px))}
.right input{width:100%;background:#1b1d23;border:1px solid var(--line);color:var(--bone);border-radius:6px;padding:7px 9px;font:12px 'JetBrains Mono',monospace}
.right input:focus{outline:2px solid var(--diamond);outline-offset:1px}
.btns{display:flex;gap:6px;flex-wrap:wrap}
.btn{all:unset;cursor:pointer;background:#1b1d23;border:1px solid var(--line);border-radius:6px;padding:6px 9px;font-size:12px;color:var(--bone)}
.btn:hover,.btn:focus-visible{border-color:var(--diamond)}
.btn.on{border-color:var(--moss);background:#25331f}
.hint{font-size:11px;color:rgba(246,241,228,.6)}
.loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Silkscreen,monospace;color:var(--sand);font-size:14px;pointer-events:none}
.matches{max-height:140px;overflow:auto}
@media (max-width:720px){.side{display:none}.side.open{display:block}.stats{display:none}.right{bottom:44px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
