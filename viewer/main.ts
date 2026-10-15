import { inflateSync } from 'fflate';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera,
  PlaneGeometry, Points, PointsMaterial, Scene, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { decodePayload, fillChunk, type BuildingRow, type Payload } from './format.js';
import { greedyMesh } from './mesher.js';

declare global {
  interface Window {
    __repoville?: { ready: boolean; chunks: number; chunksDone: number; quads: number; fps: number; buildings: number };
  }
}

const CHUNK = 32;
const LOGO = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l7 3.5-7 3.5-7-3.5z" fill="#4E8C3A"/><path d="M1 4.5l7 3.5v7l-7-3.5z" fill="#2E323B"/><path d="M15 4.5l-7 3.5v7l7-3.5z" fill="#1B1D23"/><path d="M3 10v-1l1 .5v1zM5 11.5v-3l1 .5v3zM7 13v-5l1 .5v5z" fill="#E8D9A8"/><path d="M7 8l1 .5v1l-1-.5z" fill="#FF7A1A"/><path d="M7.5 3.2h1v1h-1zM6.5 2.7h1v.6h-1zM8.5 2.7h1v.6h-1z" fill="#3FD0C9"/></svg>`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number) => n.toLocaleString('en-US');
const day = (t: number) => (t < 0 ? 'more than 3 years ago' : new Date(t * 1000).toISOString().slice(0, 10));

function loadPayload(): Payload {
  const raw = document.getElementById('city-data')!.textContent!.trim();
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return decodePayload(inflateSync(bytes));
}

function main() {
  const p = loadPayload();
  const m = p.meta;
  const state = { ready: false, chunks: 0, chunksDone: 0, quads: 0, fps: 0, buildings: m.buildings.length };
  window.__repoville = state;

  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new Scene();
  // Golden hour: the sky is a CSS gradient behind a transparent canvas; fog matches the horizon.
  document.body.style.background = 'linear-gradient(180deg,#1d2029 0%,#2c2d3a 38%,#6b4f3f 74%,#b8774a 100%)';
  const span = Math.max(m.width, m.length);
  scene.fog = new Fog(0x6b4f3f, span * 1.1, span * 3.2);

  const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, span * 6);
  const home = new Vector3(span * 0.62, Math.max(60, span * 0.5), span * 0.72);
  camera.position.copy(home);

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minDistance = 8;
  orbit.maxDistance = span * 3;
  orbit.target.set(0, 0, 0);
  orbit.update();

  const fly = new PointerLockControls(camera, document.body);

  // Ground around the city.
  const ground = new Mesh(new PlaneGeometry(span * 8, span * 8), new MeshBasicMaterial({ color: 0x3b4a32 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const material = new MeshBasicMaterial({ vertexColors: true });
  const ox = -m.width / 2;
  const oz = -m.length / 2;

  // Chunk queue, nearest to the city centre first.
  const queue: Array<[number, number]> = [];
  for (let cz = 0; cz < Math.ceil(m.length / CHUNK); cz++) for (let cx = 0; cx < Math.ceil(m.width / CHUNK); cx++) queue.push([cx, cz]);
  const cxm = m.width / CHUNK / 2;
  const czm = m.length / CHUNK / 2;
  queue.sort((a, b) => Math.hypot(a[0] - cxm, a[1] - czm) - Math.hypot(b[0] - cxm, b[1] - czm));
  state.chunks = queue.length;
  const vox = new Uint16Array((CHUNK + 2) * (CHUNK + 2) * m.height);

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
      const out = greedyMesh(vox, sx, top, sz, m.colors, m.kinds, [x0 + ox, 0, z0 + oz]);
      state.chunksDone++;
      if (!out.quads) continue;
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(out.positions, 3));
      geo.setAttribute('color', new BufferAttribute(out.colors, 3));
      geo.setIndex(new BufferAttribute(out.indices, 1));
      geo.computeBoundingSphere();
      scene.add(new Mesh(geo, material));
      state.quads += out.quads;
    }
    if (!queue.length && !state.ready) {
      state.ready = true;
      loading.remove();
    }
  }

  // Fire particles above burning roofs.
  const burning = m.buildings.filter((b) => b[10] > 0);
  const PER = 18;
  const firePos = new Float32Array(burning.length * PER * 3);
  const fireCol = new Float32Array(burning.length * PER * 3);
  const fireSeed = new Float32Array(burning.length * PER);
  const lava = new Color(0xff7a1a);
  const soul = new Color(0x3fd0c9);
  burning.forEach((b, i) => {
    for (let k = 0; k < PER; k++) {
      const j = i * PER + k;
      const r = Math.sin(j * 12.9898) * 43758.5453;
      const f = r - Math.floor(r);
      const g = (Math.sin(j * 78.233) * 12345.678) % 1;
      firePos[j * 3] = b[1] + ox + f * (b[3] - b[1]);
      firePos[j * 3 + 1] = b[5] + 2;
      firePos[j * 3 + 2] = b[2] + oz + Math.abs(g) * (b[4] - b[2]);
      const c = b[10] === 2 && k % 2 === 0 ? soul : lava;
      fireCol.set([c.r, c.g, c.b], j * 3);
      fireSeed[j] = f * 10;
    }
  });
  const fireGeo = new BufferGeometry();
  fireGeo.setAttribute('position', new BufferAttribute(firePos, 3));
  fireGeo.setAttribute('color', new BufferAttribute(fireCol, 3));
  const fire = new Points(fireGeo, new PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  scene.add(fire);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- UI ----------
  const ui = document.getElementById('ui')!;
  const loading = el('div', { class: 'loading', role: 'status' }, 'building the city…');
  ui.append(loading);

  const top = el('div', { class: 'top' });
  top.append(
    el('div', { class: 'panel brand' }, `${LOGO}<div><div class="word">repoville</div><div class="repo">${esc(m.name)}${m.head ? ` @ ${m.head.slice(0, 7)}` : ''}</div></div>`),
    el('div', { class: 'panel stats' }, `<span><b>${fmt(m.stats.files)}</b> files</span><span><b>${fmt(m.stats.loc)}</b> lines</span><span><b>${fmt(m.stats.commits)}</b> commits in ${esc(m.since)}</span><span><b>${fmt(m.stats.buildings)}</b> buildings</span><span><b>${m.width}×${m.length}</b> blocks</span>`),
  );
  ui.append(top);

  const side = el('div', { class: 'panel side', role: 'region', 'aria-label': 'City guide' });
  const h = m.highlights;
  const link = (path: string) => `<button class="link" data-path="${esc(path)}">${esc(path)}</button>`;
  side.innerHTML = `
    ${h.hottestDistricts.length ? `<h2>On fire</h2><ul>${h.hottestDistricts.map((d) => `<li>${link(d.path)} · ${fmt(d.commits)} commits${d.burning ? ` · ${d.burning} burning` : ''}</li>`).join('')}</ul>` : ''}
    ${h.mostRuined.length ? `<h2>Ruins</h2><ul>${h.mostRuined.map((r) => `<li>${link(r.path)} · ${r.todos} TODOs in ${fmt(r.loc)} lines</li>`).join('')}</ul>` : ''}
    ${h.oldestCorner ? `<h2>Mossy corner</h2><ul><li>${link(h.oldestCorner.path)} · ${h.oldestCorner.ageDays === null ? 'untouched 3+ years' : `untouched ${fmt(h.oldestCorner.ageDays)} days`}</li></ul>` : ''}
    <h2>Legend</h2>
    <div class="legend">
      <span>folder</span><span>district with a name sign</span>
      <span>file</span><span>building, height from lines of code</span>
      <span><i class="sw" style="background:#FF7A1A"></i>fire</span><span>most-changed files in ${esc(m.since)}</span>
      <span><i class="sw" style="background:#3FD0C9"></i>soul fire</span><span>top 2% churn</span>
      <span><i class="sw" style="background:#6e6e6e"></i>ruins</span><span>share of TODO/FIXME lines</span>
      <span><i class="sw" style="background:#596e2d"></i>moss</span><span>untouched for over a year</span>
      <span><i class="sw" style="background:#cfd5d6"></i>lighthouse</span><span>tests</span>
      <span><i class="sw" style="background:#75502e"></i>library</span><span>docs</span>
    </div>`;
  ui.append(side);

  const right = el('div', { class: 'panel right' });
  right.innerHTML = `
    <label class="hint" for="rv-search">Find a file</label>
    <input id="rv-search" type="search" placeholder="src/auth…" autocomplete="off" spellcheck="false">
    <div class="matches" id="rv-matches"></div>
    <div class="btns">
      <button class="btn" id="rv-tour">Tour</button>
      <button class="btn" id="rv-fly" title="WASD to move, mouse to look, Esc to leave">Fly</button>
      <button class="btn" id="rv-home">Reset</button>
      <button class="btn" id="rv-badge">Copy badge</button>
      <button class="btn" id="rv-guide" aria-expanded="true">Guide</button>
    </div>
    <div class="hint" id="rv-hint">Drag to orbit · scroll to zoom · click a building</div>`;
  ui.append(right);

  const bottom = el('div', { class: 'bottom' });
  bottom.innerHTML = `<span>Made with <a href="${esc(m.site)}" target="_blank" rel="noopener">repoville</a> · analysis ran locally</span><span>NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.</span>`;
  ui.append(bottom);

  const tip = el('div', { class: 'panel tip', role: 'tooltip' });
  ui.append(tip);

  // ---------- Picking ----------
  const box = (b: BuildingRow) => ({ minX: b[1] + ox, maxX: b[3] + ox, minY: 0, maxY: b[5] + 2, minZ: b[2] + oz, maxZ: b[4] + oz });
  const boxes = m.buildings.map(box);
  const ndc = { x: 0, y: 0 };
  function pick(clientX: number, clientY: number): number {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    const dir = new Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const o = camera.position;
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      let t0 = 0, t1 = bestT;
      for (const [mn, mx, oo, dd] of [[b.minX, b.maxX, o.x, dir.x], [b.minY, b.maxY, o.y, dir.y], [b.minZ, b.maxZ, o.z, dir.z]] as const) {
        if (Math.abs(dd) < 1e-9) {
          if (oo < mn || oo > mx) { t0 = Infinity; break; }
          continue;
        }
        let ta = (mn - oo) / dd, tb = (mx - oo) / dd;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < bestT) { bestT = t0; best = i; }
    }
    return best;
  }

  function describe(b: BuildingRow): string {
    const [path, , , , , height, loc, churn, todos, last, fireLvl, mossy, lang, style, merged] = b;
    const tags: string[] = [];
    if (fireLvl === 2) tags.push('<span class="hot">soul fire · top 2% churn</span>');
    else if (fireLvl === 1) tags.push('<span class="hot">on fire · top 10% churn</span>');
    if (todos > 0) tags.push(`<span class="ruin">${todos} TODO/FIXME</span>`);
    if (mossy) tags.push('<span class="moss">mossy</span>');
    return `<div class="p">${esc(path)}${merged ? ` <span class="k">(${fmt(merged)} files)</span>` : ''}</div>
      <div><span class="k">lines</span> ${fmt(loc)} · <span class="k">height</span> ${height} · <span class="k">${esc(lang)}</span>${style !== 'tower' ? ` · ${esc(style)}` : ''}</div>
      <div><span class="k">commits in ${esc(m.since)}</span> ${fmt(churn)} · <span class="k">last touched</span> ${day(last)}</div>
      ${tags.length ? `<div>${tags.join(' · ')}</div>` : ''}`;
  }

  let hoverQueued = false;
  canvas.addEventListener('pointermove', (e) => {
    if (fly.isLocked || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const i = pick(e.clientX, e.clientY);
      if (i < 0) { tip.style.display = 'none'; return; }
      tip.innerHTML = describe(m.buildings[i]!);
      tip.style.display = 'block';
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    });
  });
  canvas.addEventListener('pointerleave', () => (tip.style.display = 'none'));

  // ---------- Camera moves ----------
  let anim: { from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; start: number; dur: number; done?: () => void } | null = null;
  function flyTo(pos: Vector3, target: Vector3, dur = 1400, done?: () => void) {
    if (reduceMotion) dur = 1;
    anim = { from: camera.position.clone(), to: pos, tFrom: orbit.target.clone(), tTo: target, start: performance.now(), dur, done };
  }
  function focusRect(x0: number, z0: number, x1: number, z1: number, height: number, done?: () => void) {
    const cx = (x0 + x1) / 2 + ox;
    const cz = (z0 + z1) / 2 + oz;
    const size = Math.max(x1 - x0, z1 - z0, height, 12);
    flyTo(new Vector3(cx + size * 1.4, height + size * 1.1, cz + size * 1.6), new Vector3(cx, height * 0.5, cz), 1400, done);
  }
  const byPath = new Map(m.buildings.map((b) => [b[0], b]));
  const districtByPath = new Map(m.districts.map((d) => [d[0], d]));
  function focusPath(path: string, done?: () => void) {
    const b = byPath.get(path);
    if (b) {
      focusRect(b[1], b[2], b[3], b[4], b[5], done);
      history.replaceState(null, '', `#f=${encodeURIComponent(path)}`);
      return;
    }
    const d = districtByPath.get(path) ?? districtByPath.get(path === '(root)' ? '' : path);
    if (d) {
      let top = 0;
      for (const bb of m.buildings) if (bb[0].startsWith(d[0] + '/')) top = Math.max(top, bb[5]);
      focusRect(d[2], d[3], d[4], d[5], top, done);
      history.replaceState(null, '', `#f=${encodeURIComponent(path)}`);
    }
  }
  canvas.addEventListener('click', (e) => {
    if (fly.isLocked) return;
    const i = pick(e.clientX, e.clientY);
    if (i >= 0) focusPath(m.buildings[i]![0]);
  });
  side.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-path]');
    if (t) focusPath(t.getAttribute('data-path')!);
  });

  // ---------- Search ----------
  const search = right.querySelector<HTMLInputElement>('#rv-search')!;
  const matches = right.querySelector<HTMLDivElement>('#rv-matches')!;
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) { matches.innerHTML = ''; return; }
    const hits = m.buildings.filter((b) => b[0].toLowerCase().includes(q)).slice(0, 12);
    matches.innerHTML = hits.map((b) => `<div><button class="link" data-path="${esc(b[0])}" style="all:unset;cursor:pointer;color:#3FD0C9;font:12px 'JetBrains Mono',monospace;word-break:break-all">${esc(b[0])}</button></div>`).join('') || '<div class="hint">no match</div>';
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') matches.querySelector<HTMLElement>('[data-path]')?.click();
  });
  matches.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-path]');
    if (t) focusPath(t.getAttribute('data-path')!);
  });

  // ---------- Buttons ----------
  const hint = right.querySelector<HTMLDivElement>('#rv-hint')!;
  right.querySelector('#rv-home')!.addEventListener('click', () => {
    flyTo(home.clone(), new Vector3(0, 0, 0));
    history.replaceState(null, '', location.pathname + location.search);
  });
  const guideBtn = right.querySelector<HTMLButtonElement>('#rv-guide')!;
  guideBtn.addEventListener('click', () => {
    const open = side.style.display !== 'none' && !(window.innerWidth <= 720 && !side.classList.contains('open'));
    if (window.innerWidth <= 720) side.classList.toggle('open');
    else side.style.display = open ? 'none' : '';
    guideBtn.setAttribute('aria-expanded', String(!open));
  });
  right.querySelector('#rv-badge')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(m.badge);
      btn.textContent = 'Copied';
    } catch {
      window.prompt('Badge markdown', m.badge);
    }
    setTimeout(() => (btn.textContent = 'Copy badge'), 1500);
  });

  const flyBtn = right.querySelector<HTMLButtonElement>('#rv-fly')!;
  flyBtn.addEventListener('click', () => fly.lock());
  fly.addEventListener('lock', () => {
    orbit.enabled = false;
    flyBtn.classList.add('on');
    hint.textContent = 'WASD move · Space up · Shift down · Esc to leave';
    tip.style.display = 'none';
  });
  fly.addEventListener('unlock', () => {
    orbit.enabled = true;
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 40);
    flyBtn.classList.remove('on');
    hint.textContent = 'Drag to orbit · scroll to zoom · click a building';
  });
  const keys = new Set<string>();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));

  // Tour: hottest districts, ruins, mossy corner.
  let touring = false;
  const tourBtn = right.querySelector<HTMLButtonElement>('#rv-tour')!;
  function tour() {
    const stops = [
      ...h.hottestDistricts.map((d) => d.path),
      ...h.mostRuined.map((r) => r.path),
      ...(h.oldestCorner ? [h.oldestCorner.path] : []),
    ];
    if (!stops.length) return;
    touring = true;
    tourBtn.classList.add('on');
    let i = 0;
    const next = () => {
      if (!touring || i >= stops.length) {
        touring = false;
        tourBtn.classList.remove('on');
        return;
      }
      focusPath(stops[i++]!, () => setTimeout(next, 1600));
    };
    next();
  }
  tourBtn.addEventListener('click', () => (touring ? (touring = false) : tour()));

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
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
    if (!reduceMotion && burning.length) {
      const pos = fireGeo.getAttribute('position') as BufferAttribute;
      const tt = now / 1000;
      for (let j = 0; j < fireSeed.length; j++) {
        const b = burning[Math.floor(j / PER)]!;
        pos.array[j * 3 + 1] = b[5] + 1.5 + ((tt * 1.6 + fireSeed[j]!) % 3);
      }
      pos.needsUpdate = true;
    }
    renderer.render(scene, camera);
    frames++;
    if (now - fpsT > 1000) {
      state.fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Deep link: #f=<path> or #tour
  const hash = decodeURIComponent(location.hash.slice(1));
  const waitReady = (fn: () => void) => (state.ready ? fn() : setTimeout(() => waitReady(fn), 100));
  if (hash.startsWith('f=')) waitReady(() => focusPath(hash.slice(2)));
  else if (hash === 'tour') waitReady(tour);
}

try {
  main();
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#F6F1E4;font:14px Inter,sans-serif;padding:16px;text-align:center">Could not open this city: ${esc(String(err))}</div>`);
  throw err;
}
