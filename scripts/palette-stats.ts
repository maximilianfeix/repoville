// Prints the most common blocks and building heights of a city: npx tsx scripts/palette-stats.ts <city.json>
import { readFileSync } from 'node:fs';
import { buildCity } from '../src/build/city.js';
import { layoutCity } from '../src/layout/treemap.js';
import { applyLod } from '../src/model/lod.js';

const city = applyLod(JSON.parse(readFileSync(process.argv[2]!, 'utf8')), 4000);
const built = buildCity(city, layoutCity(city));
const c = built.grid.counts();
const top = [...built.grid.palette.keys()].filter((i) => i > 0).sort((a, b) => c[b]! - c[a]!).slice(0, 12);
for (const i of top) console.log(String(c[i]).padStart(10), built.grid.palette[i]);
const merged = built.buildings.filter((b) => b.merged);
console.log('merged towers', merged.length, 'at 250:', merged.filter((b) => b.height >= 250).length, 'mossy:', built.buildings.filter((b) => b.mossy).length, '/', built.buildings.length);
