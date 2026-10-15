import { zipSync } from 'fflate';
import { deflateSync, gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { parseState } from '../build/blockstate.js';
import type { VoxelGrid } from '../build/voxel-grid.js';
import { encodeToBuffer, nbt, type Tag } from './nbt.js';
import { signBlockEntityData } from './sign.js';

/**
 * Ready-to-open Java Edition world: superflat level.dat plus Anvil region
 * files for every chunk the city touches. City ground (grid y = 0) replaces
 * the grass layer of the classic flat world at y = -61.
 */
export const WORLD_GROUND_Y = -61;
const MIN_Y = -64;
const SECTIONS = 24; // -64 … 319

export interface WorldMeta {
  name: string;
  dataVersion: number;
  mcVersion: string;
  /** Epoch ms (HEAD commit time) — used for LastPlayed and zip timestamps. */
  date: number;
}

const FLAT_LAYERS = [
  { block: 'minecraft:bedrock', height: 1 },
  { block: 'minecraft:dirt', height: 2 },
  { block: 'minecraft:grass_block', height: 1 },
];

function stateTag(state: string): Tag {
  const p = parseState(state);
  const props = Object.entries(p.properties);
  return nbt.compound({
    Name: nbt.string(p.name),
    ...(props.length ? { Properties: nbt.compound(Object.fromEntries(props.map(([k, v]) => [k, nbt.string(v)]))) } : {}),
  });
}

/** Packs section indices into longs without spanning (1.16+ layout). */
export function packSection(indices: Uint16Array, bits: number): BigInt64Array {
  const perLong = Math.floor(64 / bits);
  const longs = new BigInt64Array(Math.ceil(4096 / perLong));
  for (let i = 0; i < 4096; i++) {
    const li = Math.floor(i / perLong);
    const shift = BigInt((i % perLong) * bits);
    longs[li] = BigInt.asIntN(64, longs[li]! | (BigInt(indices[i]!) << shift));
  }
  return longs;
}

function levelDat(meta: WorldMeta, spawn: [number, number, number]): Buffer {
  const flat = nbt.compound({
    biome: nbt.string('minecraft:plains'),
    features: nbt.byte(0),
    lakes: nbt.byte(0),
    layers: nbt.list('compound', FLAT_LAYERS.map((l) => nbt.compound({ block: nbt.string(l.block), height: nbt.int(l.height) }))),
    structure_overrides: nbt.list('string', []),
  });
  const data = nbt.compound({
    DataVersion: nbt.int(meta.dataVersion),
    version: nbt.int(19133),
    LevelName: nbt.string(meta.name),
    GameType: nbt.int(1),
    Difficulty: nbt.byte(0),
    allowCommands: nbt.byte(1),
    hardcore: nbt.byte(0),
    initialized: nbt.byte(1),
    SpawnX: nbt.int(spawn[0]),
    SpawnY: nbt.int(spawn[1]),
    SpawnZ: nbt.int(spawn[2]),
    SpawnAngle: nbt.float(0),
    Time: nbt.long(0),
    DayTime: nbt.long(10500),
    LastPlayed: nbt.long(meta.date),
    raining: nbt.byte(0),
    thundering: nbt.byte(0),
    clearWeatherTime: nbt.int(1_000_000),
    GameRules: nbt.compound({
      doDaylightCycle: nbt.string('false'),
      doWeatherCycle: nbt.string('false'),
      doMobSpawning: nbt.string('false'),
      doFireTick: nbt.string('false'),
      doTileDrops: nbt.string('false'),
    }),
    Version: nbt.compound({ Id: nbt.int(meta.dataVersion), Name: nbt.string(meta.mcVersion), Series: nbt.string('main'), Snapshot: nbt.byte(0) }),
    DataPacks: nbt.compound({ Enabled: nbt.list('string', [nbt.string('vanilla')]), Disabled: nbt.list('string', []) }),
    WorldGenSettings: nbt.compound({
      seed: nbt.long(0),
      generate_features: nbt.byte(0),
      bonus_chest: nbt.byte(0),
      dimensions: nbt.compound({
        'minecraft:overworld': nbt.compound({ type: nbt.string('minecraft:overworld'), generator: nbt.compound({ type: nbt.string('minecraft:flat'), settings: flat }) }),
        'minecraft:the_nether': nbt.compound({
          type: nbt.string('minecraft:the_nether'),
          generator: nbt.compound({ type: nbt.string('minecraft:noise'), settings: nbt.string('minecraft:nether'), biome_source: nbt.compound({ type: nbt.string('minecraft:multi_noise'), preset: nbt.string('minecraft:nether') }) }),
        }),
        'minecraft:the_end': nbt.compound({
          type: nbt.string('minecraft:the_end'),
          generator: nbt.compound({ type: nbt.string('minecraft:noise'), settings: nbt.string('minecraft:end'), biome_source: nbt.compound({ type: nbt.string('minecraft:the_end') }) }),
        }),
      }),
    }),
  });
  return gzipSync(encodeToBuffer('', nbt.compound({ Data: data })), { level: 6 });
}

function chunkTag(grid: VoxelGrid, cx: number, cz: number, meta: WorldMeta, signs: Map<string, string[]>): Tag {
  const sections: Tag[] = [];
  const top = grid.topY();
  const groundBase = WORLD_GROUND_Y; // grid y 0 sits here
  const flatAt = (wy: number) => (wy === MIN_Y ? 'minecraft:bedrock' : wy < WORLD_GROUND_Y ? 'minecraft:dirt' : wy === WORLD_GROUND_Y ? 'minecraft:grass_block[snowy=false]' : 'minecraft:air');
  const indices = new Uint16Array(4096);
  for (let s = 0; s < SECTIONS; s++) {
    const sy = MIN_Y / 16 + s;
    const palette: string[] = [];
    const lookup = new Map<string, number>();
    const idx = (state: string) => {
      let i = lookup.get(state);
      if (i === undefined) {
        i = palette.length;
        palette.push(state);
        lookup.set(state, i);
      }
      return i;
    };
    idx('minecraft:air');
    for (let ly = 0; ly < 16; ly++) {
      const wy = sy * 16 + ly;
      const gy = wy - groundBase;
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const gx = cx * 16 + lx;
        const gz = cz * 16 + lz;
        let state: string;
        if (gy >= 0 && gy < top && gx < grid.width && gz < grid.length) {
          const id = grid.get(gx, gy, gz);
          state = gy === 0 && id === 0 ? flatAt(wy) : grid.palette[id]!;
        } else state = flatAt(wy);
        indices[(ly * 16 + lz) * 16 + lx] = idx(state);
      }
    }
    if (palette.length === 1 && wy0Above(sy, top)) continue; // all air above the city: let the game fill it
    const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
    sections.push(nbt.compound({
      Y: nbt.byte(sy),
      block_states: nbt.compound({
        palette: nbt.list('compound', palette.map(stateTag)),
        ...(palette.length > 1 ? { data: nbt.longArray(packSection(indices, bits)) } : {}),
      }),
      biomes: nbt.compound({ palette: nbt.list('string', [nbt.string('minecraft:plains')]) }),
    }));
  }
  const blockEntities: Tag[] = [];
  for (const [key, lines] of signs) {
    const [x, y, z] = key.split(',').map(Number) as [number, number, number];
    if (x >> 4 !== cx || z >> 4 !== cz) continue;
    const data = signBlockEntityData(lines, meta.dataVersion);
    if (data.type !== 'compound') continue;
    blockEntities.push(nbt.compound({ id: nbt.string('minecraft:sign'), x: nbt.int(x), y: nbt.int(y + WORLD_GROUND_Y), z: nbt.int(z), keepPacked: nbt.byte(0), ...data.value }));
  }
  return nbt.compound({
    DataVersion: nbt.int(meta.dataVersion),
    xPos: nbt.int(cx),
    zPos: nbt.int(cz),
    yPos: nbt.int(MIN_Y / 16),
    Status: nbt.string('minecraft:full'),
    LastUpdate: nbt.long(0),
    InhabitedTime: nbt.long(0),
    isLightOn: nbt.byte(0),
    sections: nbt.list('compound', sections),
    block_entities: nbt.list('compound', blockEntities),
    block_ticks: nbt.list('compound', []),
    fluid_ticks: nbt.list('compound', []),
    PostProcessing: nbt.list('list', []),
    structures: nbt.compound({ References: nbt.compound({}), starts: nbt.compound({}) }),
  });
}

function wy0Above(sy: number, top: number): boolean {
  return sy * 16 > WORLD_GROUND_Y + top;
}

/** One Anvil region file from encoded chunks (key = local index 0..1023). */
export function regionFile(chunks: Map<number, Buffer>): Buffer {
  const header = Buffer.alloc(8192);
  const bodies: Buffer[] = [];
  let sector = 2;
  for (const [i, raw] of [...chunks.entries()].sort((a, b) => a[0] - b[0])) {
    const z = deflateSync(raw, { level: 6 });
    const len = z.length + 1;
    const total = 4 + len;
    const sectors = Math.ceil(total / 4096);
    if (sectors > 255) throw new Error('chunk too large for one region entry');
    const body = Buffer.alloc(sectors * 4096);
    body.writeUInt32BE(len, 0);
    body.writeUInt8(2, 4); // zlib
    z.copy(body, 5);
    header.writeUIntBE(sector, i * 4, 3);
    header.writeUInt8(sectors, i * 4 + 3);
    // timestamps (bytes 4096…) stay 0 for determinism
    bodies.push(body);
    sector += sectors;
  }
  return Buffer.concat([header, ...bodies]);
}

export function buildWorldFiles(grid: VoxelGrid, meta: WorldMeta): Record<string, Uint8Array> {
  const folder = meta.name.replace(/[^\w.-]+/g, '_');
  const signs = new Map<string, string[]>();
  for (const e of grid.blockEntities) signs.set(`${e.x},${e.y},${e.z}`, e.lines);
  const regions = new Map<string, Map<number, Buffer>>();
  const chunksX = Math.ceil(grid.width / 16);
  const chunksZ = Math.ceil(grid.length / 16);
  for (let cz = 0; cz < chunksZ; cz++) for (let cx = 0; cx < chunksX; cx++) {
    const key = `${cx >> 5}.${cz >> 5}`;
    let r = regions.get(key);
    if (!r) regions.set(key, (r = new Map()));
    r.set((cx & 31) + (cz & 31) * 32, encodeToBuffer('', chunkTag(grid, cx, cz, meta, signs)));
  }
  const files: Record<string, Uint8Array> = {};
  const spawn: [number, number, number] = [Math.floor(grid.width / 2), WORLD_GROUND_Y + 1, -4];
  files[`${folder}/level.dat`] = levelDat(meta, spawn);
  for (const [key, chunks] of [...regions.entries()].sort()) files[`${folder}/region/r.${key}.mca`] = regionFile(chunks);
  return files;
}

export function writeWorldZip(file: string, grid: VoxelGrid, meta: WorldMeta): void {
  const files = buildWorldFiles(grid, meta);
  const mtime = new Date(Math.max(meta.date, Date.UTC(1980, 0, 2)));
  const entries: Record<string, [Uint8Array, { mtime: Date; level: 0 }]> = {};
  for (const [name, data] of Object.entries(files)) entries[name] = [data, { mtime, level: 0 }];
  writeFileSync(file, zipSync(entries));
}
