/**
 * Sparse voxel grid. XZ is split into 256x256 tiles and Y into 16-block
 * sections; each section is a lazily allocated Uint16Array of palette ids.
 * Id 0 is always air.
 */
const TILE = 256;
const SECTION = 16;
const SECTION_SIZE = TILE * TILE * SECTION;

export interface BlockEntity {
  x: number;
  y: number;
  z: number;
  /** Namespaced block entity id, e.g. minecraft:sign. */
  id: string;
  kind: 'sign';
  lines: string[];
}

export class VoxelGrid {
  readonly palette: string[] = ['minecraft:air'];
  readonly blockEntities: BlockEntity[] = [];
  private readonly ids = new Map<string, number>([['minecraft:air', 0]]);
  private readonly sections = new Map<number, Uint16Array>();
  private readonly tilesX: number;
  private readonly tilesZ: number;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly length: number,
  ) {
    if (width < 1 || height < 1 || length < 1 || width > 65535 || height > 65535 || length > 65535) {
      throw new RangeError(`grid size out of range: ${width}x${height}x${length}`);
    }
    this.tilesX = Math.ceil(width / TILE);
    this.tilesZ = Math.ceil(length / TILE);
  }

  id(state: string): number {
    let id = this.ids.get(state);
    if (id === undefined) {
      id = this.palette.length;
      if (id > 0xffff) throw new RangeError('palette overflow');
      this.palette.push(state);
      this.ids.set(state, id);
    }
    return id;
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.length;
  }

  private key(x: number, y: number, z: number): number {
    return (((y / SECTION) | 0) * this.tilesZ + ((z / TILE) | 0)) * this.tilesX + ((x / TILE) | 0);
  }

  private static offset(x: number, y: number, z: number): number {
    return (y % SECTION) * TILE * TILE + (z % TILE) * TILE + (x % TILE);
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inside(x, y, z)) return;
    const k = this.key(x, y, z);
    let s = this.sections.get(k);
    if (!s) {
      if (id === 0) return;
      s = new Uint16Array(SECTION_SIZE);
      this.sections.set(k, s);
    }
    s[VoxelGrid.offset(x, y, z)] = id;
  }

  setState(x: number, y: number, z: number, state: string): void {
    this.set(x, y, z, this.id(state));
  }

  get(x: number, y: number, z: number): number {
    if (!this.inside(x, y, z)) return 0;
    const s = this.sections.get(this.key(x, y, z));
    return s ? s[VoxelGrid.offset(x, y, z)]! : 0;
  }

  state(x: number, y: number, z: number): string {
    return this.palette[this.get(x, y, z)]!;
  }

  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) this.set(x, y, z, id);
  }

  /** Copies one X row (fixed y, z) into `out`, which must hold `width` entries. */
  row(y: number, z: number, out: Uint16Array): void {
    out.fill(0);
    const sy = (y / SECTION) | 0;
    const tz = (z / TILE) | 0;
    const base = (y % SECTION) * TILE * TILE + (z % TILE) * TILE;
    for (let tx = 0; tx < this.tilesX; tx++) {
      const s = this.sections.get((sy * this.tilesZ + tz) * this.tilesX + tx);
      if (!s) continue;
      const x0 = tx * TILE;
      const n = Math.min(TILE, this.width - x0);
      out.set(s.subarray(base, base + n), x0);
    }
  }

  /** True if no section in the y-range of this layer holds anything (fast skip). */
  sectionEmpty(y: number, z: number): boolean {
    const sy = (y / SECTION) | 0;
    const tz = (z / TILE) | 0;
    for (let tx = 0; tx < this.tilesX; tx++) if (this.sections.has((sy * this.tilesZ + tz) * this.tilesX + tx)) return false;
    return true;
  }

  /** Calls `fn` for every cell whose palette id passes `want` (walks stored sections only). */
  each(want: (id: number) => boolean, fn: (x: number, y: number, z: number, id: number) => void): void {
    const plane = this.tilesX * this.tilesZ;
    for (const [k, s] of this.sections) {
      const sy = Math.floor(k / plane);
      const tz = Math.floor((k % plane) / this.tilesX);
      const tx = k % this.tilesX;
      for (let i = 0; i < s.length; i++) {
        const id = s[i]!;
        if (!id || !want(id)) continue;
        const x = tx * TILE + (i % TILE);
        const z = tz * TILE + (Math.floor(i / TILE) % TILE);
        const y = sy * SECTION + Math.floor(i / (TILE * TILE));
        fn(x, y, z, id);
      }
    }
  }

  /** Highest non-air y + 1 (0 if empty). */
  topY(): number {
    let top = 0;
    for (const k of this.sections.keys()) {
      const sy = Math.floor(k / (this.tilesX * this.tilesZ));
      top = Math.max(top, (sy + 1) * SECTION);
    }
    return Math.min(top, this.height);
  }

  /** Counts blocks per palette id. */
  counts(): Uint32Array {
    const c = new Uint32Array(this.palette.length);
    let total = 0;
    for (const s of this.sections.values()) for (let i = 0; i < s.length; i++) c[s[i]!]!++;
    for (let i = 1; i < c.length; i++) total += c[i]!;
    c[0] = this.width * this.height * this.length - total;
    return c;
  }
}
