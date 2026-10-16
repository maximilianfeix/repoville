/**
 * Palette-aware 16×16 pixel textures (original artwork, no game assets).
 * Each family painter returns a ramp code per pixel: step 0..4 on ramp `slot`
 * encoded as step + 5·slot (slot 0 = the block's palette colour, slots 1..3 =
 * family accents such as mortar, inner wood, book covers or dirt).
 * Ramps are built in OKLab/OKLCh: darker steps rotate toward blue-violet and
 * gain chroma, lighter steps rotate toward warm yellow and lose chroma.
 */
export const TILE = 16;
export type RGB8 = [number, number, number];

// ---------- colour math (sRGB <-> linear <-> OKLab, Ottosson 2020) ----------
export const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexLin = (h: number): [number, number, number] => [toLin(((h >> 16) & 255) / 255), toLin(((h >> 8) & 255) / 255), toLin((h & 255) / 255)];

export function linToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLin(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
/** OKLCh -> linear sRGB, reducing chroma until the colour fits the gamut. */
export function lchToLin(L: number, C: number, h: number): [number, number, number] {
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToLin(L, C * Math.cos(h), C * Math.sin(h));
    if (rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) return rgb.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
    C *= 0.85;
  }
  return oklabToLin(L, 0, 0).map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

// ---------- hue-shifted ramp ----------
const DEG = Math.PI / 180;
const COOL = 285 * DEG; // OKLCh hue of blue-violet
const WARM = 85 * DEG;  // OKLCh hue of warm yellow
/** Lightness offsets for steps 0..4 (step 2 = the palette colour itself). */
// Kept shallow: at city scale a wide ramp turns every facade into noise.
const L_STEP = [-0.11, -0.05, 0, 0.04, 0.075];

function rotateToward(h: number, target: number, maxRad: number): number {
  let d = target - h;
  d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest signed angle
  return h + Math.sign(d) * Math.min(Math.abs(d), maxRad);
}

/**
 * 5-step ramp around `hex` (index 2 = hex), as LINEAR RGB triples.
 * Darker: toward blue/violet, +chroma. Lighter: toward yellow, −chroma.
 * Neutral greys get a faint cool/warm tint so stone still feels lit.
 */
export function makeRamp(hex: number, hueStepDeg = 5): Array<[number, number, number]> {
  const [L, a, b] = linToOklab(...hexLin(hex));
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const darkRoom = Math.min(1, L / 0.42);          // compress toward black
  const lightRoom = Math.min(1, (1 - L) / 0.3);    // compress toward white
  return L_STEP.map((dl, i) => {
    const k = i - 2;
    if (k === 0) return hexLin(hex);
    const dark = k < 0;
    const n = Math.abs(k);
    const L2 = Math.min(0.985, Math.max(0.02, L + dl * (dark ? darkRoom : lightRoom)));
    // Greys (C≈0) have no meaningful hue: adopt the target hue with a small chroma.
    const grey = C < 0.012;
    const target = dark ? COOL : WARM;
    const h2 = grey ? target : rotateToward(h, target, hueStepDeg * DEG * n);
    const tint = (dark ? 0.009 : 0.006) * n;
    const C2 = grey ? C + tint * 0.5 : dark ? C * (1 + 0.06 * n) : C * (1 - 0.1 * n);
    return lchToLin(L2, C2, h2);
  });
}

// ---------- painters ----------
/** Periodic integer hash on the 16×16 torus, uniform in [0,1). */
function hash(x: number, y: number, s: number): number {
  let h = ((x & 15) * 374761393 + (y & 15) * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const wrap = (v: number) => ((v % 16) + 16) % 16;
const clampStep = (v: number) => (v < 0 ? 0 : v > 4 ? 4 : v);
/** Toroidal delta (shortest signed distance on a 16-wide ring). */
const tor = (d: number) => (d > 8 ? d - 16 : d < -8 ? d + 16 : d);

/** Jittered feature points on a periodic 4×4 grid of 4-px cells (Worley, seamless). */
function worley(x: number, y: number, seed: number): { f1: number; f2: number; id: number; dx: number; dy: number } {
  let f1 = 1e9, f2 = 1e9, id = 0, dx = 0, dy = 0;
  const cx = x >> 2, cy = y >> 2;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = (cx + i) & 3, gy = (cy + j) & 3;
    const px = gx * 4 + 0.5 + hash(gx, gy, seed) * 3;
    const py = gy * 4 + 0.5 + hash(gx, gy, seed + 1) * 3;
    const ddx = tor(x + 0.5 - px), ddy = tor(y + 0.5 - py);
    const d = Math.hypot(ddx, ddy * 1.15);
    if (d < f1) { f2 = f1; f1 = d; id = gy * 4 + gx; dx = ddx; dy = ddy; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id, dx, dy };
}

export type Painter = (x: number, y: number) => number;
const A1 = 5, A2 = 10, A3 = 15; // slot offsets

export const PAINTERS = {
  flat: (x, y) => (hash(x >> 1, y >> 1, 1) < 0.12 ? 1 : hash(x, y, 2) > 0.93 ? 3 : 2),

  planks: (x, y) => {
    const b = y >> 2, r = y & 3;
    if (r === 3) return 0;                              // seam between boards
    const joint = (b * 7 + 3) & 15;                     // butt joint, staggered per board
    if (x === joint) return 1;
    if (x === ((joint + 1) & 15)) return r === 0 ? 4 : 3;
    if (r === 0) return hash(x, b, 3) < 0.15 ? 2 : 3;   // lit top edge, broken up
    // Linear grain: 3–5 px runs, offset per row so ends never stack (no banding).
    const seg = wrap(x + ((hash(b, r, 4) * 16) | 0)) >> 2;
    const g = hash(seg, b * 4 + r, 5);
    const tone = hash(b, 0, 6) < 0.25 ? -1 : 0;          // one darker board
    return clampStep((g < 0.3 ? 1 : g > 0.88 ? 3 : 2) + tone);
  },

  bricks: (x, y) => {
    const row = y >> 2, r = y & 3;
    const off = row & 1 ? 4 : 0;
    const bx = wrap(x + off) & 7;
    if (r === 3 || bx === 7) return A1 + (r === 3 && bx === 7 ? 1 : 2);   // mortar
    const brick = hash(wrap(x + off) >> 3, row, 7);
    const tone = brick < 0.25 ? -1 : brick > 0.82 ? 1 : 0;
    let s = 2;
    if (r === 0 || bx === 0) s = 3;                      // light from top-left
    else if (r === 2 && bx >= 5) s = 1;                  // shadow lower-right only
    if (s === 2 && hash(x, y, 8) > 0.9) s = 1;           // a few pits
    return clampStep(s + tone);
  },

  stoneBricks: (x, y) => {
    const row = y >> 3, ry = y & 7;
    const off = row & 1 ? 8 : 0;
    const bx = wrap(x + off);
    if (ry === 7 || bx === 15) return 0;                 // 1-px dark gap
    if (ry === 0 || bx === 0) return ry === 0 && bx === 0 ? 4 : 3;
    if (ry === 6 || bx === 14) return 1;
    // Raw-stone dithering in staggered 2×1 clusters.
    const h = hash((x + (y & 1)) >> 1, y, 9 + row);
    return h < 0.16 ? 1 : h > 0.86 ? 3 : 2;
  },

  cobble: (x, y) => {
    const w = worley(x, y, 11);
    if (w.f2 - w.f1 < 0.85) return w.f2 - w.f1 < 0.35 ? 0 : 1;   // gaps between stones
    const tone = hash(w.id, 0, 12) < 0.3 ? -1 : hash(w.id, 1, 12) > 0.75 ? 1 : 0;
    const lit = -(w.dx + w.dy);                          // >0 toward the top-left
    const s = lit > 1.3 ? 3 : lit < -1.3 ? 1 : 2;
    return clampStep(s + tone);
  },

  logSide: (x, y) => {
    const c = hash(x, 0, 13);
    const seg = wrap(y + ((c * 16) | 0)) >> 2;
    const h = hash(x, seg, 14);
    if (c < 0.22) return h < 0.55 ? 0 : 1;               // crevice
    if (c > 0.8) return h > 0.35 ? 3 : 2;                // ridge catching light
    return h < 0.22 ? 1 : h > 0.9 ? 3 : 2;
  },

  logTop: (x, y) => {
    const ax = Math.abs(x - 7.5), ay = Math.abs(y - 7.5);
    const d = Math.max(ax, ay) * 0.55 + Math.hypot(ax, ay) * 0.45;
    if (Math.max(ax, ay) > 6.6) return hash(x, y, 15) < 0.3 ? 1 : 2;  // bark rim
    if (d < 1.2) return A1 + 1;                                        // pith
    const ring = Math.floor(d * 0.95);
    return A1 + (ring % 2 ? 1 : x + y < 15 ? 3 : 2);
  },

  glass: (x, y) => {
    if (x === 0 || y === 0) return 4;
    if (x === 15 || y === 15) return 1;
    if (x === 1 || y === 1) return 3;
    const d = x + y;
    if ((d === 9 && x >= 3 && x <= 6) || (d === 10 && x >= 4 && x <= 6)) return 4;
    if (d === 12 && x >= 5 && x <= 7) return 3;
    if (d === 22 && x >= 10 && x <= 12) return 3;
    return 2;
  },

  leaves: (x, y) => {
    const w = worley(x, y, 16);
    if (w.f1 < 1.75) {                                   // front leaf cluster
      const lit = -(w.dx + w.dy);
      return lit > 0.9 ? 4 : lit > -0.6 ? 3 : 2;
    }
    const back = hash(x >> 1, (y + (x & 1)) >> 1, 17);
    return back < 0.22 ? 0 : 1;                          // shadowed foliage, a few holes
  },

  grass: (x, y) => {
    const n = hash((x + ((y >> 1) & 1)) >> 1, y >> 1, 18);
    const f = hash(x, y, 19);
    if (n < 0.18) return f < 0.5 ? 1 : 2;
    if (n > 0.84) return f > 0.6 ? 4 : 3;
    return f < 0.07 ? 1 : f > 0.95 ? 3 : 2;
  },

  grassSide: (x, y) => {
    const drip = 2 + (hash(x, 0, 20) > 0.5 ? 1 : 0) + (hash(x, 1, 20) > 0.85 ? 1 : 0);
    if (y === 0) return 3;
    if (y < drip) return y === drip - 1 ? 1 : 2;
    const h = hash((x + (y & 1)) >> 1, y, 21);
    return A1 + (h < 0.2 ? 1 : h > 0.85 ? 3 : 2);
  },

  grain: (x, y) => {
    const h = hash(x, y, 22), c = hash(x >> 1, y >> 1, 23);
    return c < 0.15 ? 1 : h < 0.2 ? 1 : h > 0.84 ? 3 : 2;
  },

  bookshelf: (x, y) => {
    const ry = y & 7, shelf = y >> 3;
    if (ry === 0) return 3;                              // shelf board top
    if (ry === 7) return x === 0 || x === 15 ? 1 : 2;    // shelf board front
    if (x === 0 || x === 15) return x === 0 ? 3 : 1;     // side frame
    // Books: widths 1–3 px, laid out deterministically per shelf.
    let bx = 1, book = 0;
    while (bx <= x) { const wdt = 1 + Math.floor(hash(book, shelf, 24) * 2.99); if (x < bx + wdt) break; bx += wdt; book++; }
    const kind = hash(book, shelf, 25);
    if (kind < 0.12) return 0;                           // empty slot
    const top = 1 + (hash(book, shelf, 26) < 0.35 ? 1 : 0);
    if (ry < top) return 0;
    const slot = kind < 0.4 ? A1 : kind < 0.68 ? A2 : A3;
    const s = x === bx ? 3 : ry === 4 ? 3 : ry === 6 ? 1 : 2;
    return slot + s;
  },

  terracotta: (x, y) => {
    const c = hash(x >> 2, y >> 2, 27), f = hash(x, y, 28);
    return f > 0.95 ? 1 : f < 0.04 ? 3 : c < 0.3 && f < 0.5 ? 1 : 2;
  },

  tiles: (x, y) => {
    const tx = x & 7, ty = y & 7;
    if (tx === 7 || ty === 7) return 1;                  // thin grout
    if (tx === 0 || ty === 0) return 3;                  // bevel
    if (tx + ty <= 3) return 3;                          // polished sheen top-left
    if (tx === 6 || ty === 6) return hash(x, y, 29) < 0.5 ? 1 : 2;
    return 2;
  },

  water: (x, y) => {
    const v = Math.sin(((x + y * 0.5) * Math.PI) / 4) + Math.sin(((y - x * 0.25) * Math.PI) / 8);
    return v > 1.2 ? 3 : v < -1.2 ? 1 : 2;               // periods 8 and 16 tile seamlessly
  },

  roof: (x, y) => {
    const row = y >> 2, r = y & 3;
    const off = row & 1 ? 4 : 0;
    const bx = wrap(x + off) & 7;
    const tone = hash(wrap(x + off) >> 3, row, 30) < 0.3 ? -1 : 0;
    if (r === 0) return clampStep(1 + tone);             // shadow under the row above
    if (bx === 0) return 0;                              // gap between shingles
    if (r === 3) return clampStep(3 + tone);             // exposed lip catches light
    return clampStep((bx === 1 ? 3 : 2) + tone);
  },
} satisfies Record<string, Painter>;
export type Family = keyof typeof PAINTERS;

/** Accent colours per family, derived from the block colour (slot 1..3). */
const mix = (a: number, b: number, t: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const ACCENTS: Partial<Record<Family, (base: number) => number[]>> = {
  bricks: (b) => [mix(b, 0xaaa59c, 0.6)],                // mortar
  logTop: (b) => [mix(b, 0xc49a5e, 0.55)],               // inner wood
  grassSide: () => [0x7a6c5c],                           // dirt
  bookshelf: (b) => [mix(b, 0x8a5a50, 0.4), mix(b, 0x5a6478, 0.4), mix(b, 0x66705a, 0.35)],
};
/** How strongly the tile's mean is pulled back to the palette colour (distance colour accuracy). */
const NORMALIZE: Partial<Record<Family, number>> = { grassSide: 0, logTop: 0, glass: 0.5 };

/**
 * Render one 16×16 RGBA8 sRGB tile. The linear-space mean is corrected toward
 * the palette colour so mipmapped (distant) blocks keep their palette colour.
 */
export function paintTile(family: Family, hex: number, out: Uint8Array, offset: number): void {
  const ramps = [makeRamp(hex), ...(ACCENTS[family]?.(hex) ?? []).map((c) => makeRamp(c))];
  const paint = PAINTERS[family];
  const lin = new Float32Array(TILE * TILE * 3);
  const mean = [0, 0, 0];
  for (let i = 0; i < TILE * TILE; i++) {
    const code = paint(i & 15, i >> 4);
    const ramp = ramps[Math.min(ramps.length - 1, Math.floor(code / 5))]!;
    const c = ramp[code % 5]!;
    for (let k = 0; k < 3; k++) { lin[i * 3 + k] = c[k]!; mean[k]! += c[k]! / (TILE * TILE); }
  }
  const target = hexLin(hex);
  const strength = NORMALIZE[family] ?? 1;
  const gain = mean.map((m, k) => 1 + strength * ((m > 1e-5 ? target[k]! / m : 1) - 1));
  for (let i = 0; i < TILE * TILE; i++) {
    for (let k = 0; k < 3; k++) out[offset + i * 4 + k] = Math.round(255 * toSrgb(Math.min(1, lin[i * 3 + k]! * gain[k]!)));
    out[offset + i * 4 + 3] = 255;
  }
}

/** Face-aware family choice (extends the existing familyOf rules). */
export function faceFamily(state: string, top: boolean, familyOf: (s: string) => string): Family {
  if (top && /_log|_stem|pillar/.test(state)) return 'logTop';
  if (/grass_block/.test(state)) return top ? 'grass' : 'grassSide';
  const f = familyOf(state);
  return (f in PAINTERS ? f : 'flat') as Family;
}

/**
 * One RGBA layer per distinct (family, colour), plus a LUT mapping
 * palette id·2 + face (0 top, 1 side) -> layer.
 */
export function buildPixelLayers(states: string[], colors: number[], familyOf: (s: string) => string): { data: Uint8Array; layers: number; lut: Float32Array } {
  const keys = new Map<string, number>();
  const jobs: Array<[Family, number]> = [];
  const lut = new Float32Array(states.length * 2);
  states.forEach((st, id) => {
    for (const face of [0, 1]) {
      const fam = faceFamily(st, face === 0, familyOf);
      const hex = colors[id] ?? 0x808080;
      const key = `${fam}:${hex}`;
      let layer = keys.get(key);
      if (layer === undefined) { layer = jobs.length; keys.set(key, layer); jobs.push([fam, hex]); }
      lut[id * 2 + face] = layer;
    }
  });
  const data = new Uint8Array(TILE * TILE * 4 * jobs.length);
  jobs.forEach(([fam, hex], i) => paintTile(fam, hex, data, i * TILE * TILE * 4));
  return { data, layers: jobs.length, lut };
}
