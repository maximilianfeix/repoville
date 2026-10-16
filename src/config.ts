import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Biome, Palette } from './build/palette.js';

export const FORMATS = ['html', 'schem', 'litematic', 'world', 'json'] as const;
export type Format = (typeof FORMATS)[number];

export interface RenderConfig {
  out: string;
  formats: Format[];
  mc: string;
  maxBuildings: number;
  since: string;
  include: string[];
  exclude: string[];
  ignore: string[];
  seed: number;
  textured: boolean;
  open: boolean;
  gallery: boolean;
  /** Embed a commit-history time-lapse in the viewer (reads line deltas of the whole history). */
  timelapse: boolean;
  palette?: Partial<Record<Biome, Partial<Palette>>>;
}

export const DEFAULTS: RenderConfig = {
  out: 'repoville-out',
  formats: ['html', 'schem'],
  mc: '1.21.11',
  maxBuildings: 4000,
  since: '1y',
  include: [],
  exclude: [],
  ignore: [],
  seed: 0,
  textured: false,
  open: false,
  gallery: false,
  timelapse: false,
};

export const CONFIG_FILE = 'repoville.config.json';

export function parseFormats(input: string | string[]): Format[] {
  const list = (Array.isArray(input) ? input : input.split(',')).map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const f of list) if (!(FORMATS as readonly string[]).includes(f)) throw new Error(`Unknown format "${f}". Use: ${FORMATS.join(', ')}`);
  return [...new Set(list)] as Format[];
}

const BLOCK_STATE = /^minecraft:[a-z0-9_]+(\[[a-z0-9_]+=[a-z0-9_]+(,[a-z0-9_]+=[a-z0-9_]+)*\])?$/;
/** Blocks that run commands or carry logic; never accepted from a config file. */
const FORBIDDEN_BLOCKS = /^minecraft:(command_block|chain_command_block|repeating_command_block|structure_block|jigsaw|barrier|light|end_portal|end_gateway|nether_portal|tnt|spawner|trial_spawner)\b/;

export function validateBlockState(state: unknown, where: string): string {
  if (typeof state !== 'string' || !BLOCK_STATE.test(state)) throw new Error(`${where}: "${String(state)}" is not a plain block state like minecraft:stone_bricks`);
  if (FORBIDDEN_BLOCKS.test(state)) throw new Error(`${where}: ${state} is not allowed`);
  return state;
}

const BIOMES = new Set(['nether', 'plains', 'jungle', 'frozen', 'badlands', 'caves', 'cherry', 'end', 'quarry', 'library', 'stone']);
const SLOTS = new Set(['wall', 'towerWall', 'trim', 'roof', 'roofBlock', 'glass', 'floor', 'ground', 'accent', 'mossyWall', 'treeLog', 'treeLeaves']);

/** Keys a repo's own config file may set. `out` is CLI-only so a repo cannot pick where files are written. */
const FILE_KEYS = new Set(['format', 'mc', 'maxBuildings', 'since', 'include', 'exclude', 'ignore', 'seed', 'textured', 'timelapse', 'palette']);

/** Reads repoville.config.json from the repo root (if present). Unknown keys are rejected to catch typos. */
export function readConfigFile(dir: string): Partial<RenderConfig> {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return {};
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (!FILE_KEYS.has(k)) throw new Error(`${CONFIG_FILE}: key "${k}" is not supported in the config file`);
  const strings = (k: string) => {
    const v = raw[k];
    if (v !== undefined && (!Array.isArray(v) || !v.every((x) => typeof x === 'string'))) throw new Error(`${CONFIG_FILE}: "${k}" must be a list of strings`);
  };
  strings('include');
  strings('exclude');
  strings('ignore');
  if (raw.palette !== undefined) {
    if (typeof raw.palette !== 'object' || raw.palette === null) throw new Error(`${CONFIG_FILE}: "palette" must be an object`);
    for (const [biome, slots] of Object.entries(raw.palette as Record<string, unknown>)) {
      if (!BIOMES.has(biome)) throw new Error(`${CONFIG_FILE}: unknown theme "${biome}". Use one of: ${[...BIOMES].join(', ')}`);
      if (typeof slots !== 'object' || slots === null) throw new Error(`${CONFIG_FILE}: palette.${biome} must be an object`);
      for (const [slot, state] of Object.entries(slots as Record<string, unknown>)) {
        const where = `${CONFIG_FILE} palette.${biome}.${slot}`;
        if (!SLOTS.has(slot)) throw new Error(`${where}: unknown slot. Use one of: ${[...SLOTS].join(', ')}`);
        // "roof" is a stair/slab material stem (spruce → minecraft:spruce_stairs), not a block state.
        if (slot === 'roof') {
          if (typeof state !== 'string' || !/^[a-z0-9_]+$/.test(state)) throw new Error(`${where}: use a material name like "spruce" or "stone_brick"`);
        } else validateBlockState(state, where);
      }
    }
  }
  const out: Partial<RenderConfig> = { ...(raw as Partial<RenderConfig>) };
  if (raw.format !== undefined) out.formats = parseFormats(raw.format as string | string[]);
  delete (out as Record<string, unknown>).format;
  return out;
}
