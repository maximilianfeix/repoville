import { inflateSync } from 'fflate';
import {
  ACESFilmicToneMapping, AdditiveBlending, Box3, DataArrayTexture, DataTexture, FloatType, RedFormat, LinearMipmapLinearFilter, NearestFilter, RGBAFormat, UnsignedByteType, Box3Helper, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, Fog,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, PCFShadowMap,
  PerspectiveCamera, Points, PointsMaterial, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decodePayload, fillChunk, type BuildingRow, type Payload } from './format.js';
import { greedyMesh } from './mesher.js';
import { buildDetailLayers, familyOf, FAMILIES, TILE } from './textures.js';
import { loadMcLayers } from './mctextures.js';
import { buildPixelLayers, TILE as PIX_TILE } from './pixeltex.js';

declare global {
  interface Window {
    __repoville?: { ready: boolean; chunks: number; chunksDone: number; quads: number; fps: number; buildings: number; quality: string; focus?: (path: string) => void; fit?: () => void };
  }
}

const CHUNK = 32;
const DAY = 86400;
const MARK = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#16181D" d="M6.4 46.3L32 59.1L32 62.7L6.4 49.9Z"/><path fill="#23262E" d="M57.6 46.3L32 59.1L32 62.7L57.6 49.9Z"/><path fill="#2E323B" d="M32 33.5L57.6 46.3L32 59.1L6.4 46.3Z"/><path fill="none" stroke="#3FD0C9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12.48 47.1L32 56.86M22.72 52.22L38.4 53.34"/><path fill="#E8D9A8" d="M22.4 40.86L32 45.66L32 14.16L22.4 9.36Z"/><path fill="#A8996E" d="M41.6 40.86L32 45.66L32 14.16L41.6 9.36Z"/><path fill="#F6F1E4" d="M32 4.56L41.6 9.36L32 14.16L22.4 9.36Z"/><path fill="#3A3F4B" d="M24.8 38.46L26.72 39.42L26.72 37.32L24.8 36.36Z"/><path fill="#6E6650" d="M39.2 38.46L37.28 39.42L37.28 37.32L39.2 36.36Z"/><path fill="#3A3F4B" d="M27.68 39.9L29.6 40.86L29.6 38.76L27.68 37.8Z"/><path fill="#6E6650" d="M36.32 39.9L34.4 40.86L34.4 38.76L36.32 37.8Z"/><path fill="#3A3F4B" d="M24.8 33.66L26.72 34.62L26.72 32.52L24.8 31.56Z"/><path fill="#6E6650" d="M39.2 33.66L37.28 34.62L37.28 32.52L39.2 31.56Z"/><path fill="#3A3F4B" d="M27.68 35.1L29.6 36.06L29.6 33.96L27.68 33Z"/><path fill="#6E6650" d="M36.32 35.1L34.4 36.06L34.4 33.96L36.32 33Z"/><path fill="#3A3F4B" d="M24.8 28.86L26.72 29.82L26.72 27.72L24.8 26.76Z"/><path fill="#6E6650" d="M39.2 28.86L37.28 29.82L37.28 27.72L39.2 26.76Z"/><path fill="#3A3F4B" d="M27.68 30.3L29.6 31.26L29.6 29.16L27.68 28.2Z"/><path fill="#6E6650" d="M36.32 30.3L34.4 31.26L34.4 29.16L36.32 28.2Z"/><path fill="#3A3F4B" d="M24.8 24.06L26.72 25.02L26.72 22.92L24.8 21.96Z"/><path fill="#6E6650" d="M39.2 24.06L37.28 25.02L37.28 22.92L39.2 21.96Z"/><path fill="#3A3F4B" d="M27.68 25.5L29.6 26.46L29.6 24.36L27.68 23.4Z"/><path fill="#6E6650" d="M36.32 25.5L34.4 26.46L34.4 24.36L36.32 23.4Z"/><path fill="#3A3F4B" d="M24.8 19.26L26.72 20.22L26.72 18.12L24.8 17.16Z"/><path fill="#6E6650" d="M39.2 19.26L37.28 20.22L37.28 18.12L39.2 17.16Z"/><path fill="#3A3F4B" d="M27.68 20.7L29.6 21.66L29.6 19.56L27.68 18.6Z"/><path fill="#6E6650" d="M36.32 20.7L34.4 21.66L34.4 19.56L36.32 18.6Z"/><path fill="#3A3F4B" d="M24.8 14.46L26.72 15.42L26.72 13.32L24.8 12.36Z"/><path fill="#6E6650" d="M39.2 14.46L37.28 15.42L37.28 13.32L39.2 12.36Z"/><path fill="#3A3F4B" d="M27.68 15.9L29.6 16.86L29.6 14.76L27.68 13.8Z"/><path fill="#6E6650" d="M36.32 15.9L34.4 16.86L34.4 14.76L36.32 13.8Z"/><path fill="#FFB066" d="M32 3.66L36.8 6.06L32 8.46L27.2 6.06Z"/><path fill="#FF7A1A" d="M27.2 9.36L32 11.76L32 8.46L27.2 6.06Z"/><path fill="#D45F10" d="M36.8 9.36L32 11.76L32 8.46L36.8 6.06Z"/><path fill="#E8D9A8" d="M35.2 46.62L43.52 50.78L43.52 30.38L35.2 26.22Z"/><path fill="#A8996E" d="M51.84 46.62L43.52 50.78L43.52 30.38L51.84 26.22Z"/><path fill="#F6F1E4" d="M43.52 22.06L51.84 26.22L43.52 30.38L35.2 26.22Z"/><path fill="#3A3F4B" d="M37.28 44.06L38.94 44.89L38.94 42.79L37.28 41.96Z"/><path fill="#6E6650" d="M49.76 44.06L48.1 44.89L48.1 42.79L49.76 41.96Z"/><path fill="#3A3F4B" d="M39.78 45.31L41.44 46.14L41.44 44.04L39.78 43.21Z"/><path fill="#6E6650" d="M47.26 45.31L45.6 46.14L45.6 44.04L47.26 43.21Z"/><path fill="#3A3F4B" d="M37.28 39.26L38.94 40.09L38.94 37.99L37.28 37.16Z"/><path fill="#6E6650" d="M49.76 39.26L48.1 40.09L48.1 37.99L49.76 37.16Z"/><path fill="#3A3F4B" d="M39.78 40.51L41.44 41.34L41.44 39.24L39.78 38.41Z"/><path fill="#6E6650" d="M47.26 40.51L45.6 41.34L45.6 39.24L47.26 38.41Z"/><path fill="#3A3F4B" d="M37.28 34.46L38.94 35.29L38.94 33.19L37.28 32.36Z"/><path fill="#6E6650" d="M49.76 34.46L48.1 35.29L48.1 33.19L49.76 32.36Z"/><path fill="#3A3F4B" d="M39.78 35.71L41.44 36.54L41.44 34.44L39.78 33.61Z"/><path fill="#6E6650" d="M47.26 35.71L45.6 36.54L45.6 34.44L47.26 33.61Z"/><path fill="#E8D9A8" d="M16 46.62L24.32 50.78L24.32 38.78L16 34.62Z"/><path fill="#A8996E" d="M31.36 47.26L24.32 50.78L24.32 38.78L31.36 35.26Z"/><path fill="#F6F1E4" d="M23.04 31.1L31.36 35.26L24.32 38.78L16 34.62Z"/><path fill="#3A3F4B" d="M18.08 44.06L19.74 44.89L19.74 42.79L18.08 41.96Z"/><path fill="#6E6650" d="M29.6 44.54L28.19 45.24L28.19 43.14L29.6 42.44Z"/><path fill="#3A3F4B" d="M20.58 45.31L22.24 46.14L22.24 44.04L20.58 43.21Z"/><path fill="#6E6650" d="M27.49 45.6L26.08 46.3L26.08 44.2L27.49 43.5Z"/><path fill="#3A3F4B" d="M18.08 39.26L19.74 40.09L19.74 37.99L18.08 37.16Z"/><path fill="#6E6650" d="M29.6 39.74L28.19 40.44L28.19 38.34L29.6 37.64Z"/><path fill="#3A3F4B" d="M20.58 40.51L22.24 41.34L22.24 39.24L20.58 38.41Z"/><path fill="#6E6650" d="M27.49 40.8L26.08 41.5L26.08 39.4L27.49 38.7Z"/></svg>`;

const ICON = {
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 2a5 5 0 1 0 3.1 8.9l3 3 1.4-1.4-3-3A5 5 0 0 0 7 2Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>',
  tour: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 1 7h2v7h4v-4h2v4h4V7h2z"/></svg>',
  fly: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 6 6 1 8l5 2 2 5 2-5 5-2-5-2z"/></svg>',
  layers: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 7 4-7 4-7-4zm-5.3 6.2L8 10.3l5.3-3.1L15 8l-7 4-7-4zm0 3L8 13.3l5.3-3.1L15 11l-7 4-7-4z"/></svg>',
  guide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h12v2H2zm0 5h12v2H2zm0 5h8v2H2z"/></svg>',
  camera: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2 4.5 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2.5l-1-2zM8 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>',
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

type Metric = 'none' | 'churn' | 'age' | 'todos' | 'history' | 'diff';

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

  const hemi = new HemisphereLight(0xcfdcff, 0x7a5f45, 1.5);
  scene.add(hemi);
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

  // ---------- Pixel detail textures (procedural, original) ----------
  const detailTex = new DataArrayTexture(buildDetailLayers(), TILE, TILE, FAMILIES.length);
  detailTex.format = RGBAFormat;
  detailTex.type = UnsignedByteType;
  detailTex.magFilter = NearestFilter;
  detailTex.minFilter = LinearMipmapLinearFilter;
  detailTex.generateMipmaps = true;
  detailTex.needsUpdate = true;
  const sideLayer = m.states.map((st) => FAMILIES.indexOf(familyOf(st)));
  const topLayer = m.states.map((st, i) => (/_log|_stem|pillar/.test(st) ? FAMILIES.indexOf('logTop') : sideLayer[i]!));
  const detail = { value: params.get('textures') === '0' ? 0 : 1 };
  // Pixel textures v2: coloured, hue-shifted 16×16 tiles per (material family, palette colour).
  const pix = buildPixelLayers(m.states, m.colors, familyOf);
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const maxLayers = (gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number) || 256;
  const pixTex = new DataArrayTexture(pix.data, PIX_TILE, PIX_TILE, Math.max(1, pix.layers));
  pixTex.format = RGBAFormat;
  pixTex.type = UnsignedByteType;
  pixTex.colorSpace = SRGBColorSpace;
  pixTex.magFilter = NearestFilter;
  pixTex.minFilter = LinearMipmapLinearFilter;
  pixTex.generateMipmaps = true;
  pixTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  pixTex.needsUpdate = true;
  const pixLut = new DataTexture(pix.lut, Math.max(1, m.states.length * 2), 1, RedFormat, FloatType);
  pixLut.magFilter = NearestFilter;
  pixLut.minFilter = NearestFilter;
  pixLut.needsUpdate = true;
  // Fall back to the classic grey detail maps on GPUs with too few array layers, or on request.
  const pixMode = { value: params.get('textures') === 'classic' || pix.layers > maxLayers ? 0 : 1 };
  // Optional original textures, fetched at runtime (see mctextures.ts). A 1-layer placeholder until loaded.
  const mcMap = { value: new DataArrayTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, 1) };
  mcMap.value.needsUpdate = true;
  const mcMode = { value: 0 };
  const night = { value: params.get('time') === 'night' ? 1 : 0 };
  const glassLayer = FAMILIES.indexOf('glass');
  let mcLoaded: Promise<void> | null = null;
  function enableMcTextures(on: boolean) {
    if (!on) {
      mcMode.value = 0;
      syncUrl();
      return Promise.resolve();
    }
    if (!mcLoaded) {
      progress.style.setProperty('--p', '0');
      document.body.classList.remove('ready');
      mcLoaded = loadMcLayers(m.states, m.colors, (d, t) => progress.style.setProperty('--p', String(d / t))).then((layers) => {
        const t = new DataArrayTexture(layers, 16, 16, m.states.length * 2);
        t.format = RGBAFormat;
        t.type = UnsignedByteType;
        t.colorSpace = SRGBColorSpace;
        t.magFilter = NearestFilter;
        t.minFilter = LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.needsUpdate = true;
        mcMap.value = t;
        document.body.classList.add('ready');
      });
    }
    return mcLoaded.then(() => {
      mcMode.value = 1;
      syncUrl();
    });
  }

  // ---------- City meshes (progressive, nearest chunks first) ----------
  const material = new MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTex };
    shader.uniforms.detailStrength = detail;
    shader.uniforms.mcMap = mcMap;
    shader.uniforms.pixMap = { value: pixTex };
    shader.uniforms.pixLut = { value: pixLut };
    shader.uniforms.pixMode = pixMode;
    shader.uniforms.mcMode = mcMode;
    shader.uniforms.night = night;
    shader.uniforms.glassLayer = { value: glassLayer };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tex;\nvarying vec4 vTex;\nvarying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTex = tex;\nvUp = normal.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray detailMap;\nuniform highp sampler2DArray mcMap;\nuniform highp sampler2DArray pixMap;\nuniform highp sampler2D pixLut;\nuniform float pixMode;\nuniform float detailStrength;\nuniform float mcMode;\nuniform float night;\nuniform float glassLayer;\nvarying vec4 vTex;\nvarying float vUp;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 st = vTex.xy;
          vec2 gx = dFdx(st), gy = dFdy(st);
          float layer = mod(vTex.z, 64.0);
          float pid = floor(vTex.z / 64.0 + 0.001);
          if (mcMode > 0.5) {
            // Original textures: colour from the texture, light and AO from the mesh.
            float face = vUp > 0.5 ? 0.0 : 1.0;
            vec3 mc = textureGrad(mcMap, vec3(fract(st), pid * 2.0 + face), gx, gy).rgb;
            diffuseColor.rgb = mc * vTex.w;
          } else if (pixMode > 0.5 && detailStrength > 0.5) {
            // Coloured pixel tile for this palette id and face; light and AO from the mesh.
            float pface = vUp > 0.5 ? 0.0 : 1.0;
            float pl = texelFetch(pixLut, ivec2(int(pid) * 2 + int(pface), 0), 0).r;
            diffuseColor.rgb = textureGrad(pixMap, vec3(fract(st), pl), gx, gy).rgb * vTex.w;
          } else {
            // Gradients from the continuous coordinate keep mip selection stable across tile seams.
            float dd = textureGrad(detailMap, vec3(fract(st), layer), gx, gy).r * (255.0 / 128.0);
            diffuseColor.rgb *= mix(1.0, dd, detailStrength);
          }
          // Night: about 60% of windows are lit, chosen per window by a hash.
          if (night > 0.5 && abs(layer - glassLayer) < 0.5 && vUp < 0.5) {
            vec2 cell = floor(st + 0.001);
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233)) + pid) * 43758.5453);
            if (h < 0.6) diffuseColor.rgb = vec3(1.0, 0.6, 0.24) * (0.8 + 0.6 * h) * 1.7;
          }
        }`,
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (night > 0.5 && abs(mod(vTex.z, 64.0) - glassLayer) < 0.5 && vUp < 0.5 && diffuseColor.r > 0.9) totalEmissiveRadiance = diffuseColor.rgb * 0.55;`);
  };
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
    chunkOf.clear(); // drop references to the pre-merge geometry
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
      const out = greedyMesh(vox, sx, top, sz, m.colors, m.kinds, [x0 + ox, 0, z0 + oz], true, bakeAo, { side: sideLayer, top: topLayer, origin: [x0, z0] });
      state.chunksDone++;
      progress.style.setProperty('--p', String(state.chunksDone / state.chunks));
      if (!out.quads) continue;
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(out.positions, 3));
      geo.setAttribute('normal', new BufferAttribute(out.normals, 3));
      geo.setAttribute('tex', new BufferAttribute(out.tex, 4));
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
  // One ramp per metric, in the colour the brand reserves for it.
  const RAMPS: Record<'churn' | 'age' | 'todos', Color[]> = {
    churn: [new Color(0x3a4252), new Color(0x8a5a2b), new Color(0xe8a04a), new Color(0xff7a1a)],
    todos: [new Color(0x3a4252), new Color(0x7a3a36), new Color(0xd9382b), new Color(0xff8a7f)],
    age: [new Color(0x3fd0c9), new Color(0x4e8c3a), new Color(0x7a8a4a), new Color(0x596e2d)],
  };
  let RAMP = RAMPS.churn;
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
    diff: m.diff
      ? `<b>Diff</b> vs ${esc(m.diff.base)} (${esc(m.diff.baseCommit.slice(0, 7))}): <span style="color:#3FD0C9">${m.diff.files.filter((f) => f[1] === 'A').length} added</span>, <span style="color:#FF7A1A">${m.diff.files.filter((f) => f[1] === 'M').length} changed</span>, ${m.diff.deletedCount} deleted${m.diff.deleted.length ? ` <details><summary>deleted files</summary>${m.diff.deleted.slice(0, 30).map(esc).join('<br>')}${m.diff.deletedCount > 30 ? '<br>…' : ''}</details>` : ''}`
      : '',
    history: '<b>History</b> the city growing commit by commit (line counts from git, scaled to today\'s heights).',
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
  const brand = el('header', { class: 'brand' }, `${MARK}<div><div class="word">repoville</div><div class="repo" title="${esc(m.name)}">${esc(m.name)}${m.head ? `<span>@${esc(m.head.slice(0, 7))}</span>` : ''}</div></div>`);
  const stats = el('dl', { class: 'stats' }, [
    ['files', compact(m.stats.files)],
    ['lines', compact(m.stats.loc)],
    [`commits · ${m.since}`, compact(m.stats.commits)],
    ['buildings', compact(m.stats.buildings)],
  ].map(([k, v]) => `<div><dt>${esc(k!)}</dt><dd>${esc(v!)}</dd></div>`).join(''));

  const dock = el('nav', { class: 'dock', 'aria-label': 'City controls' });
  dock.innerHTML = `
    <div class="search">${ICON.search}<input id="rv-search" type="search" placeholder="Search files" autocomplete="off" spellcheck="false" aria-label="Find a file or folder" aria-controls="rv-matches"><kbd>/</kbd></div>
    <button class="tool" id="rv-tour" title="Tour the highlights (T)" aria-pressed="false">${ICON.tour}<span>Tour</span></button>
    <button class="tool" id="rv-home" title="Fit the city (R)">${ICON.reset}<span>Fit</span></button>
    <button class="tool" id="rv-fly" title="Walk / fly (F)" aria-pressed="false">${ICON.fly}<span>Fly</span></button>
    <button class="tool" id="rv-view" title="Metric view (V)" aria-expanded="false" aria-controls="rv-viewmenu">${ICON.layers}<span>View</span></button>
    <button class="tool" id="rv-guide" title="Guide (G)" aria-expanded="false" aria-controls="rv-drawer">${ICON.guide}<span>Guide</span></button>
    <button class="tool" id="rv-shot" title="Save a screenshot (P)">${ICON.camera}<span>Photo</span></button>`;
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
    ${m.timeline ? '<button data-metric="history" aria-pressed="false">History (time-lapse)</button>' : ''}
    ${m.diff ? '<button data-metric="diff" aria-pressed="false">Diff</button>' : ''}
    <div class="menu-h">Scene</div>
    <label><input type="checkbox" id="rv-textures" checked> Pixel textures</label>
    <label title="Loads the original block textures from jsDelivr at runtime"><input type="checkbox" id="rv-mc"> Minecraft textures</label>
    <label><input type="checkbox" id="rv-night"> Night</label>
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
      <h3>Districts</h3>
      <ul class="districts" id="rv-districts"></ul>
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
      <dl class="keys"><dt><kbd>/</kbd></dt><dd>search</dd><dt><kbd>T</kbd></dt><dd>tour</dd><dt><kbd>R</kbd></dt><dd>fit city</dd><dt><kbd>F</kbd></dt><dd>fly: WASD, Space, Shift, Esc</dd><dt><kbd>V</kbd></dt><dd>metric view</dd><dt><kbd>G</kbd></dt><dd>guide</dd><dt><kbd>P</kbd></dt><dd>save a screenshot</dd></dl>
    </section>
    <section class="share">
      <button class="wide" id="rv-badge">Copy README badge</button>
      <p class="fine">Generated by ${esc(m.generator)}. The analysis ran locally; this page holds only paths and counts.</p>
    </section>`;

  const card = el('div', { class: 'card', role: 'dialog', 'aria-label': 'Building details' });
  card.hidden = true;
  const tip = el('div', { class: 'tip', role: 'tooltip' });
  const foot = el('footer', { class: 'foot' }, `Made with <a href="${esc(m.site)}" target="_blank" rel="noopener">repoville</a>. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.`);
  const labelLayer = el('div', { class: 'labels', 'aria-hidden': 'true' });
  ui.prepend(labelLayer);
  ui.append(brand, stats, metricLegend, card, tip, viewMenu, matches, dock, drawer, foot);

  // ---------- History time-lapse ----------
  const tl = m.timeline;
  const tlHeights = tl ? Uint8Array.from(atob(tl.heights), (c) => c.charCodeAt(0)) : null;
  const tlFrames = tl ? tl.times.length : 0;
  const historyMesh = new InstancedMesh(boxGeo, new MeshLambertMaterial(), m.buildings.length);
  historyMesh.visible = false;
  historyMesh.frustumCulled = false;
  scene.add(historyMesh);
  if (tl) m.buildings.forEach((_, i) => historyMesh.setColorAt(i, tmpC.setHex(tl.colors[i] ?? 0x888888)));
  const tlBar = el('div', { class: 'timeline' });
  tlBar.hidden = true;
  tlBar.innerHTML = `<button class="icon" id="rv-tl-play" aria-label="Play">${ICON.tour}</button><input type="range" id="rv-tl" min="0" max="${Math.max(0, tlFrames - 1)}" step="0.01" value="0" aria-label="Time"><span id="rv-tl-date"></span>`;
  ui.append(tlBar);
  const tlRange = tlBar.querySelector<HTMLInputElement>('#rv-tl')!;
  const tlDate = tlBar.querySelector<HTMLSpanElement>('#rv-tl-date')!;
  let tlPos = 0;
  let tlPlaying = false;
  function drawHistory(pos: number) {
    if (!tlHeights) return;
    const f0 = Math.floor(pos);
    const f1 = Math.min(tlFrames - 1, f0 + 1);
    const k = pos - f0;
    const n = m.buildings.length;
    for (let i = 0; i < n; i++) {
      const b = m.buildings[i]!;
      const h0 = tlHeights[f0 * n + i]!;
      const h1 = tlHeights[f1 * n + i]!;
      const hgt = h0 + (h1 - h0) * k;
      // Not built yet: collapse the instance entirely.
      if (hgt <= 0) tmpM.makeScale(0, 0, 0);
      else tmpM.makeScale(b[3] - b[1], hgt, b[4] - b[2]);
      tmpM.setPosition(b[1] + ox, 0.05, b[2] + oz);
      historyMesh.setMatrixAt(i, tmpM);
    }
    historyMesh.instanceMatrix.needsUpdate = true;
    if (historyMesh.instanceColor) historyMesh.instanceColor.needsUpdate = true;
    tlDate.textContent = day(tl!.times[Math.min(tlFrames - 1, Math.round(pos))]!);
    tlRange.value = String(pos);
  }
  tlRange.addEventListener('input', () => {
    tlPos = Number(tlRange.value);
    tlPlaying = false;
    drawHistory(tlPos);
  });
  tlBar.querySelector('#rv-tl-play')!.addEventListener('click', () => {
    if (tlPos >= tlFrames - 1) tlPos = 0;
    tlPlaying = !tlPlaying;
  });

  /** Keep the URL in sync with the view so shared links reopen it as seen. */
  function syncUrl() {
    const q = new URLSearchParams(location.search);
    const set = (k: string, v: string | null) => (v === null ? q.delete(k) : q.set(k, v));
    set('view', metric === 'none' ? null : metric);
    set('time', night.value ? 'night' : null);
    set('mc', mcMode.value ? '1' : null);
    set('textures', detail.value ? null : '0');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }

  function setMetric(next: Metric) {
    metric = next;
    queueMicrotask(syncUrl);
    for (const b of viewMenu.querySelectorAll<HTMLButtonElement>('[data-metric]')) b.setAttribute('aria-pressed', String(b.dataset.metric === next));
    metricLegend.innerHTML = `${METRIC_TEXT[next]}<span class="ramp" aria-hidden="true"></span>`;
    metricLegend.hidden = next === 'none';
    historyMesh.visible = next === 'history';
    tlBar.hidden = next !== 'history';
    if (next === 'none') {
      metricMesh.visible = false;
      cityMeshes.forEach((c) => (c.visible = true));
      return;
    }
    if (next === 'diff' && m.diff) {
      const changed = new Map(m.diff.files.map((f) => [f[0], f]));
      const maxLines = Math.max(1, ...m.diff.files.map((f) => f[2] + f[3]));
      m.buildings.forEach((b, i) => {
        const f = changed.get(i);
        tmpM.makeScale(b[3] - b[1], f ? b[5] + 1 : Math.max(1, b[5] * 0.25), b[4] - b[2]);
        tmpM.setPosition(b[1] + ox, 0.05, b[2] + oz);
        metricMesh.setMatrixAt(i, tmpM);
        const c = !f ? tmpC.set(0x3a4252) : f[1] === 'A' ? tmpC.set(0x3fd0c9) : tmpC.set(0x8a5a2b).lerp(new Color(0xff7a1a), Math.sqrt((f[2] + f[3]) / maxLines));
        metricMesh.setColorAt(i, c);
      });
      metricLegend.querySelector('.ramp')?.remove();
      metricMesh.instanceMatrix.needsUpdate = true;
      if (metricMesh.instanceColor) metricMesh.instanceColor.needsUpdate = true;
      metricMesh.visible = true;
      cityMeshes.forEach((c) => (c.visible = false));
      return;
    }
    if (next === 'history') {
      metricMesh.visible = false;
      cityMeshes.forEach((c) => (c.visible = false));
      metricLegend.querySelector('.ramp')?.remove();
      tlPos = 0;
      tlPlaying = !reduceMotion;
      drawHistory(0);
      return;
    }
    RAMP = RAMPS[next as 'churn' | 'age' | 'todos'];
    metricLegend.querySelector<HTMLElement>('.ramp')!.style.background = `linear-gradient(90deg,${RAMP.map((c) => '#' + c.getHexString()).join(',')})`;
    const values = m.buildings.map((b) => (next === 'churn' ? b[7] : next === 'todos' ? (b[6] ? b[8] / b[6] : 0) : b[9] < 0 ? 3 * 365 : (m.headTime - b[9]) / DAY));
    const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
    const cap = sorted[Math.floor(sorted.length * 0.98)] || 1;
    const unit = next === 'churn' ? 'commits' : next === 'age' ? 'days' : 'markers / line';
    const f = (v: number) => (next === 'todos' ? v.toFixed(3) : fmt(Math.round(v)));
    metricLegend.insertAdjacentHTML('beforeend', `<span class="ticks"><span>0</span><span>${f(cap / 2)}</span><span>${f(cap)}+ ${unit}</span></span>`);
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
  // Keyboard-reachable list of the same districts the floating labels show.
  drawer.querySelector('#rv-districts')!.innerHTML = labelDistricts
    .map((d) => `<li><button class="path" data-path="${esc(d[0])}">${esc(d[0])}/</button></li>`)
    .join('');
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
    const ch = m.diff?.files.find((f) => m.buildings[f[0]] === b);
    if (ch) tags.push(`<span class="tag dia">${ch[1] === 'A' ? 'new' : 'changed'} · +${fmt(ch[2])} −${fmt(ch[3])}</span>`);
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

  /** Link to the file (or merged folder) at the rendered commit on GitHub/GitLab. */
  function sourceLink(b: BuildingRow): string {
    const src = m.source;
    if (!src || !m.head) return '';
    const kind = b[14] ? 'tree' : 'blob';
    const path = b[0].split('/').map(encodeURIComponent).join('/');
    const href = src.host === 'gitlab' ? `${src.base}/-/${kind}/${m.head}/${path}` : `${src.base}/${kind}/${m.head}/${path}`;
    return ` <a class="small" href="${esc(href)}" target="_blank" rel="noopener">Open source ↗</a>`;
  }

  let focusBeforeCard: HTMLElement | null = null;
  function closeCard() {
    const wasOpen = !card.hidden;
    card.hidden = true;
    selOutline.visible = false;
    if (wasOpen && focusBeforeCard) {
      // The origin may be a search hit that has been hidden since; fall back to the search box.
      const target = document.contains(focusBeforeCard) && focusBeforeCard.offsetParent ? focusBeforeCard : search;
      target.focus();
    }
    focusBeforeCard = null;
  }
  function select(i: number) {
    const b = m.buildings[i]!;
    boxFor(b, selBox);
    selOutline.visible = true;
    const d = districtOf(b[0]);
    card.innerHTML = `<div class="card-h"><button class="path district" data-path="${esc(d)}">${esc(d || m.name)}/</button><button class="icon" id="rv-card-close" aria-label="Close details">${ICON.close}</button></div>${facts(b)}
      <div class="card-a"><button class="small" id="rv-link">Copy link</button>${sourceLink(b)}</div>`;
    card.hidden = false;
    // Keyboard users land in the card; focus returns where it came from on close.
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && active !== canvas && !card.contains(active)) {
      focusBeforeCard = active;
      (card.querySelector('#rv-card-close') as HTMLElement).focus({ preventScroll: true });
    }
    card.querySelector('#rv-card-close')!.addEventListener('click', closeCard);
    card.querySelector('#rv-link')!.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(location.href);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Copy failed';
      }
      setTimeout(() => (btn.textContent = 'Copy link'), 1400);
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
    if (t.dataset.inner) {
      // A file inside a merged tower: say so on the card.
      const note = el('div', { class: 'inner-note' });
      note.textContent = `Contains ${t.dataset.inner.split('/').pop()} · ${fmt(Number(t.dataset.loc))} lines (${t.dataset.inner})`;
      card.querySelector('.path-full')?.after(note);
    }
    if (window.innerWidth < 720) setDrawer(false);
    matches.hidden = true;
  });

  // ---------- Search ----------
  const search = dock.querySelector<HTMLInputElement>('#rv-search')!;
  const allDistricts = m.districts.map((d) => d[0]).filter(Boolean);
  // Files inside merged towers, decoded lazily on the first search.
  let hidden: Array<{ path: string; loc: number; tower: number }> | null = null;
  const hiddenFiles = () => {
    if (hidden) return hidden;
    hidden = [];
    for (const [tower, text] of m.merged ?? []) {
      const base = m.buildings[tower]![0];
      for (const line of text.split('\n')) {
        const tab = line.lastIndexOf('\t');
        hidden.push({ path: `${base}/${line.slice(0, tab)}`, loc: Number(line.slice(tab + 1)), tower });
      }
    }
    return hidden;
  };
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) {
      matches.hidden = true;
      return;
    }
    const ds = allDistricts.filter((d) => d.toLowerCase().includes(q)).slice(0, 4);
    const fs = m.buildings.filter((b) => b[0].toLowerCase().includes(q)).slice(0, 10);
    const hs = fs.length < 10 ? hiddenFiles().filter((h) => h.path.toLowerCase().includes(q)).slice(0, 10 - fs.length) : [];
    matches.innerHTML = [
      ...ds.map((d) => `<li role="option"><button class="path" data-path="${esc(d)}"><i>folder</i>${esc(d)}/</button></li>`),
      ...fs.map((b) => `<li role="option"><button class="path" data-path="${esc(b[0])}"><i>${compact(b[6])} ln</i>${esc(b[0])}</button></li>`),
      ...hs.map((h) => `<li role="option"><button class="path" data-path="${esc(m.buildings[h.tower]![0])}" data-inner="${esc(h.path)}" data-loc="${h.loc}"><i>in tower</i>${esc(h.path)}</button></li>`),
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
  const texBox = viewMenu.querySelector<HTMLInputElement>('#rv-textures')!;
  texBox.checked = detail.value === 1;
  texBox.addEventListener('change', () => {
    detail.value = texBox.checked ? 1 : 0;
    syncUrl();
  });
  const mcBox = viewMenu.querySelector<HTMLInputElement>('#rv-mc')!;
  const mcNote = el('div', { class: 'mc-note' }, 'Minecraft textures © Mojang, loaded by your browser from <a href="https://github.com/misode/mcmeta" target="_blank" rel="noopener">misode/mcmeta</a>. Not bundled with Repoville.');
  mcNote.hidden = true;
  ui.append(mcNote);
  mcBox.addEventListener('change', () => {
    void enableMcTextures(mcBox.checked).catch(() => {
      mcBox.checked = false;
      mcNote.textContent = 'Could not load Minecraft textures (offline?).';
      mcNote.hidden = false;
    });
    mcNote.hidden = !mcBox.checked;
  });
  if (params.get('mc') === '1' || (m.textured && params.get('mc') !== '0')) {
    mcBox.checked = true;
    mcNote.hidden = false;
    void enableMcTextures(true);
  }
  const nightBox = viewMenu.querySelector<HTMLInputElement>('#rv-night')!;
  const dayLight = { hemi: hemi.intensity, sun: sun.intensity, sunColor: sun.color.getHex(), hemiSky: hemi.color.getHex() };
  function setNight(on: boolean) {
    night.value = on ? 1 : 0;
    nightBox.checked = on;
    hemi.intensity = on ? 0.5 : dayLight.hemi;
    hemi.color.setHex(on ? 0x5d6f9e : dayLight.hemiSky);
    sun.intensity = on ? 0.75 : dayLight.sun;
    sun.color.setHex(on ? 0x9fb4ff : dayLight.sunColor);
    renderer.toneMappingExposure = on ? 1.6 : 1.25;
    document.body.classList.toggle('night', on);
    sun.shadow.needsUpdate = true;
  }
  nightBox.addEventListener('change', () => {
    setNight(nightBox.checked);
    syncUrl();
  });
  if (night.value) setNight(true);
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
  // Fly mode needs a keyboard and pointer lock; hide it on touch-only devices.
  if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches) flyBtn.hidden = true;
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
    else if (k === 'p') void saveScreenshot();
    else if (e.key === 'Escape') {
      setDrawer(false);
      setMenu(false);
      closeCard();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  // ---------- Screenshot ----------
  async function saveScreenshot() {
    renderer.render(scene, camera);
    const w = canvas.width;
    const h = canvas.height;
    const strip = Math.round(h * 0.075);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h + strip;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(0, 0, w, h + strip);
    ctx.drawImage(canvas, 0, 0);
    const pad = Math.round(strip * 0.32);
    const fs = Math.round(strip * 0.34);
    ctx.fillStyle = '#F6F1E4';
    ctx.font = `600 ${fs}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(m.name, pad, h + strip / 2);
    const nameW = ctx.measureText(m.name).width;
    ctx.fillStyle = 'rgba(246,241,228,.66)';
    ctx.font = `400 ${Math.round(fs * 0.8)}px Inter, sans-serif`;
    ctx.fillText(`${compact(m.stats.files)} files · ${compact(m.stats.loc)} lines · ${compact(m.stats.buildings)} buildings`, pad * 2 + nameW, h + strip / 2);
    ctx.fillStyle = '#E8D9A8';
    ctx.font = `400 ${fs}px Silkscreen, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText('repoville', w - pad, h + strip / 2);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${m.name.replace(/[^\w.-]+/g, '-')}-repoville.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  dock.querySelector('#rv-shot')!.addEventListener('click', () => void saveScreenshot());

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
    if (metric === 'history' && tlPlaying) {
      tlPos = Math.min(tlFrames - 1, tlPos + dt * 6);
      drawHistory(tlPos);
      if (tlPos >= tlFrames - 1) tlPlaying = false;
    }
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

  // Automation hooks (used for screenshots and recordings).
  window.__repoville!.focus = (path: string) => focusPath(path);
  window.__repoville!.fit = fitCity;

  // Deep links: #f=<path>, #tour, ?view=churn|age|todos, ?ui=off
  const hash = decodeURIComponent(location.hash.slice(1));
  const whenReady = (fn: () => void) => (state.ready ? fn() : setTimeout(() => whenReady(fn), 100));
  if (hash.startsWith('f=')) whenReady(() => focusPath(hash.slice(2)));
  else if (hash === 'tour') whenReady(tour);
  const view = params.get('view');
  if (view === 'churn' || view === 'age' || view === 'todos' || (view === 'history' && tl) || (view === 'diff' && m.diff)) whenReady(() => setMetric(view));
  if (params.get('ui') === 'off') document.body.classList.add('no-ui');
}

try {
  main();
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal">Could not open this city: ${esc(String(err))}</div>`);
  throw err;
}
