// E2E: build the town fixture live on Paper via structure tiles + /place template over RCON, then verify blocks.
// Usage: npx tsx test/e2e/live.ts
import { join } from 'node:path';
import { analyze } from '../../src/analyze.js';
import { buildCity } from '../../src/build/city.js';
import { layoutCity } from '../../src/layout/treemap.js';
import { buildLive } from '../../src/live/paste.js';
import { dataVersionFor } from '../../src/mc.js';
import { fixture } from '../helpers.js';
// @ts-expect-error untyped helper module
import { PAPER_DIR } from './paper.mjs';
import { sampleBlocks } from './sample.js';
import { checkBlocks, MC, withServer } from './server.js';

const city = await analyze(fixture('town'), { sinceDays: 365 });
const built = buildCity(city, layoutCity(city));
const at: [number, number, number] = [32, -61, 32];
const expectations = sampleBlocks(built.grid, at, 60, ['minecraft:soul_fire', 'minecraft:oak_sign[rotation=0,waterlogged=false]']);
const password = process.env.E2E_RCON_PW ?? 'e2e-live-' + Math.random().toString(36).slice(2);
process.env.E2E_FORCE_PW = password;

const failures = await withServer({}, async ({ run, password: pw }) => {
  const res = await buildLive(built.grid, { host: '127.0.0.1', port: 25575, password: pw, worldDir: join(PAPER_DIR, 'world'), at, dataVersion: dataVersionFor(MC), runId: 'e2e', log: console.log });
  console.log(`placed ${res.tiles} tiles, ${res.blocks} blocks, ${res.failed.length} failed`);
  for (const f of res.failed) console.log('  ✗', f);
  console.log((await run(`forceload add ${at[0]} ${at[2]} ${at[0] + built.grid.width} ${at[2] + built.grid.length}`)).trim());
  await new Promise((r) => setTimeout(r, 1500));
  return res.failed.length + (await checkBlocks(run, expectations));
});
console.log(failures ? `FAILED: ${failures} problems` : `live build verified: all ${expectations.length} block checks passed`);
process.exit(failures ? 1 : 0);
