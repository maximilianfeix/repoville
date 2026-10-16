/** Binary payload shared by the HTML writer (Node) and the viewer (browser). */
export const MAGIC = 0x31435652; // "RVC1" little-endian

export type BuildingRow = [
  path: string, x0: number, z0: number, x1: number, z1: number, height: number,
  loc: number, churn: number, todos: number, lastTouched: number, fire: number, mossy: number, lang: string, style: string, merged: number, landmark: number,
];
export type DistrictRow = [path: string, depth: number, x0: number, z0: number, x1: number, z1: number];

export interface ViewerMeta {
  name: string;
  head: string | null;
  headTime: number;
  since: string;
  generator: string;
  site: string;
  badge: string;
  width: number;
  length: number;
  height: number;
  stats: { files: number; loc: number; commits: number; buildings: number; todos: number; languages: Array<{ lang: string; loc: number }> };
  highlights: {
    hottestDistricts: Array<{ path: string; commits: number; burning: number }>;
    mostRuined: Array<{ path: string; todos: number; loc: number; share: number }>;
    oldestCorner: { path: string; lastTouched: number | null; ageDays: number | null } | null;
  };
  /** RGB per palette id. */
  colors: number[];
  /** Per palette id: 0 air, 1 solid, 2 glowing, 3 glass, 4 foliage/thin. */
  kinds: number[];
  states: string[];
  buildings: BuildingRow[];
  districts: DistrictRow[];
  textured: boolean;
  /** Optional history time-lapse: frame times and base64 of frames × buildings heights (uint8). */
  timeline?: { times: number[]; heights: string; colors: number[] } | null;
  /** Files hidden inside LOD towers: [building index, "relative/path\tloc\n…"]. */
  merged?: Array<[number, string]>;
  /** Web view of the repo (GitHub/GitLab) for source links, or null. */
  source?: { base: string; host: 'github' | 'gitlab' } | null;
}

export interface Payload {
  meta: ViewerMeta;
  /** Per column (index z * width + x): offset into `runs` (in u16 units). */
  columnOffsets: Uint32Array;
  /** For each column: count, then count × (id, length) pairs, y from 0 upward. */
  runs: Uint16Array;
}

/** Encodes meta + column runs into one uncompressed buffer. */
export function encodePayload(meta: ViewerMeta, runs: Uint16Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const pad = (4 - ((8 + json.length) % 4)) % 4;
  const out = new Uint8Array(8 + json.length + pad + runs.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, json.length, true);
  out.set(json, 8);
  out.set(new Uint8Array(runs.buffer, runs.byteOffset, runs.byteLength), 8 + json.length + pad);
  return out;
}

export function decodePayload(buf: Uint8Array): Payload {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a repoville city payload');
  const len = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + len))) as ViewerMeta;
  const pad = (4 - ((8 + len) % 4)) % 4;
  const start = 8 + len + pad;
  const bytes = buf.slice(start); // copy to get an aligned buffer
  const runs = new Uint16Array(bytes.buffer, 0, bytes.byteLength / 2);
  const columnOffsets = new Uint32Array(meta.width * meta.length);
  let p = 0;
  for (let i = 0; i < columnOffsets.length; i++) {
    columnOffsets[i] = p;
    p += 1 + runs[p]! * 2;
  }
  return { meta, columnOffsets, runs };
}

/**
 * Fills a dense chunk (with a 1-block border on x/z) from column runs and
 * returns the chunk's top (highest non-air y + 1) so callers can mesh only that far.
 */
export function fillChunk(p: Payload, x0: number, z0: number, sx: number, sz: number, out: Uint16Array): number {
  const { width, length, height } = p.meta;
  const bx = sx + 2;
  const bz = sz + 2;
  out.fill(0);
  let top = 0;
  for (let lz = 0; lz < bz; lz++) {
    const z = z0 + lz - 1;
    if (z < 0 || z >= length) continue;
    for (let lx = 0; lx < bx; lx++) {
      const x = x0 + lx - 1;
      if (x < 0 || x >= width) continue;
      let o = p.columnOffsets[z * width + x]!;
      const n = p.runs[o++]!;
      let y = 0;
      for (let r = 0; r < n; r++) {
        const id = p.runs[o++]!;
        const run = p.runs[o++]!;
        if (id) {
          for (let k = 0; k < run && y + k < height; k++) out[((y + k) * bz + lz) * bx + lx] = id;
          if (lx > 0 && lz > 0 && lx <= sx && lz <= sz) top = Math.max(top, Math.min(height, y + run));
        }
        y += run;
      }
    }
  }
  return top;
}
