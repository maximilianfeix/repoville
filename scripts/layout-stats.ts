// Prints layout stats for a CityTree JSON: npx tsx scripts/layout-stats.ts city.json [maxBuildings]
import { readFileSync } from 'node:fs';
import { applyLod } from '../src/model/lod.js';
import { files } from '../src/model/city.js';
import { layoutCity } from '../src/layout/treemap.js';

const city = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const max = Number(process.argv[3] ?? 4000);
const t0 = performance.now();
const lod = applyLod(city, max);
const l = layoutCity(lod);
const ms = performance.now() - t0;
const towers = l.buildings.filter((b) => b.kind === 'tower').length;
console.log(JSON.stringify({ files: city.stats.files, afterLod: [...files(lod.root)].length, buildings: l.buildings.length, towers, houses: l.buildings.length - towers, districts: l.districts.length, side: l.width, maxHeight: Math.max(...l.buildings.map((b) => b.height)), ms: Math.round(ms) }));
