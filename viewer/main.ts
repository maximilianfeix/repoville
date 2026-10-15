import { inflateSync } from 'fflate';
import {
  ACESFilmicToneMapping, AdditiveBlending, Box3, Box3Helper, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, Fog,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, PCFShadowMap,
  PerspectiveCamera, Points, PointsMaterial, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decodePayload, fillChunk, type BuildingRow, type Payload } from './format.js';
import { greedyMesh } from './mesher.js';

declare global {
  interface Window {
    __repoville?: { ready: boolean; chunks: number; chunksDone: number; quads: number; fps: number; buildings: number; quality: string };
  }
}

const CHUNK = 32;
const DAY = 86400;
const MARK = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#14161b" d="M4 44 32 30 60 44V50L32 64 4 50Z"/><path fill="#E8D9A8" d="M4 44 32 30 60 44 32 58Z"/><path fill="#4E8C3A" d="M22 16 32 21V41L22 36Z"/><path fill="#355F28" d="M32 21 42 16V36L32 41Z"/><path fill="#F6F1E4" d="M22 16 32 11 42 16 32 21Z"/><path fill="#4E8C3A" d="M6 34 16 39V49L6 44Z"/><path fill="#355F28" d="M16 39 26 34V44L16 49Z"/><path fill="#F6F1E4" d="M6 34 16 29 26 34 16 39Z"/><path fill="#4E8C3A" d="M38 30 48 35V47L38 42Z"/><path fill="#355F28" d="M48 35 58 30V42L48 47Z"/><path fill="#F6F1E4" d="M38 30 48 25 58 30 48 35Z"/><path fill="none" stroke="#3FD0C9" stroke-width="3" stroke-linejoin="round" d="M21 50 32 55 47 48M32 55V45"/><path fill="#FF7A1A" d="M29 5H35V11H29Z"/></svg>`;

const ICON = {
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 2a5 5 0 1 0 3.1 8.9l3 3 1.4-1.4-3-3A5 5 0 0 0 7 2Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>',
  tour: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 1 7h2v7h4v-4h2v4h4V7h2z"/></svg>',
  fly: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 6 6 1 8l5 2 2 5 2-5 5-2-5-2z"/></svg>',
  layers: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 7 4-7 4-7-4zm-5.3 6.2L8 10.3l5.3-3.1L15 8l-7 4-7-4zm0 3L8 13.3l5.3-3.1L15 11l-7 4-7-4z"/></svg>',
  guide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h12v2H2zm0 5h12v2H2zm0 5h8v2H2z"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.4 2 4.6 4.6L12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z"/></svg>',
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number) => n.toLocaleString('en-US');
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : fmt(n));
const day = (t: number) => (t < 0 ? '3+ years ago' : new Date(t * 1000).toISOString().slice(0, 10));

function loadPayload(): Payload {
  const raw = document.getElementById('city-data')!.textContent!.trim();
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return decodePayload(inflateSync(bytes));
}

type Metric = 'none' | 'churn' | 'age' | 'todos';

function main() {
  const p = loadPayload();
  const m = p.meta;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
  let quality: 'high' | 'low' = lowPower ? 'low' : 'high';
  let userQuality = false;
  if (params.get('quality') === 'low' || params.get('quality') === 'high') {
    quality = params.get('quality') as 'high' | 'low';
    userQuality = true;
  }
  const state = { ready: false, chunks: 0, chunksDone: 0, quads: 0, fps: 0, buildings: m.buildings.length, quality: quality as string };
  window.__repoville = state;

  // ---------- Renderer, scene, lights ----------
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new Scene();
  const span = Math.max(m.width, m.length);
  scene.fog = new Fog(0x262931, span * 1.6, span * 4);

  const camera = new PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, span * 6);
  const homeDir = new Vector3(0.74, 0.6, 0.82).normalize();
  const fitDistance = () => {
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const r = span * 0.6;
    return Math.max(r / Math.sin(vfov / 2), r / Math.sin(hfov / 2)) * 0.8;
  };
  // Aim at the LOC-weighted downtown rather than the map centre.
  const downtown = new Vector3();
  {
    let wsum = 0;
    for (const b of m.buildings) {
      const w = b[6];
      downtown.x += ((b[1] + b[3]) / 2 - m.width / 2) * w;
      downtown.z += ((b[2] + b[4]) / 2 - m.length / 2) * w;
      wsum += w;
    }
    if (wsum > 0) downtown.multiplyScalar(1 / wsum);
    downtown.clampLength(0, span * 0.18);
  }
  const homePos = () => homeDir.clone().multiplyScalar(fitDistance()).add(downtown);
  camera.position.copy(homePos());

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.maxPolarAngle = Math.PI * 0.47;
  orbit.minDistance = 6;
  orbit.maxDistance = span * 3;
  orbit.screenSpacePanning = false;
  orbit.target.copy(downtown);
  orbit.update();
  const fly = new PointerLockControls(camera, document.body);

  scene.add(new HemisphereLight(0xcfdcff, 0x7a5f45, 1.5));
  const sun = new DirectionalLight(0xffcf9a, 2.8);
  sun.position.set(-span * 0.5, span * 0.42, -span * 0.3);
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -span * 0.75; sc.right = span * 0.75; sc.top = span * 0.75; sc.bottom = -span * 0.75;
  sc.near = 1; sc.far = span * 3;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 2;
  // The city never moves: render the shadow map only when meshes are added or quality changes.
  sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target);

  // Diorama base: the city floats on a slab of earth and stone.
  const DIRT = 9;
  const base = new Mesh(new BoxGeometry(m.width, DIRT, m.length), [
    new MeshLambertMaterial({ color: 0x6b4a33 }), new MeshLambertMaterial({ color: 0x5c3f2b }),
    new MeshLambertMaterial({ color: 0x4e8c3a }), new MeshLambertMaterial({ color: 0x3a3d45 }),
    new MeshLambertMaterial({ color: 0x74513a }), new MeshLambertMaterial({ color: 0x5f432f }),
  ]);
  base.position.set(0, -DIRT / 2 - 0.01, 0);
  base.receiveShadow = true;
  scene.add(base);
  const bedrock = new Mesh(new BoxGeometry(m.width - 2, 3, m.length - 2), new MeshLambertMaterial({ color: 0x4a4d55 }));
  bedrock.position.set(0, -DIRT - 1.5, 0);
  scene.add(bedrock);

  // ---------- HUD (created early so loading progress can render) ----------
  const ui = document.getElementById('ui')!;
  const progress = el('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Building the city' });
  ui.append(progress);

  // ---------- City meshes (progressive, nearest chunks first) ----------
  const material = new MeshLambertMaterial({ vertexColors: true });
  const ox = -m.width / 2;
  const oz = -m.length / 2;
  const queue: Array<[number, number]> = [];
  for (let cz = 0; cz < Math.ceil(m.length / CHUNK); cz++) for (let cx = 0; cx < Math.ceil(m.width / CHUNK); cx++) queue.push([cx, cz]);
  const cxm = m.width / CHUNK / 2;
  const czm = m.length / CHUNK / 2;
  queue.sort((a, b) => Math.hypot(a[0] - cxm, a[1] - czm) - Math.hypot(b[0] - cxm, b[1] - czm));
  state.chunks = queue.length;
  const vox = new Uint16Array((CHUNK + 2) * (CHUNK + 2) * m.height);
  // Baked AO costs ~10% more quads and ~15% fps; it pays off where people zoom in,
  // so huge cities (React, Linux) skip it unless ?ao=1.
  const bakeAo = params.get('ao') === '1' || (params.get('ao') !== '0' && m.width * m.length <= 400_000);
  let cityMeshes: Mesh[] = [];
  const chunkOf = new Map<Mesh, [number, number]>();

  /**
   * After loading, merge 8×8 chunks into one geometry per region: about 1,000
   * draw calls (plus the same again for shadows) become a few dozen.
   */
  function mergeRegions() {
    const groups = new Map<string, Mesh[]>();
    for (const mesh of cityMeshes) {
      const [cx, cz] = chunkOf.get(mesh)!;
      const k = `${cx >> 3},${cz >> 3}`;
      const g = groups.get(k);
      if (g) g.push(mesh);
      else groups.set(k, [mesh]);
    }
    const merged: Mesh[] = [];
    for (const meshes of groups.values()) {
      const geo = meshes.length === 1 ? meshes[0]!.geometry : mergeGeometries(meshes.map((x) => x.geometry));
      if (!geo) {
        merged.push(...meshes);
        continue;
      }
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = metric === 'none';
      scene.add(mesh);
      merged.push(mesh);
      for (const old of meshes) {
        scene.remove(old);
        if (old.geometry !== geo) old.geometry.dispose();
      }
    }
    cityMeshes = merged;
    sun.shadow.needsUpdate = true;
  }

  function meshNext(budgetMs: number) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budgetMs) {
      const [cx, cz] = queue.shift()!;
      const x0 = cx * CHUNK;
      const z0 = cz * CHUNK;
      const sx = Math.min(CHUNK, m.width - x0);
      const sz = Math.min(CHUNK, m.length - z0);
      const top = fillChunk(p, x0, z0, sx, sz, vox);
      // The dense array keeps the full-height stride; meshing only walks up to this chunk's top.
      const out = greedyMesh(vox, sx, top, sz, m.colors, m.kinds, [x0 + ox, 0, z0 + oz], true, bakeAo);
      state.chunksDone++;
      progress.style.setProperty('--p', String(state.chunksDone / state.chunks));
      if (!out.quads) continue;
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(out.positions, 3));
      geo.setAttribute('normal', new BufferAttribute(out.normals, 3));
      geo.setAttribute('color', new BufferAttribute(out.colors, 3));
      geo.setIndex(new BufferAttribute(out.indices, 1));
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = metric === 'none';
      scene.add(mesh);
      cityMeshes.push(mesh);
      chunkOf.set(mesh, [cx, cz]);
      state.quads += out.quads;
      if (cityMeshes.length % 48 === 0) sun.shadow.needsUpdate = true;
    }
    if (!queue.length) sun.shadow.needsUpdate = true;
    if (!queue.length && !state.ready) {
      if (params.get('merge') !== '0') mergeRegions();
      state.ready = true;
      document.body.classList.add('ready');
      if (quality === 'high' && !userQuality) {
        setTimeout(() => {
          if (state.fps > 0 && state.fps < 45 && !userQuality) setQuality('low', true);
        }, 2500);
      }
    }
  }

  // ---------- Flames above burning roofs ----------
  const burning = m.buildings.filter((b) => b[10] > 0);
  const PER = 8;
  const firePos = new Float32Array(burning.length * PER * 3);
  const fireCol = new Float32Array(burning.length * PER * 3);
  const fireSeed = new Float32Array(burning.length * PER);
  const lava = new Color(0xff7a1a);
  const soul = new Color(0x3fd0c9);
  burning.forEach((b, i) => {
    for (let k = 0; k < PER; k++) {
      const j = i * PER + k;
      const r = Math.abs(Math.sin(j * 12.9898) * 43758.5453) % 1;
      const g = Math.abs(Math.sin(j * 78.233) * 12345.678) % 1;
      firePos[j * 3] = b[1] + ox + r * (b[3] - b[1]);
      firePos[j * 3 + 1] = b[5] + 2;
      firePos[j * 3 + 2] = b[2] + oz + g * (b[4] - b[2]);
      const c = b[10] === 2 && k % 2 === 0 ? soul : lava;
      fireCol.set([c.r, c.g, c.b], j * 3);
      fireSeed[j] = r * 10;
    }
  });
  const fireGeo = new BufferGeometry();
  fireGeo.setAttribute('position', new BufferAttribute(firePos, 3));
  fireGeo.setAttribute('color', new BufferAttribute(fireCol, 3));
  const flames = new Points(fireGeo, new PointsMaterial({ size: 4, vertexColors: true, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  scene.add(flames);

  // ---------- Metric view: factual columns over the city ----------
  const boxGeo = new BoxGeometry(1, 1, 1);
  boxGeo.translate(0.5, 0.5, 0.5);
  const metricMesh = new InstancedMesh(boxGeo, new MeshLambertMaterial(), m.buildings.length);
  metricMesh.visible = false;
  metricMesh.frustumCulled = false;
  scene.add(metricMesh);
  const tmpM = new Matrix4();
  const tmpC = new Color();
  const RAMP = [new Color(0x3a4252), new Color(0x4e8c3a), new Color(0xe8d9a8), new Color(0xff7a1a), new Color(0xd9382b)];
  const ramp = (t: number) => {
    const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(x));
    return tmpC.copy(RAMP[i]!).lerp(RAMP[i + 1]!, x - i);
  };
  let metric: Metric = 'none';
  const METRIC_TEXT: Record<Metric, string> = {
    none: '',
    churn: `<b>Churn</b> commits per file in ${esc(m.since)}: column height and colour. Activity, not quality.`,
    age: '<b>Age</b> days since the last commit, as colour; height stays the building height. Old is not bad.',
    todos: '<b>TODO density</b> TODO / FIXME / HACK / XXX markers per line, as height and colour.',
  };

  // ---------- Hover and selection outlines ----------
  const hoverBox = new Box3();
  const outline = new Box3Helper(hoverBox, 0x3fd0c9);
  outline.visible = false;
  scene.add(outline);
  const selBox = new Box3();
  const selOutline = new Box3Helper(selBox, 0xff7a1a);
  selOutline.visible = false;
  scene.add(selOutline);
  const boxFor = (b: BuildingRow, target: Box3) => target.set(new Vector3(b[1] + ox - 0.15, 0, b[2] + oz - 0.15), new Vector3(b[3] + ox + 0.15, b[5] + 2.3, b[4] + oz + 0.15));

  // ---------- HUD ----------
  const brand = el('header', { class: 'brand' }, `${MARK}<div><div class="word">repoville</div><div class="repo" title="${esc(m.name)}">${esc(m.name)}${m.head ? `<span>@${m.head.slice(0, 7)}</span>` : ''}</div></div>`);
  const stats = el('dl', { class: 'stats' }, [
    ['files', compact(m.stats.files)],
    ['lines', compact(m.stats.loc)],
    [`commits · ${m.since}`, compact(m.stats.commits)],
    ['buildings', compact(m.stats.buildings)],
  ].map(([k, v]) => `<div><dt>${esc(k!)}</dt><dd>${esc(v!)}</dd></div>`).join(''));

  const dock = el('nav', { class: 'dock', 'aria-label': 'City controls' });
  dock.innerHTML = `
    <div class="search">${ICON.search}<input id="rv-search" type="search" placeholder="Find a file or folder" autocomplete="off" spellcheck="false" aria-label="Find a file or folder" aria-controls="rv-matches"><kbd>/</kbd></div>
    <button class="tool" id="rv-tour" title="Tour the highlights (T)" aria-pressed="false">${ICON.tour}<span>Tour</span></button>
    <button class="tool" id="rv-home" title="Fit the city (R)">${ICON.reset}<span>Fit</span></button>
    <button class="tool" id="rv-fly" title="Walk / fly (F)" aria-pressed="false">${ICON.fly}<span>Fly</span></button>
    <button class="tool" id="rv-view" title="Metric view (V)" aria-expanded="false" aria-controls="rv-viewmenu">${ICON.layers}<span>View</span></button>
    <button class="tool" id="rv-guide" title="Guide (G)" aria-expanded="false" aria-controls="rv-drawer">${ICON.guide}<span>Guide</span></button>`;
  const matches = el('ul', { class: 'matches', id: 'rv-matches', role: 'listbox' });
  matches.hidden = true;
  const viewMenu = el('div', { class: 'menu', id: 'rv-viewmenu' });
  viewMenu.hidden = true;
  viewMenu.innerHTML = `
    <div class="menu-h">Show</div>
    <button data-metric="none" aria-pressed="true">City</button>
    <button data-metric="churn" aria-pressed="false">Churn</button>
    <button data-metric="age" aria-pressed="false">Age</button>
    <button data-metric="todos" aria-pressed="false">TODO density</button>
    <div class="menu-h">Scene</div>
    <label><input type="checkbox" id="rv-labels" checked> District labels</label>
    <label><input type="checkbox" id="rv-flames" checked> Flames</label>
    <label><input type="checkbox" id="rv-shadows"> Shadows</label>`;
  const metricLegend = el('div', { class: 'metric-legend' });
  metricLegend.hidden = true;

  const h = m.highlights;
  const link = (path: string) => `<button class="path" data-path="${esc(path)}">${esc(path)}</button>`;
  const drawer = el('aside', { class: 'drawer', id: 'rv-drawer', 'aria-label': 'City guide' });
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="drawer-h"><span>City guide</span><button class="icon" id="rv-close" aria-label="Close guide">${ICON.close}</button></div>
    <section>
      ${h.hottestDistricts.length ? `<h3><i class="dot lava"></i>On fire</h3><ul>${h.hottestDistricts.map((d) => `<li>${link(d.path)}<span>${fmt(d.commits)} commits${d.burning ? ` · ${d.burning} burning` : ''}</span></li>`).join('')}</ul>` : ''}
      ${h.mostRuined.length ? `<h3><i class="dot red"></i>Ruins</h3><ul>${h.mostRuined.map((r) => `<li>${link(r.path)}<span>${r.todos} TODOs in ${fmt(r.loc)} lines</span></li>`).join('')}</ul>` : ''}
      ${h.oldestCorner ? `<h3><i class="dot moss"></i>Mossy corner</h3><ul><li>${link(h.oldestCorner.path)}<span>${h.oldestCorner.ageDays === null ? 'untouched 3+ years' : `untouched ${fmt(h.oldestCorner.ageDays)} days`}</span></li></ul>` : ''}
    </section>
    <section>
      <h3>Legend</h3>
      <dl class="legend">
        <dt>Folder</dt><dd>District with a name sign and plaza</dd>
        <dt>File</dt><dd>Building. Height = 4 + 4·√(lines/10), max 250</dd>
        <dt><i class="dot lava"></i>Fire</dt><dd>Top 10% churn in ${esc(m.since)}; soul fire top 2%</dd>
        <dt><i class="dot red"></i>Ruins</dt><dd>Share of wall = TODO markers per line</dd>
        <dt><i class="dot moss"></i>Moss</dt><dd>No commit for over a year</dd>
        <dt>Lighthouse</dt><dd>Tests (white lab blocks when large)</dd>
        <dt>Library</dt><dd>Docs and Markdown</dd>
        <dt>Workshop</dt><dd>Shell and config files</dd>
        <dt>Gold crown</dt><dd>Largest file of its folder</dd>
        <dt>Landmark</dt><dd>A whole folder, merged to keep big repos fast</dd>
      </dl>
      <p class="fine">Themes follow the language: TS/JS plains, Rust nether, Python jungle, Go frozen peaks, Java/Kotlin badlands, C/C++ deep caves, Ruby cherry grove.</p>
    </section>
    <section>
      <h3>Keys</h3>
      <dl class="keys"><dt><kbd>/</kbd></dt><dd>search</dd><dt><kbd>T</kbd></dt><dd>tour</dd><dt><kbd>R</kbd></dt><dd>fit city</dd><dt><kbd>F</kbd></dt><dd>fly: WASD, Space, Shift, Esc</dd><dt><kbd>V</kbd></dt><dd>metric view</dd><dt><kbd>G</kbd></dt><dd>guide</dd></dl>
    </section>
    <section class="share">
      <button class="wide" id="rv-badge">Copy README badge</button>
      <p class="fine">Generated by ${esc(m.generator)}. The analysis ran locally; this page holds only paths and counts.</p>
    </section>`;

  const card = el('div', { class: 'card', role: 'dialog', 'aria-label': 'Building details' });
  card.hidden = true;
  const tip = el('div', { class: 'tip', role: 'tooltip' });
  const foot = el('footer', { class: 'foot' }, `<a href="${esc(m.site)}" target="_blank" rel="noopener">repoville</a> · walk your codebase · Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.`);
  const labelLayer = el('div', { class: 'labels', 'aria-hidden': 'true' });
  ui.prepend(labelLayer);
  ui.append(brand, stats, metricLegend, card, tip, viewMenu, matches, dock, drawer, foot);

  function setMetric(next: Metric) {
    metric = next;
    for (const b of viewMenu.querySelectorAll<HTMLButtonElement>('[data-metric]')) b.setAttribute('aria-pressed', String(b.dataset.metric === next));
    metricLegend.innerHTML = `${METRIC_TEXT[next]}<span class="ramp" aria-hidden="true"></span>`;
    metricLegend.hidden = next === 'none';
    if (next === 'none') {
      metricMesh.visible = false;
      cityMeshes.forEach((c) => (c.visible = true));
      return;
    }
    const values = m.buildings.map((b) => (next === 'churn' ? b[7] : next === 'todos' ? (b[6] ? b[8] / b[6] : 0) : b[9] < 0 ? 3 * 365 : (m.headTime - b[9]) / DAY));
    const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
    const cap = sorted[Math.floor(sorted.length * 0.98)] || 1;
    m.buildings.forEach((b, i) => {
      const v = values[i]!;
      const hgt = next === 'age' ? b[5] + 1 : 1 + Math.min(1, v / cap) * 60;
      tmpM.makeScale(b[3] - b[1], hgt, b[4] - b[2]);
      tmpM.setPosition(b[1] + ox, 0.05, b[2] + oz);
      metricMesh.setMatrixAt(i, tmpM);
      metricMesh.setColorAt(i, v <= 0 ? tmpC.set(0x3a4252) : ramp(Math.sqrt(Math.min(1, v / cap))));
    });
    metricMesh.instanceMatrix.needsUpdate = true;
    if (metricMesh.instanceColor) metricMesh.instanceColor.needsUpdate = true;
    metricMesh.visible = true;
    cityMeshes.forEach((c) => (c.visible = false));
  }

  // ---------- District labels ----------
  const labelDistricts = m.districts
    .filter((d) => d[1] === 1 || (d[1] === 2 && (d[4] - d[2]) * (d[5] - d[3]) > span * span * 0.02))
    .sort((a, b) => (b[4] - b[2]) * (b[5] - b[3]) - (a[4] - a[2]) * (a[5] - a[3]))
    .slice(0, 24);
  const labels = labelDistricts.map((d) => {
    const node = el('button', { class: `label d${d[1]}`, tabindex: '-1' }, esc(d[0].split('/').pop() || d[0]));
    labelLayer.append(node);
    let top = 0;
    for (const b of m.buildings) if (b[0].startsWith(d[0] + '/')) top = Math.max(top, b[5]);
    return { node, pos: new Vector3((d[2] + d[4]) / 2 + ox, Math.min(top + 8, 70), (d[3] + d[5]) / 2 + oz), path: d[0] };
  });
  let showLabels = true;
  const projected = new Vector3();
  function placeLabels() {
    const w = window.innerWidth;
    const hh = window.innerHeight;
    const dist = camera.position.distanceTo(orbit.target);
    for (const l of labels) {
      projected.copy(l.pos).project(camera);
      const visible = showLabels && !fly.isLocked && projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
      const near = camera.position.distanceTo(l.pos) < dist * 2.2;
      l.node.style.display = visible && near ? 'block' : 'none';
      if (visible && near) l.node.style.transform = `translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * hh}px) translate(-50%, -100%)`;
    }
  }
  labelLayer.addEventListener('click', (e) => {
    const l = labels.find((x) => x.node === (e.target as HTMLElement).closest('.label'));
    if (l) focusPath(l.path);
  });

  // ---------- Picking ----------
  const boxes = m.buildings.map((b) => [b[1] + ox, 0, b[2] + oz, b[3] + ox, b[5] + 2, b[4] + oz] as const);
  function pick(clientX: number, clientY: number): number {
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -(clientY / window.innerHeight) * 2 + 1;
    const dir = new Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    const o = camera.position;
    const od = [o.x, o.y, o.z];
    const dd = [dir.x, dir.y, dir.z];
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      let t0 = 0;
      let t1 = bestT;
      for (let a = 0; a < 3 && t0 <= t1; a++) {
        const mn = b[a]!, mx = b[a + 3]!, oo = od[a]!, d = dd[a]!;
        if (Math.abs(d) < 1e-9) {
          if (oo < mn || oo > mx) t0 = Infinity;
          continue;
        }
        let ta = (mn - oo) / d;
        let tb = (mx - oo) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
      }
      if (t0 <= t1 && t0 < bestT) {
        bestT = t0;
        best = i;
      }
    }
    return best;
  }

  const districtOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
  function facts(b: BuildingRow): string {
    const [path, , , , , height, loc, churn, todos, last, fireLvl, mossy, lang, style, merged, landmark] = b;
    const tags: string[] = [];
    if (landmark) tags.push('<span class="tag gold">largest in its folder</span>');
    if (fireLvl === 2) tags.push('<span class="tag lava">soul fire · top 2% churn</span>');
    else if (fireLvl === 1) tags.push('<span class="tag lava">on fire · top 10% churn</span>');
    if (todos > 0) tags.push(`<span class="tag red">${todos} TODO${todos === 1 ? '' : 's'}</span>`);
    if (mossy) tags.push('<span class="tag moss">mossy</span>');
    return `<div class="path-full">${esc(path.split('/').pop()!)}${merged ? ` <em>${fmt(merged)} files</em>` : ''}</div>
      <dl class="facts">
        <div><dt>lines</dt><dd>${fmt(loc)}</dd></div>
        <div><dt>commits · ${esc(m.since)}</dt><dd>${fmt(churn)}</dd></div>
        <div><dt>last touched</dt><dd>${day(last)}</dd></div>
        <div><dt>language</dt><dd>${esc(lang)}</dd></div>
        <div><dt>building</dt><dd>${esc(style)}, ${height} high</dd></div>
      </dl>
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}`;
  }

  let hoverQueued = false;
  canvas.addEventListener('pointermove', (e) => {
    if (fly.isLocked || hoverQueued || e.buttons || e.pointerType === 'touch') return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const i = pick(e.clientX, e.clientY);
      if (i < 0) {
        tip.style.display = 'none';
        outline.visible = false;
        canvas.style.cursor = '';
        return;
      }
      const b = m.buildings[i]!;
      boxFor(b, hoverBox);
      outline.visible = true;
      canvas.style.cursor = 'pointer';
      tip.innerHTML = `<b>${esc(b[0].split('/').pop()!)}</b><span>${fmt(b[6])} lines · ${fmt(b[7])} commits</span>`;
      tip.style.display = 'block';
      tip.style.transform = `translate(${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px, ${Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8)}px)`;
    });
  });
  canvas.addEventListener('pointerleave', () => {
    tip.style.display = 'none';
    outline.visible = false;
  });

  function closeCard() {
    card.hidden = true;
    selOutline.visible = false;
  }
  function select(i: number) {
    const b = m.buildings[i]!;
    boxFor(b, selBox);
    selOutline.visible = true;
    const d = districtOf(b[0]);
    card.innerHTML = `<div class="card-h"><button class="path district" data-path="${esc(d)}">${esc(d || m.name)}/</button><button class="icon" id="rv-card-close" aria-label="Close details">${ICON.close}</button></div>${facts(b)}
      <div class="card-a"><button class="small" id="rv-link">Copy link to this building</button></div>`;
    card.hidden = false;
    card.querySelector('#rv-card-close')!.addEventListener('click', closeCard);
    card.querySelector('#rv-link')!.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(location.href);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Copy failed';
      }
      setTimeout(() => (btn.textContent = 'Copy link to this building'), 1400);
    });
  }

  // ---------- Camera moves ----------
  let anim: { from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; start: number; dur: number; done?: () => void } | null = null;
  function flyTo(pos: Vector3, target: Vector3, dur = 1300, done?: () => void) {
    anim = { from: camera.position.clone(), to: pos, tFrom: orbit.target.clone(), tTo: target, start: performance.now(), dur: reduceMotion ? 1 : dur, done };
  }
  function focusRect(x0: number, z0: number, x1: number, z1: number, height: number, done?: () => void) {
    const cx = (x0 + x1) / 2 + ox;
    const cz = (z0 + z1) / 2 + oz;
    // Fit the bounding sphere of the target (with some street around it) into the view.
    const w = Math.max(x1 - x0, 6) + 10;
    const d = Math.max(z1 - z0, 6) + 10;
    const radius = 0.5 * Math.sqrt(w * w + d * d + height * height);
    const vfov = (camera.fov * Math.PI) / 180;
    const fit = Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect));
    const dist = Math.max(30, (radius / Math.sin(fit / 2)) * 1.25);
    const dir = camera.position.clone().sub(orbit.target).setY(0);
    if (dir.lengthSq() < 1) dir.set(0.7, 0, 0.7);
    dir.normalize();
    const elev = (35 * Math.PI) / 180;
    const target = new Vector3(cx, height * 0.55, cz);
    const pos = target.clone().addScaledVector(dir, dist * Math.cos(elev));
    pos.y += dist * Math.sin(elev);
    flyTo(pos, target, 1300, done);
  }
  const byPath = new Map(m.buildings.map((b, i) => [b[0], i]));
  const districtByPath = new Map(m.districts.map((d) => [d[0], d]));
  function focusPath(path: string, done?: () => void) {
    const i = byPath.get(path);
    if (i !== undefined) {
      const b = m.buildings[i]!;
      focusRect(b[1], b[2], b[3], b[4], b[5], done);
      select(i);
      history.replaceState(null, '', `#f=${encodeURIComponent(path)}`);
      return;
    }
    const d = districtByPath.get(path === '(root)' ? '' : path);
    if (d) {
      let top = 0;
      const prefix = d[0] ? d[0] + '/' : '';
      for (const bb of m.buildings) if (bb[0].startsWith(prefix)) top = Math.max(top, bb[5]);
      closeCard();
      focusRect(d[2], d[3], d[4], d[5], Math.min(top, 80), done);
      history.replaceState(null, '', `#f=${encodeURIComponent(path)}`);
    }
  }
  let downAt = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    touring = false;
    setMenu(false);
    matches.hidden = true;
  });
  canvas.addEventListener('click', (e) => {
    if (fly.isLocked || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const i = pick(e.clientX, e.clientY);
    if (i >= 0) focusPath(m.buildings[i]![0]);
    else closeCard();
  });
  ui.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
    if (!t) return;
    focusPath(t.dataset.path!);
    if (window.innerWidth < 720) setDrawer(false);
    matches.hidden = true;
  });

  // ---------- Search ----------
  const search = dock.querySelector<HTMLInputElement>('#rv-search')!;
  const allDistricts = m.districts.map((d) => d[0]).filter(Boolean);
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) {
      matches.hidden = true;
      return;
    }
    const ds = allDistricts.filter((d) => d.toLowerCase().includes(q)).slice(0, 4);
    const fs = m.buildings.filter((b) => b[0].toLowerCase().includes(q)).slice(0, 10);
    matches.innerHTML = [
      ...ds.map((d) => `<li role="option"><button class="path" data-path="${esc(d)}"><i>folder</i>${esc(d)}/</button></li>`),
      ...fs.map((b) => `<li role="option"><button class="path" data-path="${esc(b[0])}"><i>${compact(b[6])} ln</i>${esc(b[0])}</button></li>`),
    ].join('') || '<li class="none">No match</li>';
    matches.hidden = false;
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') matches.querySelector<HTMLElement>('[data-path]')?.click();
    if (e.key === 'Escape') {
      search.blur();
      matches.hidden = true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      matches.querySelector<HTMLElement>('[data-path]')?.focus();
    }
  });
  matches.addEventListener('keydown', (e) => {
    const items = [...matches.querySelectorAll<HTMLElement>('[data-path]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') items[Math.min(items.length - 1, i + 1)]?.focus();
    if (e.key === 'ArrowUp') (i <= 0 ? search : items[i - 1])?.focus();
    if (e.key.startsWith('Arrow')) e.preventDefault();
  });

  // ---------- Dock buttons, drawer, menus ----------
  const guideBtn = dock.querySelector<HTMLButtonElement>('#rv-guide')!;
  const viewBtn = dock.querySelector<HTMLButtonElement>('#rv-view')!;
  function setDrawer(open: boolean) {
    drawer.hidden = !open;
    guideBtn.setAttribute('aria-expanded', String(open));
    if (open) setMenu(false);
  }
  function setMenu(open: boolean) {
    viewMenu.hidden = !open;
    viewBtn.setAttribute('aria-expanded', String(open));
    if (open && window.innerWidth < 720) setDrawer(false);
  }
  guideBtn.addEventListener('click', () => setDrawer(Boolean(drawer.hidden)));
  drawer.querySelector('#rv-close')!.addEventListener('click', () => setDrawer(false));
  viewBtn.addEventListener('click', () => setMenu(Boolean(viewMenu.hidden)));
  viewMenu.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-metric]');
    if (b) setMetric(b.dataset.metric as Metric);
  });
  const labelsBox = viewMenu.querySelector<HTMLInputElement>('#rv-labels')!;
  labelsBox.addEventListener('change', () => (showLabels = labelsBox.checked));
  const flamesBox = viewMenu.querySelector<HTMLInputElement>('#rv-flames')!;
  const shadowsBox = viewMenu.querySelector<HTMLInputElement>('#rv-shadows')!;
  shadowsBox.addEventListener('change', () => {
    userQuality = true;
    setQuality(shadowsBox.checked ? 'high' : 'low');
  });
  function setQuality(q: 'high' | 'low', auto = false) {
    quality = q;
    state.quality = q + (auto ? ' (auto)' : '');
    sun.castShadow = q === 'high';
    renderer.shadowMap.enabled = q === 'high';
    sun.shadow.needsUpdate = true;
    material.needsUpdate = true;
    renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    shadowsBox.checked = q === 'high';
  }
  setQuality(quality);

  function fitCity() {
    flyTo(homePos(), downtown.clone());
    closeCard();
    history.replaceState(null, '', location.pathname + location.search);
  }
  dock.querySelector('#rv-home')!.addEventListener('click', fitCity);
  drawer.querySelector('#rv-badge')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(m.badge);
      btn.textContent = 'Copied to clipboard';
    } catch {
      window.prompt('Badge markdown', m.badge);
    }
    setTimeout(() => (btn.textContent = 'Copy README badge'), 1600);
  });

  const flyBtn = dock.querySelector<HTMLButtonElement>('#rv-fly')!;
  flyBtn.addEventListener('click', () => fly.lock());
  fly.addEventListener('lock', () => {
    orbit.enabled = false;
    flyBtn.setAttribute('aria-pressed', 'true');
    document.body.classList.add('flying');
    tip.style.display = 'none';
    outline.visible = false;
  });
  fly.addEventListener('unlock', () => {
    orbit.enabled = true;
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 40);
    flyBtn.setAttribute('aria-pressed', 'false');
    document.body.classList.remove('flying');
  });

  let touring = false;
  const tourBtn = dock.querySelector<HTMLButtonElement>('#rv-tour')!;
  function tour() {
    const stops = [...h.hottestDistricts.map((d) => d.path), ...h.mostRuined.map((r) => r.path), ...(h.oldestCorner ? [h.oldestCorner.path] : [])];
    if (!stops.length) return;
    touring = true;
    tourBtn.setAttribute('aria-pressed', 'true');
    let i = 0;
    const next = () => {
      if (!touring || i >= stops.length) {
        touring = false;
        tourBtn.setAttribute('aria-pressed', 'false');
        return;
      }
      focusPath(stops[i++]!, () => setTimeout(next, 1800));
    };
    next();
  }
  tourBtn.addEventListener('click', () => (touring ? (touring = false) : tour()));

  const keys = new Set<string>();
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    const typing = (e.target as HTMLElement).tagName === 'INPUT';
    if (typing || fly.isLocked || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === '/') {
      e.preventDefault();
      search.focus();
    } else if (k === 't') touring ? (touring = false) : tour();
    else if (k === 'r') fitCity();
    else if (k === 'f') fly.lock();
    else if (k === 'g') setDrawer(Boolean(drawer.hidden));
    else if (k === 'v') setMenu(Boolean(viewMenu.hidden));
    else if (e.key === 'Escape') {
      setDrawer(false);
      setMenu(false);
      closeCard();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  // ---------- Loop ----------
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now();
  let frames = 0;
  let fpsT = last;
  const flySpeed = Math.max(20, span / 12);
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    meshNext(state.ready ? 0 : 28);
    if (anim) {
      const t = Math.min(1, (now - anim.start) / anim.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(anim.from, anim.to, e);
      orbit.target.lerpVectors(anim.tFrom, anim.tTo, e);
      if (t >= 1) {
        const done = anim.done;
        anim = null;
        done?.();
      }
    }
    if (fly.isLocked) {
      const s = flySpeed * dt * (keys.has('ControlLeft') ? 3 : 1);
      if (keys.has('KeyW')) fly.moveForward(s);
      if (keys.has('KeyS')) fly.moveForward(-s);
      if (keys.has('KeyD')) fly.moveRight(s);
      if (keys.has('KeyA')) fly.moveRight(-s);
      if (keys.has('Space')) camera.position.y += s;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) camera.position.y = Math.max(1.5, camera.position.y - s);
    } else {
      orbit.update();
    }
    flames.visible = flamesBox.checked && metric === 'none';
    if (!reduceMotion && flames.visible && burning.length) {
      const pos = fireGeo.getAttribute('position') as BufferAttribute;
      const tt = now / 1000;
      for (let j = 0; j < fireSeed.length; j++) {
        const b = burning[Math.floor(j / PER)]!;
        pos.array[j * 3 + 1] = b[5] + 1.5 + ((tt * 1.6 + fireSeed[j]!) % 3);
      }
      pos.needsUpdate = true;
    }
    renderer.render(scene, camera);
    placeLabels();
    frames++;
    if (now - fpsT > 1000) {
      state.fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Deep links: #f=<path>, #tour, ?view=churn|age|todos, ?ui=off
  const hash = decodeURIComponent(location.hash.slice(1));
  const whenReady = (fn: () => void) => (state.ready ? fn() : setTimeout(() => whenReady(fn), 100));
  if (hash.startsWith('f=')) whenReady(() => focusPath(hash.slice(2)));
  else if (hash === 'tour') whenReady(tour);
  const view = params.get('view');
  if (view === 'churn' || view === 'age' || view === 'todos') whenReady(() => setMetric(view));
  if (params.get('ui') === 'off') document.body.classList.add('no-ui');
}

try {
  main();
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal">Could not open this city: ${esc(String(err))}</div>`);
  throw err;
}
