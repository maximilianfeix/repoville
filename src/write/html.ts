import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'fflate';
import { colorOf } from '../build/colors.js';
import type { Biome } from '../build/palette.js';
import type { Timeline } from '../history/timeline.js';
import type { RepoDiff } from '../history/diff.js';
import type { BuiltCity } from '../build/city.js';
import type { VoxelGrid } from '../build/voxel-grid.js';
import { files, type CityTree } from '../model/city.js';
import type { Highlights } from '../summary.js';
import { encodePayload, type ViewerMeta } from '../../viewer/format.js';
import { stageCss } from '../../viewer/stage.js';

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
  source?: { base: string; host: 'github' | 'gitlab' } | null;
  /** The tree before LOD, used to index files inside merged towers. */
  full?: CityTree;
  timeline?: Timeline | null;
  diff?: RepoDiff | null;
}

/** Per building change status; files inside merged towers roll up into the tower. */
function diffRows(built: BuiltCity, diff: RepoDiff | null | undefined) {
  if (!diff) return null;
  const index = new Map(built.buildings.map((b, i) => [b.path, i]));
  const towers = built.buildings.map((b, i) => [b.path, i] as const).filter(([, i]) => built.buildings[i]!.merged);
  const rows = new Map<number, [number, 'A' | 'M', number, number]>();
  const deleted: string[] = [];
  for (const [path, c] of [...diff.changes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (c.status === 'deleted') {
      deleted.push(path);
      continue;
    }
    let i = index.get(path);
    let merged = false;
    if (i === undefined) {
      const t = towers.find(([p]) => path.startsWith(p + '/'));
      if (!t) continue;
      i = t[1];
      merged = true;
    }
    const row = rows.get(i) ?? [i, merged ? 'M' : c.status === 'added' ? 'A' : 'M', 0, 0];
    row[2] += c.added;
    row[3] += c.removed;
    rows.set(i, row);
  }
  return { base: diff.base, baseCommit: diff.baseCommit, files: [...rows.values()].sort((a, b) => a[0] - b[0]), deleted: deleted.slice(0, 200), deletedCount: deleted.length };
}

/** Readable signature colour per theme for the time-lapse blocks. */
const HISTORY_COLORS: Record<Biome, number> = {
  nether: 0xb4453c, plains: 0xe0d6a8, jungle: 0x7fb24a, frozen: 0x8fc6e6, badlands: 0xc4673a, caves: 0x8a8f99,
  cherry: 0xe2a1b8, end: 0xb48ab4, quarry: 0x9a9a9a, library: 0xb08a52, stone: 0xb0b0a8, copper: 0xc4774f, reef: 0x63b5a4,
};

/** For each merged tower: the files it stands for, as "relative/path\tloc" lines. */
function mergedIndex(built: BuiltCity, full: CityTree | undefined): Array<[number, string]> {
  if (!full) return [];
  const towers = new Map<string, number>();
  built.buildings.forEach((b, i) => b.merged && towers.set(b.path, i));
  if (!towers.size) return [];
  const lines = new Map<number, string[]>();
  for (const f of files(full.root)) {
    // Walk up the folder chain until a merged tower is found.
    let p = f.path;
    for (let cut = p.lastIndexOf('/'); cut > 0; cut = p.lastIndexOf('/')) {
      p = p.slice(0, cut);
      const i = towers.get(p);
      if (i !== undefined) {
        const list = lines.get(i) ?? [];
        list.push(`${f.path.slice(p.length + 1)}\t${f.loc}`);
        lines.set(i, list);
        break;
      }
    }
  }
  return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([i, l]) => [i, l.join('\n')]);
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
    source: input.source ?? null,
    merged: mergedIndex(built, input.full),
    diff: diffRows(built, input.diff),
    timeline: input.timeline
      ? {
          times: input.timeline.times,
          heights: Buffer.from(input.timeline.heights).toString('base64'),
          colors: built.buildings.map((b) => HISTORY_COLORS[b.biome]),
        }
      : null,
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="generator" content="${escapeHtml(input.generator)}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&text=repoville&display=swap" rel="stylesheet">
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
:root{--bg:#F6F3EC;--surface:#FFFDF8;--text:#20231F;--text-2:#596057;--rule:#D7D9CF;--rule-2:#BFC3B6;--accent:#356449;--hover:#F1EEE5;--wash:#E8EFE8;--field:#F6F3EC;--fire:#A8481A;--todo:#A93226;--moss:#4A6B2A;--new:#1F6B67;--gold:#7A5F00;--r:8px;--dock-h:46px;--sb:max(16px,env(safe-area-inset-bottom));--sl:max(16px,env(safe-area-inset-left));--sr:max(16px,env(safe-area-inset-right));--st:max(16px,env(safe-area-inset-top));--mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--ui:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;--word:'Bricolage Grotesque',var(--ui)}
body.ink{--surface:#1B211B;--text:#F2F1E9;--text-2:#B6BDAF;--rule:#394339;--rule-2:#4F5B4F;--accent:#9CC8A5;--hover:#232A23;--wash:#25322A;--field:#141914;--fire:#F0A46E;--todo:#F2958B;--moss:#B5CF8E;--new:#8FD3CC;--gold:#E6C866}
*{box-sizing:border-box}
html,body{margin:0;height:100%;position:fixed;inset:0;overflow:hidden;overscroll-behavior:none;background:var(--bg);color:var(--text);font:13px/1.45 var(--ui);-webkit-font-smoothing:antialiased}
body{transition:background-color .6s}
body.night{background:#101410}
#scene{position:fixed;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
#ui{position:fixed;inset:0;pointer-events:none;overflow:hidden;overflow:clip}
#ui>*{pointer-events:auto}
#ui .labels,#ui .tip,#ui .progress{pointer-events:none}
button{font:inherit;color:inherit}
svg{fill:currentColor}
a{color:var(--accent)}
kbd{font:500 10.5px/1.5 var(--mono);border:1px solid var(--rule);border-radius:4px;padding:0 5px;color:var(--text-2);background:var(--surface)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.brand,.stats,.dock,.matches,.menu,.metric-legend,.drawer,.card,.tip,.minimap,.foot,.timeline,.mc-note{background:var(--surface);border:1px solid var(--rule);border-radius:var(--r);color:var(--text)}
.progress{position:absolute;left:0;top:0;height:2px;width:100%;transition:opacity .6s}
.progress::after{content:'';position:absolute;inset:0;background:var(--accent);transform-origin:0 0;transform:scaleX(var(--p,0))}
body.ready .progress{opacity:0}
.brand{position:absolute;left:var(--sl);top:var(--st);padding:10px 14px 10px;max-width:min(380px,calc(100% - 32px))}
.brand .word{display:block;font:800 19px/1 var(--word);letter-spacing:-.02em;color:var(--text)}
.brand .repo{font:500 12px/1.3 var(--mono);color:var(--text);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand .repo span{color:var(--text-2);margin-left:6px;font-weight:400}
.brand .sum{display:none;font:400 11.5px/1.3 var(--mono);color:var(--text-2);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stats{position:absolute;right:var(--sr);top:var(--st);margin:0;display:flex;padding:9px 4px}
.stats div{padding:0 14px;border-left:1px solid var(--rule)}
.stats div:first-child{border-left:0}
.stats dt{font:400 11.5px/1.3 var(--ui);color:var(--text-2)}
.stats dd{margin:3px 0 0;font:600 16px/1.2 var(--mono);color:var(--text);font-variant-numeric:tabular-nums}
.dock{position:absolute;left:50%;bottom:var(--sb);transform:translateX(-50%);display:flex;gap:2px;align-items:center;padding:4px;max-width:calc(100% - 24px)}
.search{min-width:0;display:flex;align-items:center;gap:8px;background:var(--field);border:1px solid var(--rule);border-radius:6px;padding:0 8px 0 10px;height:36px;width:260px;margin-right:4px}
.search svg{width:14px;height:14px;color:var(--text-2);flex:none}
.search input{all:unset;flex:1;min-width:0;width:100%;font:12.5px var(--mono);color:var(--text)}
.search input::placeholder{color:var(--text-2);opacity:1}
.search:focus-within{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.tool{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:7px;height:36px;padding:0 11px;border-radius:6px;color:var(--text);font:500 13px var(--ui);white-space:nowrap}
.tool svg{width:14px;height:14px;color:var(--text-2);flex:none}
.tool:hover{background:var(--hover)}
.tool[aria-pressed=true],.tool[aria-expanded=true]{background:var(--wash);color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.tool[aria-pressed=true] svg,.tool[aria-expanded=true] svg{color:var(--accent)}
.tool:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.more-group{display:flex;gap:2px;align-items:center;margin-left:4px;padding-left:6px;border-left:1px solid var(--rule)}
.more-group .tool{color:var(--text-2)}
.more-group .tool:hover{color:var(--text)}
.more-group .tool[aria-pressed=true],.more-group .tool[aria-expanded=true]{color:var(--accent)}
.more-group kbd{display:none}
#rv-more{display:none}
.matches{position:absolute;left:50%;bottom:calc(var(--sb) + var(--dock-h) + 8px);transform:translateX(-50%);width:min(560px,calc(100% - 24px));margin:0;padding:4px;list-style:none;max-height:min(340px,50vh);overflow:auto}
.matches li.none{padding:8px 10px;color:var(--text-2)}
.matches .path{display:flex;width:100%;box-sizing:border-box;gap:12px;padding:7px 10px;border-radius:5px;color:var(--text)}
.matches .path i{font:400 11.5px var(--mono);font-style:normal;color:var(--text-2);width:64px;flex:none;text-align:right;padding-top:1px}
.matches .path:hover,.matches .path:focus-visible{background:var(--wash);text-decoration:none}
.matches .path:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.path{all:unset;cursor:pointer;font:12.5px/1.4 var(--mono);color:var(--accent);word-break:break-all}
.path:hover{text-decoration:underline;text-underline-offset:2px}
.path:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:2px}
.menu{position:absolute;bottom:calc(var(--sb) + var(--dock-h) + 8px);left:50%;width:232px;padding:6px;display:flex;flex-direction:column;gap:1px;max-height:calc(100% - 140px);overflow:auto}
.menu-h{font:600 11.5px var(--ui);color:var(--text-2);padding:8px 8px 3px}
.menu-h:first-child{padding-top:4px}
.menu button{all:unset;box-sizing:border-box;cursor:pointer;padding:6px 8px 6px 24px;border-radius:5px;position:relative}
.menu button:hover,.menu label:hover{background:var(--hover)}
.menu button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.menu button[aria-pressed=true],.menu button[aria-checked=true]{color:var(--accent);font-weight:600}
.menu button[aria-pressed=true]::before{content:'';position:absolute;left:10px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--accent)}
.menu label{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:5px;cursor:pointer}
.menu input{accent-color:var(--accent);margin:0 2px 0 0}
.seg{display:flex;gap:4px;padding:2px 2px 4px}
.menu .seg button{flex:1;text-align:center;padding:5px 4px;border:1px solid var(--rule);font-size:12px}
.menu .seg button[aria-checked=true]{border-color:var(--accent);background:var(--wash)}
.metric-legend{position:absolute;left:50%;top:var(--st);transform:translateX(-50%);padding:9px 14px;max-width:min(520px,calc(100% - 32px));font-size:12.5px;color:var(--text-2);text-align:center}
.metric-legend b{color:var(--text);margin-right:6px}
.metric-legend .ticks{display:flex;justify-content:space-between;margin-top:4px;font:400 11px var(--mono);color:var(--text-2)}
.metric-legend .ramp{display:block;height:6px;margin-top:7px;border-radius:2px;background:linear-gradient(90deg,#3a4252,#4E8C3A,#E8D9A8,#FF7A1A,#D9382B)}
.metric-legend details{margin-top:6px;text-align:left;font:11px var(--mono);max-height:160px;overflow:auto}
.drawer{position:absolute;right:var(--sr);top:calc(var(--st) + 72px);bottom:calc(var(--sb) + var(--dock-h) + 8px);width:340px;overflow:auto;padding:0 18px 16px;overscroll-behavior:contain}
.drawer-h{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;align-items:center;padding:12px 0 10px;background:var(--surface);font:600 14px var(--ui);color:var(--text)}
.drawer section{border-top:1px solid var(--rule);padding:12px 0}
.drawer h3{margin:4px 0 8px;font:600 12.5px var(--ui);color:var(--text);display:flex;align-items:center;gap:8px}
.drawer ul{margin:0 0 6px;padding:0;list-style:none}
.drawer li{margin:0 0 8px;display:flex;flex-direction:column;gap:1px}
.drawer .districts li{margin-bottom:4px}
.drawer li span{color:var(--text-2);font-size:12px}
.dot{display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--text-2);flex:none}
.dot.lava{background:var(--fire)}.dot.red{background:var(--todo)}.dot.moss{background:var(--moss)}
.legend,.keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:4px 0;font-size:12px}
.legend dt,.keys dt{color:var(--text);font-weight:500;display:flex;align-items:center;gap:6px;white-space:nowrap}
.legend dd,.keys dd{margin:0;color:var(--text-2)}
.fine{font-size:11.5px;line-height:1.5;color:var(--text-2);margin:10px 0 0}
.wide,.small{all:unset;box-sizing:border-box;cursor:pointer;display:block;text-align:center;border:1px solid var(--rule-2);border-radius:6px;padding:8px 10px;font-weight:500;color:var(--text);background:var(--surface)}
.small{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;font-size:12.5px}
.wide:hover,.small:hover{border-color:var(--accent);background:var(--hover)}
.wide:focus-visible,.small:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.icon{all:unset;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;width:28px;height:28px;border-radius:5px;color:var(--text-2);flex:none}
.icon svg{width:12px;height:12px}
.icon:hover{color:var(--text);background:var(--hover)}
.icon:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.card{position:absolute;left:var(--sl);bottom:var(--sb);width:320px;max-height:calc(100% - 140px);overflow:auto;padding:12px 14px 14px 16px;border-left:3px solid var(--accent)}
.card-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin:-2px -4px 0 0}
.card .district{font-size:12px;color:var(--text-2);padding-top:5px}
.card .district:hover{color:var(--accent)}
.path-full{font:600 16px/1.3 var(--mono);color:var(--text);margin:2px 0 10px;word-break:break-all}
.path-full em{font:400 12px var(--ui);color:var(--text-2);font-style:normal;margin-left:4px}
.facts{margin:0;border-top:1px solid var(--rule)}
.facts div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule)}
.facts dt{font:400 12.5px var(--ui);color:var(--text-2)}
.facts dd{margin:0;font:500 12.5px var(--mono);color:var(--text);text-align:right;font-variant-numeric:tabular-nums}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tag{font-size:11.5px;line-height:1.5;padding:1px 8px;border-radius:4px;border:1px solid currentColor;background:var(--surface)}
.tag.lava{color:var(--fire)}.tag.red{color:var(--todo)}.tag.moss{color:var(--moss)}.tag.dia{color:var(--new)}.tag.gold{color:var(--gold)}
.inner-note{font:12px var(--mono);color:var(--text-2);margin:-4px 0 10px;word-break:break-all}
.card-a{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.card-a a.small{text-decoration:none;color:var(--accent)}
.tip{position:absolute;left:0;top:0;display:none;padding:5px 9px;border-radius:6px;font-size:12px;white-space:nowrap;border-color:var(--rule-2)}
.tip b{font:600 12px var(--mono);margin-right:8px}
.tip span{color:var(--text-2)}
.minimap{position:absolute;left:var(--sl);bottom:var(--sb);width:168px;height:168px;cursor:pointer}
.minimap[hidden]{display:none}
.foot{position:absolute;right:var(--sr);bottom:var(--sb);max-width:224px;font-size:10.5px;line-height:1.45;color:var(--text-2);padding:7px 10px}
.foot a{color:var(--accent);pointer-events:auto}
/* The guide carries the same notice; the corner one steps aside while a panel is open. */
.drawer:not([hidden])~.foot,.matches:not([hidden])~.foot,.menu:not([hidden])~.foot,.dock.more-open~.foot{display:none}
.disc{display:block;margin-top:2px}
.labels{position:absolute;inset:0}
.timeline{position:absolute;left:50%;top:calc(var(--st) + 84px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;width:min(520px,calc(100% - 32px));padding:6px 12px 6px 6px}
.timeline input{flex:1;accent-color:var(--accent)}
.timeline span{font:500 12px var(--mono);color:var(--text);min-width:84px;text-align:right}
.mc-note{position:absolute;right:var(--sr);bottom:calc(var(--sb) + 72px);max-width:300px;font-size:11.5px;color:var(--text-2);padding:7px 10px}
.mc-note a{color:var(--accent)}
.label{all:unset;position:absolute;left:0;top:0;cursor:pointer;pointer-events:auto;font:500 11px/1.5 var(--mono);color:var(--text);background:var(--surface);border:1px solid var(--rule);border-radius:4px;padding:1px 6px;white-space:nowrap;will-change:transform}
.label.d1{font:600 12px/1.5 var(--mono);border-color:var(--rule-2)}
.label.d2{color:var(--text-2)}
.label:hover{border-color:var(--accent);color:var(--accent)}
body.flying #ui>*:not(.foot){display:none!important}
body.no-ui #ui{display:none}
.fatal{position:fixed;inset:0;display:grid;place-items:center;padding:16px;text-align:center;color:var(--text)}
[hidden]{display:none!important}
${stageCss()}
@media (max-width:1200px){
 .card{bottom:calc(var(--sb) + var(--dock-h) + 8px)}
 #rv-more{display:flex}
 .more-group{display:none;position:absolute;right:0;bottom:calc(100% + 8px);flex-direction:column;align-items:stretch;gap:1px;width:200px;margin:0;padding:6px;background:var(--surface);border:1px solid var(--rule);border-radius:var(--r)}
 .dock.more-open .more-group{display:flex}
 .more-group .tool{color:var(--text);justify-content:flex-start;height:40px}
 .more-group kbd{display:inline;margin-left:auto}
}
@media (max-width:980px){.foot{bottom:calc(var(--sb) + var(--dock-h) + 8px)}}
@media (max-width:900px){.stats{display:none}.brand .sum{display:block}.search{width:200px}}
@media (max-width:820px){.minimap{display:none!important}}
@media (max-width:720px){
 :root{--sb:max(10px,env(safe-area-inset-bottom));--sl:max(10px,env(safe-area-inset-left));--sr:max(10px,env(safe-area-inset-right));--st:max(10px,env(safe-area-inset-top));--dock-h:54px}
 .brand{padding:9px 12px 9px;max-width:calc(100% - 20px)}
 .brand .word{font-size:17px}
 .dock{left:var(--sl);right:var(--sr);transform:none;max-width:none}
 .search{width:auto;flex:1;height:44px;margin-right:2px}
 .search input{font-size:16px}
 .search kbd{display:none}
 .tool{height:44px;min-width:44px;padding:0 10px;justify-content:center}
 .dock>.tool span{display:none}
 .more-group .tool{height:44px}
 .menu{left:auto!important;right:var(--sr);width:min(260px,calc(100% - 20px))}
 .menu button,.menu label{min-height:40px;display:flex;align-items:center}
 .matches{width:auto;left:var(--sl);right:var(--sr);transform:none}
 .matches .path{padding:10px}
 .drawer{left:0;right:0;bottom:0;top:auto;width:auto;max-height:72vh;border-radius:12px 12px 0 0;border-left:0;border-right:0;border-bottom:0;padding:0 max(18px,env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}
 .drawer-h{padding-top:18px}
 .drawer-h::before{content:'';position:absolute;left:50%;top:7px;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:var(--rule-2)}
 .drawer .icon{width:40px;height:40px;margin-right:-8px}
 .card{left:var(--sl);right:var(--sr);width:auto;bottom:calc(var(--sb) + var(--dock-h) + 8px);max-height:52vh}
 .card .icon{width:40px;height:40px;margin:-8px -10px 0 0}
 .metric-legend{top:calc(var(--st) + 80px)}
 .timeline{top:calc(var(--st) + 156px)}
 .mc-note{bottom:auto;top:calc(var(--st) + 80px);right:var(--sr)}
 .foot{display:none}
 .minimap{display:none!important}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
