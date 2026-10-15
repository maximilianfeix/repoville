// Lists block states whose runtime texture name 404s: npx tsx scripts/check-mc-names.ts
import { MC_TEXTURE_BASE, mcTextureName } from '../viewer/mctextures.js';
import { PALETTES, BLOCKS, VARIANTS, stairs, vine } from '../src/build/palette.js';

const states = new Set<string>();
for (const p of Object.values(PALETTES)) for (const [k, v] of Object.entries(p)) {
  if (k === 'biome') continue;
  if (k === 'roof') { states.add(stairs(v, 'north')); states.add(`minecraft:${v}_slab[type=bottom,waterlogged=false]`); }
  else states.add(v);
}
for (const vs of Object.values(VARIANTS)) for (const v of vs) { states.add(v.wall); states.add(v.towerWall); }
for (const v of Object.values(BLOCKS)) states.add(v);
states.add(vine('north'));
states.add('minecraft:gold_block');
const bad: string[] = [];
await Promise.all([...states].flatMap((s) => (['top', 'side'] as const).map(async (f) => {
  const n = mcTextureName(s, f);
  const r = await fetch(`${MC_TEXTURE_BASE}${n}.png`, { method: 'HEAD' });
  if (!r.ok) bad.push(`${s} ${f} -> ${n}`);
})));
console.log(bad.sort().join('\n') || 'all textures resolve');
