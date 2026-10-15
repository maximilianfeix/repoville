import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VoxelGrid } from '../build/voxel-grid.js';
import { structureTiles, TILE } from '../write/structure-nbt.js';
import { Rcon } from './rcon.js';

export interface LiveOptions {
  host: string;
  port: number;
  password: string;
  /** Server world folder (where level.dat lives). */
  worldDir: string;
  /** World position of the city's north-west ground corner. */
  at: [number, number, number];
  dataVersion: number;
  /** Unique per run so the server's template cache never serves stale tiles. */
  runId: string;
  log?: (m: string) => void;
}

export interface LiveResult {
  tiles: number;
  blocks: number;
  failed: string[];
}

const ns = 'repoville';

/** Writes structure tiles into the world's generated/ folder and places them over RCON. */
export async function buildLive(grid: VoxelGrid, opts: LiveOptions): Promise<LiveResult> {
  const log = opts.log ?? (() => {});
  const tiles = structureTiles(grid, opts.dataVersion);
  const dir = join(opts.worldDir, 'generated', ns, 'structures');
  mkdirSync(dir, { recursive: true });
  for (const t of tiles) writeFileSync(join(dir, `${opts.runId}_${t.tx}_${t.ty}_${t.tz}.nbt`), t.data);
  log(`wrote ${tiles.length} structure tiles to ${dir}`);

  const rcon = new Rcon(opts.host, opts.port);
  await rcon.connect(opts.password);
  const failed: string[] = [];
  const [ax, ay, az] = opts.at;
  try {
    // Force-load the area chunk block by chunk block (the server caps one call at 256 chunks).
    const c0x = Math.floor(ax / 16), c0z = Math.floor(az / 16);
    const c1x = Math.floor((ax + grid.width - 1) / 16), c1z = Math.floor((az + grid.length - 1) / 16);
    const forced: string[] = [];
    for (let cz = c0z; cz <= c1z; cz += 16) for (let cx = c0x; cx <= c1x; cx += 16) {
      const ex = Math.min(c1x, cx + 15), ez = Math.min(c1z, cz + 15);
      const area = `${cx * 16} ${cz * 16} ${ex * 16 + 15} ${ez * 16 + 15}`;
      await rcon.send(`forceload add ${area}`);
      forced.push(area);
    }
    let blocks = 0;
    for (const [i, t] of tiles.entries()) {
      const x = ax + t.tx * TILE, y = ay + t.ty * TILE, z = az + t.tz * TILE;
      const reply = await rcon.send(`place template ${ns}:${opts.runId}_${t.tx}_${t.ty}_${t.tz} ${x} ${y} ${z}`);
      if (!/loaded template|placed/i.test(reply)) failed.push(`${t.tx},${t.ty},${t.tz}: ${reply.trim()}`);
      blocks += t.blocks;
      if ((i + 1) % 25 === 0) log(`placed ${i + 1}/${tiles.length} tiles`);
    }
    for (const area of forced) await rcon.send(`forceload remove ${area}`);
    return { tiles: tiles.length, blocks, failed };
  } finally {
    rcon.close();
  }
}
