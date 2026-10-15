/**
 * Procedural 16×16 detail textures (original artwork, no game assets).
 * Each family is a luminance map centred on 1.0 (stored as value/128) that the
 * shader multiplies with the block colour, so one texture serves every
 * material of that family and colours stay those of the palette.
 */
export const TILE = 16;

export const FAMILIES = [
  'flat', 'planks', 'bricks', 'stoneBricks', 'cobble', 'logSide', 'logTop', 'glass', 'leaves',
  'grass', 'grain', 'bookshelf', 'terracotta', 'tiles', 'water', 'roof',
] as const;
export type Family = (typeof FAMILIES)[number];

const RULES: Array<[RegExp, Family]> = [
  [/water/, 'water'],
  [/glass|ice$|packed_ice|blue_ice/, 'glass'],
  [/leaves|wart_block|azalea|chorus/, 'leaves'],
  [/bookshelf/, 'bookshelf'],
  [/_stairs|_slab/, 'roof'],
  [/log|stem|pillar|scaffolding/, 'logSide'],
  [/planks|fence|door|lectern|sign/, 'planks'],
  [/(?<!stone_|deepslate_|mud_|tuff_|end_stone_|nether_|blackstone_)bricks$|^minecraft:bricks/, 'bricks'],
  [/stone_bricks|deepslate_bricks|mud_bricks|tuff_bricks|end_stone_bricks|nether_bricks|blackstone_bricks|cut_|chiseled/, 'stoneBricks'],
  [/tiles|polished|smooth_stone|purpur_block|prismarine|quartz/, 'tiles'],
  [/cobble|andesite|tuff$|stone$|deepslate$|blackstone$|mossy|moss_block|cracked/, 'cobble'],
  [/terracotta/, 'terracotta'],
  [/grass_block|nylium|podzol|snow/, 'grass'],
  [/sand|gravel|dirt|path|mud|end_stone$/, 'grain'],
];

export function familyOf(state: string): Family {
  const name = state.replace(/\[.*$/, '');
  for (const [re, fam] of RULES) if (re.test(name)) return fam;
  return 'flat';
}

/** Small deterministic hash noise. */
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Painter = (x: number, y: number) => number;

const PAINTERS: Record<Family, Painter> = {
  flat: (x, y) => 1 + (hash(x, y, 1) - 0.5) * 0.06,
  planks: (x, y) => {
    const board = Math.floor(y / 4);
    const seam = y % 4 === 3 ? 0.72 : 1;
    const end = (x + board * 7) % 16 === 0 ? 0.8 : 1;
    const grain = 1 + (hash(x >> 2, y, 2 + board) - 0.5) * 0.12;
    return seam * end * grain * (board % 2 ? 0.97 : 1.03);
  },
  bricks: (x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    return mortar ? 1.28 : 0.95 + (hash((x + off) >> 3, row, 3) - 0.5) * 0.16 + (hash(x, y, 4) - 0.5) * 0.06;
  },
  stoneBricks: (x, y) => {
    const row = Math.floor(y / 8);
    const off = row % 2 ? 8 : 0;
    const edge = y % 8 === 7 || (x + off) % 16 === 15;
    const bevel = y % 8 === 0 || (x + off) % 16 === 0;
    return edge ? 0.68 : bevel ? 1.1 : 1 + (hash(x, y, 5) - 0.5) * 0.1;
  },
  cobble: (x, y) => {
    const cx = Math.floor((x + Math.floor(hash(0, y >> 2, 6) * 4)) / 5);
    const cy = Math.floor(y / 4);
    const v = 0.88 + hash(cx, cy, 7) * 0.24;
    const crack = (x + Math.floor(hash(0, y >> 2, 6) * 4)) % 5 === 0 || y % 4 === 0;
    return crack ? 0.7 : v;
  },
  logSide: (x, y) => {
    const stripe = hash(x, 0, 8) > 0.6 ? 0.82 : 1;
    return stripe * (1 + (hash(x, y >> 1, 9) - 0.5) * 0.12);
  },
  logTop: (x, y) => {
    const r = Math.hypot(x - 7.5, y - 7.5);
    return Math.floor(r) % 3 === 0 ? 0.85 : 1.05;
  },
  glass: (x, y) => {
    const frame = x === 0 || y === 0 || x === 15 || y === 15;
    const glint = (x + y === 11 || x + y === 12) && x > 2 && y > 2 && x < 10;
    return frame ? 0.7 : glint ? 1.45 : 1.08;
  },
  leaves: (x, y) => {
    const n = hash(x, y, 10);
    return n < 0.14 ? 0.55 : n > 0.85 ? 1.22 : 0.95 + hash(x >> 1, y >> 1, 11) * 0.12;
  },
  grass: (x, y) => {
    const n = hash(x, y, 12);
    return n < 0.12 ? 0.82 : n > 0.9 ? 1.16 : 1 + (hash(x >> 1, y >> 1, 13) - 0.5) * 0.08;
  },
  grain: (x, y) => 0.9 + hash(x, y, 14) * 0.2,
  bookshelf: (x, y) => {
    const shelf = y % 8 === 0 || y % 8 === 7;
    if (shelf || x === 0 || x === 15) return 1.05;
    const book = Math.floor(x / 2);
    return 0.62 + hash(book, y >> 3, 15) * 0.7;
  },
  terracotta: (x, y) => 1 + (hash(x, y, 16) > 0.93 ? -0.12 : 0) + (hash(x >> 2, y >> 2, 17) - 0.5) * 0.05,
  tiles: (x, y) => (x % 8 === 0 || y % 8 === 0 ? 0.8 : x % 8 === 1 || y % 8 === 1 ? 1.08 : 1 + (hash(x, y, 18) - 0.5) * 0.04),
  water: (x, y) => 1 + Math.sin((x + y * 0.5) * 0.9) * 0.08 + (hash(x, y, 19) - 0.5) * 0.05,
  roof: (x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    const edge = y % 4 === 3 ? 0.72 : (x + off) % 8 === 0 ? 0.86 : 1;
    return edge * (1 + (hash((x + off) >> 3, row, 20) - 0.5) * 0.14);
  },
};

/** RGBA layers (TILE×TILE each) in FAMILIES order; detail stored in R=G=B as value·128. */
export function buildDetailLayers(): Uint8Array {
  const out = new Uint8Array(TILE * TILE * 4 * FAMILIES.length);
  FAMILIES.forEach((fam, layer) => {
    const paint = PAINTERS[fam];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const v = Math.max(0, Math.min(255, Math.round(paint(x, y) * 128)));
      const i = ((layer * TILE + y) * TILE + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  });
  return out;
}
