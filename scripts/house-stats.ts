// Which folders hold the most suburb houses? npx tsx scripts/house-stats.ts <city.json>
import { readFileSync } from 'node:fs';
import { layoutCity } from '../src/layout/treemap.js';
import { applyLod } from '../src/model/lod.js';
const city = applyLod(JSON.parse(readFileSync(process.argv[2]!, 'utf8')), 4000);
const l = layoutCity(city);
const by = new Map<string, number>();
for (const b of l.buildings) if (b.kind === 'house') { const d = b.file.path.split('/').slice(0, -1).join('/'); by.set(d, (by.get(d) ?? 0) + 1); }
console.log([...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));
