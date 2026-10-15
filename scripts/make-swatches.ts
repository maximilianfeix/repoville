// Renders 16×16 legend swatches from the viewer's own detail textures and palette colours.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { colorOf } from '../src/build/colors.js';
import { encodePng } from '../src/write/png.js';
import { buildDetailLayers, FAMILIES, familyOf, TILE } from '../viewer/textures.js';

const OUT = join(import.meta.dirname, '..', 'site', 'media', 'swatches');
mkdirSync(OUT, { recursive: true });
const layers = buildDetailLayers();
const swatches: Record<string, string> = {
  district: 'minecraft:polished_blackstone',
  building: 'minecraft:bricks',
  fire: 'minecraft:magma_block',
  ruins: 'minecraft:cracked_stone_bricks',
  moss: 'minecraft:mossy_cobblestone',
  theme: 'minecraft:crimson_planks',
  water: 'minecraft:water',
  library: 'minecraft:bookshelf',
};
for (const [name, state] of Object.entries(swatches)) {
  const layer = FAMILIES.indexOf(familyOf(state));
  const rgb = colorOf(state);
  const img = new Uint8Array(TILE * TILE * 4);
  for (let i = 0; i < TILE * TILE; i++) {
    const d = layers[(layer * TILE * TILE + i) * 4]! / 128;
    img[i * 4] = Math.min(255, ((rgb >> 16) & 255) * d);
    img[i * 4 + 1] = Math.min(255, ((rgb >> 8) & 255) * d);
    img[i * 4 + 2] = Math.min(255, (rgb & 255) * d);
    img[i * 4 + 3] = 255;
  }
  writeFileSync(join(OUT, `${name}.png`), encodePng(TILE, TILE, img));
}
console.log(`swatches written to ${OUT}`);
