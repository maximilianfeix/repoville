/**
 * Optional "Minecraft textures" mode. Nothing is bundled: when the viewer
 * turns it on, the browser fetches the original block textures from the
 * misode/mcmeta mirror on jsDelivr at runtime, like a resource-pack preview.
 */
export const MC_TEXTURE_BASE = 'https://cdn.jsdelivr.net/gh/misode/mcmeta@assets/assets/minecraft/textures/block/';
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry', 'crimson', 'warped', 'mangrove', 'bamboo'];

/** Texture file (without .png) for a block state and face. */
export function mcTextureName(state: string, face: 'top' | 'side'): string {
  // Waxed blocks look exactly like the unwaxed ones.
  const name = state.replace(/^minecraft:/, '').replace(/\[.*$/, '').replace(/^waxed_/, '');
  const base = name.replace(/_(stairs|slab|fence)$/, '');
  if (base !== name) {
    if (WOODS.includes(base)) return `${base}_planks`;
    const plural: Record<string, string> = {
      stone_brick: 'stone_bricks', red_nether_brick: 'red_nether_bricks', nether_brick: 'nether_bricks', deepslate_tile: 'deepslate_tiles',
      deepslate_brick: 'deepslate_bricks', mud_brick: 'mud_bricks', tuff_brick: 'tuff_bricks', end_stone_brick: 'end_stone_bricks', purpur: 'purpur_block',
      quartz: 'quartz_block_side', smooth_quartz: 'quartz_block_bottom', sandstone: 'sandstone', red_sandstone: 'red_sandstone',
      polished_blackstone_brick: 'polished_blackstone_bricks', brick: 'bricks', prismarine_brick: 'prismarine_bricks',
    };
    return plural[base] ?? base;
  }
  if (/_log$|_stem$/.test(name)) return face === 'top' ? `${name}_top` : name;
  if (/_pillar$/.test(name)) return face === 'top' ? `${name}_top` : `${name}_side`;
  const special: Record<string, [string, string]> = {
    grass_block: ['grass_block_top', 'grass_block_side'],
    dirt_path: ['dirt_path_top', 'dirt_path_side'],
    crimson_nylium: ['crimson_nylium', 'crimson_nylium_side'],
    bookshelf: ['oak_planks', 'bookshelf'],
    snow_block: ['snow', 'snow'],
    water: ['water_still', 'water_still'],
    smooth_sandstone: ['sandstone_top', 'sandstone_top'],
    smooth_red_sandstone: ['red_sandstone_top', 'red_sandstone_top'],
    smooth_quartz: ['quartz_block_bottom', 'quartz_block_bottom'],
    scaffolding: ['scaffolding_top', 'scaffolding_side'],
    lectern: ['lectern_top', 'lectern_sides'],
    campfire: ['campfire_log_lit', 'campfire_log_lit'],
    soul_fire: ['soul_fire_0', 'soul_fire_0'],
    redstone_lamp: ['redstone_lamp_on', 'redstone_lamp_on'],
    magma_block: ['magma', 'magma'],
    oak_sign: ['oak_planks', 'oak_planks'],
    cut_red_sandstone: ['red_sandstone_top', 'cut_red_sandstone'],
    chorus_flower: ['chorus_flower', 'chorus_flower'],
  };
  const sp = special[name];
  if (sp) return face === 'top' ? sp[0] : sp[1];
  return name;
}

/** Grey textures the game tints by biome. */
function tintFor(file: string): [number, number, number] | null {
  if (/^(oak|jungle|acacia|dark_oak|mangrove)_leaves$|^vine$/.test(file)) return [0x59 / 255, 0xae / 255, 0x30 / 255];
  if (/^spruce_leaves$/.test(file)) return [0x61 / 255, 0x99 / 255, 0x61 / 255];
  if (/^birch_leaves$/.test(file)) return [0x80 / 255, 0xa7 / 255, 0x55 / 255];
  if (file === 'grass_block_top') return [0x79 / 255, 0xc0 / 255, 0x5a / 255];
  if (file === 'water_still') return [0x3f / 255, 0x76 / 255, 0xe4 / 255];
  return null;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Builds RGBA layers (16×16, two per palette id: top then side). Missing
 * textures fall back to the flat palette colour. Transparent pixels are laid
 * over a dark interior so glass reads as windows.
 */
export async function loadMcLayers(states: string[], colors: number[], onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const T = 16;
  const out = new Uint8Array(states.length * 2 * T * T * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = T;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const cache = new Map<string, Promise<ImageData | null>>();
  const fetchTex = (file: string) => {
    let p = cache.get(file);
    if (!p) {
      p = loadImage(`${MC_TEXTURE_BASE}${file}.png`)
        .then((img) => {
          ctx.clearRect(0, 0, T, T);
          ctx.drawImage(img, 0, 0, T, T, 0, 0, T, T); // first frame of animated strips
          return ctx.getImageData(0, 0, T, T);
        })
        .catch(() => null);
      cache.set(file, p);
    }
    return p;
  };
  let done = 0;
  const total = states.length * 2;
  await Promise.all(
    states.flatMap((state, id) =>
      (['top', 'side'] as const).map(async (face, f) => {
        const file = mcTextureName(state, face);
        const data = id === 0 ? null : await fetchTex(file);
        const base = (id * 2 + f) * T * T * 4;
        const rgb = colors[id] ?? 0x808080;
        const tint = tintFor(file);
        const under = state.includes('glass') ? [34, 40, 52] : state.includes('leaves') ? [40, 70, 30] : [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
        for (let i = 0; i < T * T; i++) {
          let r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
          if (data) {
            const a = data.data[i * 4 + 3]! / 255;
            r = data.data[i * 4]!; g = data.data[i * 4 + 1]!; b = data.data[i * 4 + 2]!;
            if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
            r = r * a + under[0]! * (1 - a);
            g = g * a + under[1]! * (1 - a);
            b = b * a + under[2]! * (1 - a);
          }
          out[base + i * 4] = r;
          out[base + i * 4 + 1] = g;
          out[base + i * 4 + 2] = b;
          out[base + i * 4 + 3] = 255;
        }
        onProgress?.(++done, total);
      }),
    ),
  );
  return out;
}
