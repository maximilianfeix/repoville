// E2E: render the town fixture as a world zip, load it as the server world on Paper, verify blocks.
// Usage: npx tsx test/e2e/world-load.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { DEFAULTS } from '../../src/config.js';
import { render } from '../../src/render.js';
import { WORLD_GROUND_Y } from '../../src/write/world.js';
import { fixture } from '../helpers.js';
// @ts-expect-error untyped helper module
import { PAPER_DIR } from './paper.mjs';
import { sampleBlocks } from './sample.js';
import { checkBlocks, MC, withServer } from './server.js';

const out = mkdtempSync(join(tmpdir(), 'rv-world-'));
const res = await render({ dir: fixture('town'), name: 'town', remote: false }, { ...DEFAULTS, out, formats: ['world'], mc: MC });
const zip = unzipSync(readFileSync(res.outputs[0]!.file));
const expectations = sampleBlocks(res.built.grid, [0, WORLD_GROUND_Y, 0], 60, ['minecraft:soul_fire', 'minecraft:oak_sign[rotation=0,waterlogged=false]', 'minecraft:spruce_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]']);

const failures = await withServer(
  {
    freshWorld: false,
    before: () => {
      const world = join(PAPER_DIR, 'world');
      rmSync(world, { recursive: true, force: true });
      for (const [name, data] of Object.entries(zip)) {
        const rel = name.split('/').slice(1).join('/');
        if (!rel) continue;
        const dest = join(world, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, data);
      }
    },
  },
  async ({ run }) => {
    const g = res.built.grid;
    console.log((await run(`forceload add 0 0 ${g.width - 1} ${g.length - 1}`)).trim());
    await new Promise((r) => setTimeout(r, 3000));
    const sign = g.blockEntities[0]!;
    console.log((await run(`data get block ${sign.x} ${sign.y + WORLD_GROUND_Y} ${sign.z} front_text.messages`)).trim());
    return checkBlocks(run, expectations);
  },
);
console.log(failures ? `FAILED: ${failures}/${expectations.length} block checks` : `all ${expectations.length} block checks passed`);
process.exit(failures ? 1 : 0);
