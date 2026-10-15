import type { Lang } from '../scan/langs.js';

export type Biome = 'nether' | 'plains' | 'jungle' | 'frozen' | 'badlands' | 'caves' | 'cherry' | 'end' | 'quarry' | 'library' | 'stone';

/**
 * A district theme. Materials are chosen so that every theme shares the
 * same warm, readable city look and only the accents change.
 */
export interface Palette {
  biome: Biome;
  /** Walls of houses and low buildings. */
  wall: string;
  /** Walls of mid-rises and towers. */
  towerWall: string;
  /** Corners, cornices, floor lines. */
  trim: string;
  /** Stair-capable material for pitched roofs, e.g. "spruce" → minecraft:spruce_stairs. */
  roof: string;
  /** Full block matching the roof (ridges, flat roofs). */
  roofBlock: string;
  glass: string;
  floor: string;
  /** Lot ground. */
  ground: string;
  accent: string;
  mossyWall: string;
  treeLog: string;
  treeLeaves: string;
}

const log = (name: string) => `minecraft:${name}[axis=y]`;
const leaves = (name: string) => `minecraft:${name}[distance=1,persistent=true,waterlogged=false]`;
const GRASS = 'minecraft:grass_block[snowy=false]';

export const PALETTES: Record<Biome, Palette> = {
  plains: { biome: 'plains', wall: 'minecraft:birch_planks', towerWall: 'minecraft:smooth_sandstone', trim: log('stripped_oak_log'), roof: 'spruce', roofBlock: 'minecraft:spruce_planks', glass: 'minecraft:light_blue_stained_glass', floor: 'minecraft:oak_planks', ground: GRASS, accent: 'minecraft:yellow_concrete', mossyWall: 'minecraft:mossy_cobblestone', treeLog: log('oak_log'), treeLeaves: leaves('oak_leaves') },
  nether: { biome: 'nether', wall: 'minecraft:nether_bricks', towerWall: 'minecraft:polished_blackstone_bricks', trim: log('crimson_stem'), roof: 'red_nether_brick', roofBlock: 'minecraft:red_nether_bricks', glass: 'minecraft:orange_stained_glass', floor: 'minecraft:crimson_planks', ground: 'minecraft:crimson_nylium', accent: 'minecraft:magma_block', mossyWall: 'minecraft:cracked_polished_blackstone_bricks', treeLog: log('crimson_stem'), treeLeaves: 'minecraft:nether_wart_block' },
  jungle: { biome: 'jungle', wall: 'minecraft:jungle_planks', towerWall: 'minecraft:mud_bricks', trim: log('jungle_log'), roof: 'mossy_cobblestone', roofBlock: 'minecraft:mossy_cobblestone', glass: 'minecraft:lime_stained_glass', floor: 'minecraft:jungle_planks', ground: GRASS, accent: 'minecraft:lime_concrete', mossyWall: 'minecraft:mossy_cobblestone', treeLog: log('jungle_log'), treeLeaves: leaves('jungle_leaves') },
  frozen: { biome: 'frozen', wall: 'minecraft:white_concrete', towerWall: 'minecraft:light_blue_terracotta', trim: 'minecraft:packed_ice', roof: 'dark_prismarine', roofBlock: 'minecraft:dark_prismarine', glass: 'minecraft:light_blue_stained_glass', floor: 'minecraft:spruce_planks', ground: 'minecraft:snow_block', accent: 'minecraft:blue_ice', mossyWall: 'minecraft:moss_block', treeLog: log('spruce_log'), treeLeaves: leaves('spruce_leaves') },
  badlands: { biome: 'badlands', wall: 'minecraft:white_terracotta', towerWall: 'minecraft:terracotta', trim: log('dark_oak_log'), roof: 'red_sandstone', roofBlock: 'minecraft:cut_red_sandstone', glass: 'minecraft:orange_stained_glass', floor: 'minecraft:dark_oak_planks', ground: 'minecraft:red_sand', accent: 'minecraft:orange_terracotta', mossyWall: 'minecraft:moss_block', treeLog: log('acacia_log'), treeLeaves: leaves('acacia_leaves') },
  caves: { biome: 'caves', wall: 'minecraft:tuff_bricks', towerWall: 'minecraft:deepslate_bricks', trim: 'minecraft:polished_deepslate', roof: 'deepslate_tile', roofBlock: 'minecraft:deepslate_tiles', glass: 'minecraft:light_gray_stained_glass', floor: 'minecraft:polished_deepslate', ground: GRASS, accent: 'minecraft:iron_block', mossyWall: 'minecraft:cracked_deepslate_bricks', treeLog: log('dark_oak_log'), treeLeaves: leaves('dark_oak_leaves') },
  cherry: { biome: 'cherry', wall: 'minecraft:cherry_planks', towerWall: 'minecraft:pink_terracotta', trim: log('cherry_log'), roof: 'dark_oak', roofBlock: 'minecraft:dark_oak_planks', glass: 'minecraft:pink_stained_glass', floor: 'minecraft:cherry_planks', ground: GRASS, accent: 'minecraft:pink_concrete', mossyWall: 'minecraft:moss_block', treeLog: log('cherry_log'), treeLeaves: leaves('cherry_leaves') },
  end: { biome: 'end', wall: 'minecraft:end_stone_bricks', towerWall: 'minecraft:purpur_block', trim: log('purpur_pillar'), roof: 'purpur', roofBlock: 'minecraft:purpur_block', glass: 'minecraft:magenta_stained_glass', floor: 'minecraft:end_stone_bricks', ground: 'minecraft:end_stone', accent: 'minecraft:end_rod[facing=up]', mossyWall: 'minecraft:moss_block', treeLog: log('purpur_pillar'), treeLeaves: 'minecraft:chorus_flower[age=0]' },
  quarry: { biome: 'quarry', wall: 'minecraft:cobblestone', towerWall: 'minecraft:andesite', trim: log('stripped_spruce_log'), roof: 'cobblestone', roofBlock: 'minecraft:cobblestone', glass: 'minecraft:glass', floor: 'minecraft:spruce_planks', ground: 'minecraft:coarse_dirt', accent: 'minecraft:scaffolding[bottom=false,distance=0,waterlogged=false]', mossyWall: 'minecraft:mossy_cobblestone', treeLog: log('spruce_log'), treeLeaves: leaves('spruce_leaves') },
  library: { biome: 'library', wall: 'minecraft:bookshelf', towerWall: 'minecraft:bookshelf', trim: log('quartz_pillar'), roof: 'dark_oak', roofBlock: 'minecraft:dark_oak_planks', glass: 'minecraft:white_stained_glass', floor: 'minecraft:spruce_planks', ground: GRASS, accent: 'minecraft:lectern[facing=south,has_book=false,powered=false]', mossyWall: 'minecraft:moss_block', treeLog: log('birch_log'), treeLeaves: leaves('birch_leaves') },
  stone: { biome: 'stone', wall: 'minecraft:stone_bricks', towerWall: 'minecraft:polished_andesite', trim: 'minecraft:chiseled_stone_bricks', roof: 'stone_brick', roofBlock: 'minecraft:stone_bricks', glass: 'minecraft:glass', floor: 'minecraft:smooth_stone', ground: GRASS, accent: 'minecraft:polished_andesite', mossyWall: 'minecraft:mossy_stone_bricks', treeLog: log('oak_log'), treeLeaves: leaves('oak_leaves') },
};

const LANG_BIOME: Record<Lang, Biome> = {
  rust: 'nether', typescript: 'plains', javascript: 'plains', python: 'jungle', go: 'frozen', java: 'badlands', kotlin: 'badlands',
  c: 'caves', cpp: 'caves', ruby: 'cherry', haskell: 'end', fp: 'end', shell: 'quarry', config: 'quarry', markdown: 'library', other: 'stone',
};

/**
 * Facade variants per theme. Each neighbourhood (first two folder levels)
 * picks one deterministically, so districts read as distinct quarters while
 * staying inside their theme.
 */
export const VARIANTS: Record<Biome, Array<{ wall: string; towerWall: string }>> = {
  plains: [
    { wall: 'minecraft:birch_planks', towerWall: 'minecraft:smooth_sandstone' },
    { wall: 'minecraft:oak_planks', towerWall: 'minecraft:white_terracotta' },
    { wall: 'minecraft:birch_planks', towerWall: 'minecraft:bricks' },
    { wall: 'minecraft:stripped_birch_log[axis=y]', towerWall: 'minecraft:smooth_quartz' },
  ],
  nether: [
    { wall: 'minecraft:nether_bricks', towerWall: 'minecraft:polished_blackstone_bricks' },
    { wall: 'minecraft:red_nether_bricks', towerWall: 'minecraft:nether_bricks' },
  ],
  jungle: [
    { wall: 'minecraft:jungle_planks', towerWall: 'minecraft:mud_bricks' },
    { wall: 'minecraft:mossy_stone_bricks', towerWall: 'minecraft:packed_mud' },
  ],
  frozen: [
    { wall: 'minecraft:white_concrete', towerWall: 'minecraft:light_blue_terracotta' },
    { wall: 'minecraft:snow_block', towerWall: 'minecraft:white_concrete' },
  ],
  badlands: [
    { wall: 'minecraft:white_terracotta', towerWall: 'minecraft:terracotta' },
    { wall: 'minecraft:smooth_red_sandstone', towerWall: 'minecraft:orange_terracotta' },
  ],
  caves: [
    { wall: 'minecraft:tuff_bricks', towerWall: 'minecraft:deepslate_bricks' },
    { wall: 'minecraft:polished_tuff', towerWall: 'minecraft:polished_deepslate' },
  ],
  cherry: [
    { wall: 'minecraft:cherry_planks', towerWall: 'minecraft:pink_terracotta' },
    { wall: 'minecraft:white_terracotta', towerWall: 'minecraft:cherry_planks' },
  ],
  end: [{ wall: 'minecraft:end_stone_bricks', towerWall: 'minecraft:purpur_block' }],
  quarry: [
    { wall: 'minecraft:cobblestone', towerWall: 'minecraft:andesite' },
    { wall: 'minecraft:stone', towerWall: 'minecraft:polished_andesite' },
  ],
  library: [{ wall: 'minecraft:bookshelf', towerWall: 'minecraft:bookshelf' }],
  stone: [
    { wall: 'minecraft:stone_bricks', towerWall: 'minecraft:polished_andesite' },
    { wall: 'minecraft:smooth_stone', towerWall: 'minecraft:stone_bricks' },
  ],
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

export type Facing = 'north' | 'south' | 'east' | 'west';

export function stairs(material: string, facing: Facing): string {
  return `minecraft:${material}_stairs[facing=${facing},half=bottom,shape=straight,waterlogged=false]`;
}

export const BLOCKS = {
  roadTop: 'minecraft:polished_blackstone',
  roadMid: 'minecraft:polished_deepslate',
  roadLane: 'minecraft:tuff',
  roadDeep: 'minecraft:dirt_path',
  sidewalk: 'minecraft:smooth_stone',
  plaza: 'minecraft:polished_andesite',
  grass: GRASS,
  fence: 'minecraft:dark_oak_fence[east=false,north=false,south=false,waterlogged=false,west=false]',
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
  antenna: 'minecraft:lightning_rod[facing=up,powered=false,waterlogged=false]',
  beacon: 'minecraft:sea_lantern',
  roofBox: 'minecraft:smooth_stone',
  chimney: 'minecraft:bricks',
  door: 'minecraft:dark_oak_planks',
  flowerA: 'minecraft:poppy',
  flowerB: 'minecraft:dandelion',
  bush: 'minecraft:azalea_leaves[distance=1,persistent=true,waterlogged=false]',
  water: 'minecraft:water[level=0]',
} as const;

/** Vine attached to the block on the given side of the vine. */
export function vine(side: Facing): string {
  const p = (s: string) => (s === side ? 'true' : 'false');
  return `minecraft:vine[east=${p('east')},north=${p('north')},south=${p('south')},up=false,west=${p('west')}]`;
}
