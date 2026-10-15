/**
 * Flat preview colors per block id (no Mojang textures are bundled; these are
 * hand-picked approximations used by the HTML viewer and gallery thumbnails).
 */
export const BLOCK_COLORS: Record<string, number> = {
  'minecraft:polished_blackstone_bricks': 0x2e2a30, 'minecraft:cracked_polished_blackstone_bricks': 0x29252b,
  'minecraft:crimson_stem': 0x6a2c3e, 'minecraft:red_stained_glass': 0xa83a3a, 'minecraft:crimson_slab': 0x7e3a56,
  'minecraft:crimson_planks': 0x7e3a56, 'minecraft:crimson_nylium': 0x8a1f1f, 'minecraft:magma_block': 0xc0581c,
  'minecraft:birch_planks': 0xd7c98c, 'minecraft:oak_log': 0x6b5434, 'minecraft:glass': 0xc8e6ef, 'minecraft:oak_slab': 0xa88754,
  'minecraft:oak_planks': 0xa88754, 'minecraft:grass_block': 0x6aa84f, 'minecraft:yellow_concrete': 0xf0af15,
  'minecraft:mossy_cobblestone': 0x6e7a5e, 'minecraft:jungle_planks': 0xa0734d, 'minecraft:jungle_log': 0x584419,
  'minecraft:lime_stained_glass': 0x7fcc19, 'minecraft:jungle_slab': 0xa0734d, 'minecraft:lime_concrete': 0x5ea918,
  'minecraft:light_blue_concrete': 0x3aafd9, 'minecraft:packed_ice': 0x8db4f2, 'minecraft:light_blue_stained_glass': 0x8fc6e6,
  'minecraft:diorite_slab': 0xbdbcbd, 'minecraft:snow_block': 0xf3fafa, 'minecraft:blue_ice': 0x74a8fd, 'minecraft:moss_block': 0x596e2d,
  'minecraft:terracotta': 0x985e43, 'minecraft:dark_oak_log': 0x3c2e1a, 'minecraft:orange_stained_glass': 0xd88a3a,
  'minecraft:dark_oak_slab': 0x42301a, 'minecraft:dark_oak_planks': 0x42301a, 'minecraft:red_sand': 0xbe6621, 'minecraft:orange_terracotta': 0xa15325,
  'minecraft:deepslate_bricks': 0x46464a, 'minecraft:iron_block': 0xdcdcdc, 'minecraft:gray_stained_glass': 0x6b6b6b,
  'minecraft:deepslate_brick_slab': 0x46464a, 'minecraft:polished_deepslate': 0x48484b, 'minecraft:tuff': 0x6c6d66, 'minecraft:cracked_deepslate_bricks': 0x403f42,
  'minecraft:cherry_planks': 0xe2b2ac, 'minecraft:cherry_log': 0x3b1f2c, 'minecraft:pink_stained_glass': 0xf2a5c4,
  'minecraft:cherry_slab': 0xe2b2ac, 'minecraft:pink_concrete': 0xd6658f,
  'minecraft:purpur_block': 0xa97ea9, 'minecraft:purpur_pillar': 0xab81ab, 'minecraft:magenta_stained_glass': 0xb24cd8,
  'minecraft:purpur_slab': 0xa97ea9, 'minecraft:end_stone_bricks': 0xdadb9f, 'minecraft:end_stone': 0xdbde9e, 'minecraft:end_rod': 0xf0eae0,
  'minecraft:cobblestone': 0x7f7f7f, 'minecraft:scaffolding': 0xc2a05a, 'minecraft:cobblestone_slab': 0x7f7f7f, 'minecraft:gravel': 0x837e7c, 'minecraft:andesite': 0x888888,
  'minecraft:bookshelf': 0x75502e, 'minecraft:spruce_log': 0x3b2912, 'minecraft:white_stained_glass': 0xf0f0f0,
  'minecraft:spruce_slab': 0x725431, 'minecraft:spruce_planks': 0x725431, 'minecraft:lectern': 0xa07a46,
  'minecraft:stone_bricks': 0x7a7a7a, 'minecraft:chiseled_stone_bricks': 0x777777, 'minecraft:stone_brick_slab': 0x7a7a7a,
  'minecraft:smooth_stone': 0x9e9e9e, 'minecraft:polished_andesite': 0x848685, 'minecraft:mossy_stone_bricks': 0x737a62,
  'minecraft:polished_blackstone': 0x35303b, 'minecraft:dirt_path': 0x947a41, 'minecraft:oak_fence': 0xa88754,
  'minecraft:lantern': 0xffb54a, 'minecraft:oak_sign': 0xb08f5a, 'minecraft:campfire': 0xff7a1a, 'minecraft:soul_sand': 0x51402f,
  'minecraft:soul_fire': 0x3fd0c9, 'minecraft:cracked_stone_bricks': 0x6e6e6e, 'minecraft:cobweb': 0xe4e4e4,
  'minecraft:white_concrete': 0xcfd5d6, 'minecraft:red_concrete': 0x8e2121, 'minecraft:sea_lantern': 0xd5e6dd,
  'minecraft:iron_bars': 0x8a8a8a, 'minecraft:stone': 0x7d7d7d, 'minecraft:vine': 0x3f7a1f, 'minecraft:dirt': 0x866043,
};

export function colorOf(state: string): number {
  const open = state.indexOf('[');
  return BLOCK_COLORS[open === -1 ? state : state.slice(0, open)] ?? 0x808080;
}

/** Blocks the viewer renders see-through-ish or skips for face culling. */
export function isTransparent(state: string): boolean {
  return /glass|cobweb|vine|lantern|campfire|soul_fire|iron_bars|fence|sign|scaffolding|end_rod|lectern|slab/.test(state);
}
