import { gzipSync } from 'node:zlib';
import { parseState } from '../build/blockstate.js';
import type { VoxelGrid } from '../build/voxel-grid.js';
import { encodeToBuffer, nbt, type Tag } from './nbt.js';
import { signBlockEntityData } from './sign.js';

/** Vanilla structure templates are limited to 48 blocks per axis. */
export const TILE = 48;

export interface StructureTile {
  /** Tile index along x, y, z. */
  tx: number;
  ty: number;
  tz: number;
  /** gzip-compressed structure NBT. */
  data: Buffer;
  blocks: number;
}

function stateTag(state: string): Tag {
  const p = parseState(state);
  const props = Object.entries(p.properties);
  return nbt.compound({
    Name: nbt.string(p.name),
    ...(props.length ? { Properties: nbt.compound(Object.fromEntries(props.map(([k, v]) => [k, nbt.string(v)]))) } : {}),
  });
}

/**
 * Cuts the grid into ≤48³ structure templates. Air is left out, so placing a
 * tile never carves into terrain; empty tiles are skipped.
 */
export function structureTiles(grid: VoxelGrid, dataVersion: number): StructureTile[] {
  const top = grid.topY();
  const signs = new Map(grid.blockEntities.map((e) => [`${e.x},${e.y},${e.z}`, e.lines]));
  const tiles: StructureTile[] = [];
  for (let ty = 0; ty * TILE < top; ty++) for (let tz = 0; tz * TILE < grid.length; tz++) for (let tx = 0; tx * TILE < grid.width; tx++) {
    const sx = Math.min(TILE, grid.width - tx * TILE);
    const sy = Math.min(TILE, top - ty * TILE);
    const sz = Math.min(TILE, grid.length - tz * TILE);
    const palette: number[] = [];
    const local = new Map<number, number>();
    const blocks: Tag[] = [];
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      const gx = tx * TILE + x, gy = ty * TILE + y, gz = tz * TILE + z;
      const id = grid.get(gx, gy, gz);
      if (!id) continue;
      let li = local.get(id);
      if (li === undefined) {
        li = palette.length;
        palette.push(id);
        local.set(id, li);
      }
      const lines = signs.get(`${gx},${gy},${gz}`);
      const data = lines ? signBlockEntityData(lines, dataVersion) : null;
      blocks.push(nbt.compound({
        pos: nbt.list('int', [nbt.int(x), nbt.int(y), nbt.int(z)]),
        state: nbt.int(li),
        ...(data && data.type === 'compound' ? { nbt: nbt.compound({ id: nbt.string('minecraft:sign'), ...data.value }) } : {}),
      }));
    }
    if (!blocks.length) continue;
    const root = nbt.compound({
      DataVersion: nbt.int(dataVersion),
      size: nbt.list('int', [nbt.int(sx), nbt.int(sy), nbt.int(sz)]),
      palette: nbt.list('compound', palette.map((id) => stateTag(grid.palette[id]!))),
      blocks: nbt.list('compound', blocks),
      entities: nbt.list('compound', []),
    });
    tiles.push({ tx, ty, tz, data: gzipSync(encodeToBuffer('', root), { level: 6 }), blocks: blocks.length });
  }
  return tiles;
}
