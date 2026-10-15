import type { Lang } from '../scan/langs.js';

export type Biome = 'nether' | 'plains' | 'jungle' | 'frozen' | 'badlands' | 'caves' | 'cherry' | 'end' | 'quarry' | 'library' | 'stone';

export interface Palette {
  biome: Biome;
  wall: string;
  corner: string;
  glass: string;
  roof: string;
  floor: string;
  ground: string;
  accent: string;
  mossyWall: string;
}

const slab = (name: string) => `minecraft:${name}[type=bottom,waterlogged=false]`;
const log = (name: string) => `minecraft:${name}[axis=y]`;
const GRASS = 'minecraft:grass_block[snowy=false]';

export const PALETTES: Record<Biome, Palette> = {
  nether: { biome: 'nether', wall: 'minecraft:polished_blackstone_bricks', corner: log('crimson_stem'), glass: 'minecraft:red_stained_glass', roof: slab('crimson_slab'), floor: 'minecraft:crimson_planks', ground: 'minecraft:crimson_nylium', accent: 'minecraft:magma_block', mossyWall: 'minecraft:cracked_polished_blackstone_bricks' },
  plains: { biome: 'plains', wall: 'minecraft:birch_planks', corner: log('oak_log'), glass: 'minecraft:glass', roof: slab('oak_slab'), floor: 'minecraft:oak_planks', ground: GRASS, accent: 'minecraft:yellow_concrete', mossyWall: 'minecraft:mossy_cobblestone' },
  jungle: { biome: 'jungle', wall: 'minecraft:jungle_planks', corner: log('jungle_log'), glass: 'minecraft:lime_stained_glass', roof: slab('jungle_slab'), floor: 'minecraft:mossy_cobblestone', ground: GRASS, accent: 'minecraft:lime_concrete', mossyWall: 'minecraft:mossy_cobblestone' },
  frozen: { biome: 'frozen', wall: 'minecraft:light_blue_concrete', corner: 'minecraft:packed_ice', glass: 'minecraft:light_blue_stained_glass', roof: slab('diorite_slab'), floor: 'minecraft:snow_block', ground: 'minecraft:snow_block', accent: 'minecraft:blue_ice', mossyWall: 'minecraft:moss_block' },
  badlands: { biome: 'badlands', wall: 'minecraft:terracotta', corner: log('dark_oak_log'), glass: 'minecraft:orange_stained_glass', roof: slab('dark_oak_slab'), floor: 'minecraft:dark_oak_planks', ground: 'minecraft:red_sand', accent: 'minecraft:orange_terracotta', mossyWall: 'minecraft:moss_block' },
  caves: { biome: 'caves', wall: 'minecraft:deepslate_bricks', corner: 'minecraft:iron_block', glass: 'minecraft:gray_stained_glass', roof: slab('deepslate_brick_slab'), floor: 'minecraft:polished_deepslate', ground: 'minecraft:tuff', accent: 'minecraft:iron_block', mossyWall: 'minecraft:cracked_deepslate_bricks' },
  cherry: { biome: 'cherry', wall: 'minecraft:cherry_planks', corner: log('cherry_log'), glass: 'minecraft:pink_stained_glass', roof: slab('cherry_slab'), floor: 'minecraft:cherry_planks', ground: GRASS, accent: 'minecraft:pink_concrete', mossyWall: 'minecraft:moss_block' },
  end: { biome: 'end', wall: 'minecraft:purpur_block', corner: log('purpur_pillar'), glass: 'minecraft:magenta_stained_glass', roof: slab('purpur_slab'), floor: 'minecraft:end_stone_bricks', ground: 'minecraft:end_stone', accent: 'minecraft:end_rod[facing=up]', mossyWall: 'minecraft:moss_block' },
  quarry: { biome: 'quarry', wall: 'minecraft:cobblestone', corner: 'minecraft:scaffolding[bottom=false,distance=0,waterlogged=false]', glass: 'minecraft:glass', roof: slab('cobblestone_slab'), floor: 'minecraft:gravel', ground: 'minecraft:gravel', accent: 'minecraft:andesite', mossyWall: 'minecraft:mossy_cobblestone' },
  library: { biome: 'library', wall: 'minecraft:bookshelf', corner: log('spruce_log'), glass: 'minecraft:white_stained_glass', roof: slab('spruce_slab'), floor: 'minecraft:spruce_planks', ground: GRASS, accent: 'minecraft:lectern[facing=south,has_book=false,powered=false]', mossyWall: 'minecraft:moss_block' },
  stone: { biome: 'stone', wall: 'minecraft:stone_bricks', corner: 'minecraft:chiseled_stone_bricks', glass: 'minecraft:glass', roof: slab('stone_brick_slab'), floor: 'minecraft:smooth_stone', ground: GRASS, accent: 'minecraft:polished_andesite', mossyWall: 'minecraft:mossy_stone_bricks' },
};

const LANG_BIOME: Record<Lang, Biome> = {
  rust: 'nether', typescript: 'plains', javascript: 'plains', python: 'jungle', go: 'frozen', java: 'badlands', kotlin: 'badlands',
  c: 'caves', cpp: 'caves', ruby: 'cherry', haskell: 'end', fp: 'end', shell: 'quarry', config: 'quarry', markdown: 'library', other: 'stone',
};

export function biomeFor(lang: Lang): Biome {
  return LANG_BIOME[lang];
}

/** Applies user overrides from repoville.config.json: { "palette": { "plains": { "wall": "minecraft:..." } } }. */
export function withOverrides(overrides: Partial<Record<Biome, Partial<Palette>>> | undefined): Record<Biome, Palette> {
  if (!overrides) return PALETTES;
  const out = { ...PALETTES };
  for (const [biome, o] of Object.entries(overrides) as Array<[Biome, Partial<Palette>]>) {
    if (out[biome]) out[biome] = { ...out[biome], ...o, biome };
  }
  return out;
}

export const BLOCKS = {
  roadTop: 'minecraft:polished_blackstone',
  roadDeep: 'minecraft:dirt_path',
  plaza: 'minecraft:polished_andesite',
  grass: GRASS,
  fence: 'minecraft:oak_fence[east=false,north=false,south=false,waterlogged=false,west=false]',
  lantern: 'minecraft:lantern[hanging=false,waterlogged=false]',
  sign: 'minecraft:oak_sign[rotation=0,waterlogged=false]',
  campfire: 'minecraft:campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]',
  soulSand: 'minecraft:soul_sand',
  soulFire: 'minecraft:soul_fire',
  cracked: 'minecraft:cracked_stone_bricks',
  cobweb: 'minecraft:cobweb',
  lighthouseA: 'minecraft:white_concrete',
  lighthouseB: 'minecraft:red_concrete',
  lighthouseLamp: 'minecraft:sea_lantern',
  ironBars: 'minecraft:iron_bars[east=false,north=false,south=false,waterlogged=false,west=false]',
  bedrockBase: 'minecraft:stone',
} as const;

/** Vine attached to the block on the given side of the vine. */
export function vine(side: 'north' | 'south' | 'east' | 'west'): string {
  const p = (s: string) => (s === side ? 'true' : 'false');
  return `minecraft:vine[east=${p('east')},north=${p('north')},south=${p('south')},up=false,west=${p('west')}]`;
}
