import type { VoxelGrid } from '../build/voxel-grid.js';
import { nbt, writeGzipNbt, type Tag } from './nbt.js';
import { signBlockEntityData } from './sign.js';

export interface SchemMeta {
  name: string;
  author: string;
  /** Epoch milliseconds (HEAD commit time, for determinism). */
  date: number;
  dataVersion: number;
}

function varintSize(v: number): number {
  return v < 0x80 ? 1 : v < 0x4000 ? 2 : 3;
}

/** Yields the varint-encoded block data in Sponge order: index = x + z*W + y*W*L. */
export function* blockData(grid: VoxelGrid, height: number): Generator<Uint8Array> {
  const W = grid.width;
  const row = new Uint16Array(W);
  const zeros = new Uint8Array(W);
  let buf = new Uint8Array(1 << 18);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < grid.length; z++) {
      if (pos + W * 3 > buf.length) {
        yield buf.subarray(0, pos);
        buf = new Uint8Array(1 << 18);
        pos = 0;
      }
      if (grid.sectionEmpty(y, z)) {
        buf.set(zeros, pos);
        pos += W;
        continue;
      }
      grid.row(y, z, row);
      for (let x = 0; x < W; x++) {
        let v = row[x]!;
        while (v >= 0x80) {
          buf[pos++] = (v & 0x7f) | 0x80;
          v >>>= 7;
        }
        buf[pos++] = v;
      }
    }
  }
  if (pos) yield buf.subarray(0, pos);
}

export function blockDataLength(grid: VoxelGrid, height: number): number {
  const sizes = grid.palette.map((_, i) => varintSize(i));
  const row = new Uint16Array(grid.width);
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < grid.length; z++) {
      if (grid.sectionEmpty(y, z)) {
        n += grid.width;
        continue;
      }
      grid.row(y, z, row);
      for (let x = 0; x < grid.width; x++) n += sizes[row[x]!]!;
    }
  }
  return n;
}

export function schemTag(grid: VoxelGrid, meta: SchemMeta): Tag {
  const height = Math.max(1, grid.topY());
  const palette: Record<string, Tag> = {};
  grid.palette.forEach((state, i) => (palette[state] = nbt.int(i)));
  const length = blockDataLength(grid, height);
  const entities = grid.blockEntities
    .filter((e) => e.y < height)
    .map((e) =>
      nbt.compound({
        Pos: nbt.intArray([e.x, e.y, e.z]),
        Id: nbt.string(e.id),
        Data: signBlockEntityData(e.lines, meta.dataVersion),
      }),
    );
  return nbt.compound({
    Schematic: nbt.compound({
      Version: nbt.int(3),
      DataVersion: nbt.int(meta.dataVersion),
      Metadata: nbt.compound({
        Name: nbt.string(meta.name),
        Author: nbt.string(meta.author),
        Date: nbt.long(meta.date),
      }),
      Width: nbt.short(grid.width),
      Height: nbt.short(height),
      Length: nbt.short(grid.length),
      Offset: nbt.intArray([0, 0, 0]),
      Blocks: nbt.compound({
        Palette: nbt.compound(palette),
        Data: { type: 'stream', of: 'byteArray', length, chunks: () => blockData(grid, height) },
        BlockEntities: nbt.list('compound', entities),
      }),
    }),
  });
}

export async function writeSchem(file: string, grid: VoxelGrid, meta: SchemMeta): Promise<void> {
  await writeGzipNbt(file, '', schemTag(grid, meta));
}
