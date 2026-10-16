// E2E: render the town fixture to .schem, paste it with WorldEdit on Paper, verify blocks via `execute if block`.
// Usage: npx tsx test/e2e/worldedit-paste.ts [repo]
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS } from '../../src/config.js';
import { render } from '../../src/render.js';
import { fixture } from '../helpers.js';
// @ts-expect-error untyped helper module
import { PAPER_DIR } from './paper.mjs';
import { sampleBlocks } from './sample.js';
import { checkBlocks, MC, WORLDEDIT, withServer } from './server.js';

const out = mkdtempSync(join(tmpdir(), 'rv-e2e-'));
// Optional repo path argument (default: the town fixture), e.g. to cover new themes.
const dir = process.argv[2] ?? fixture('town');
const res = await render({ dir, name: 'town', remote: false }, { ...DEFAULTS, out, formats: ['schem'], mc: MC });
const schem = res.outputs[0]!.file;
const origin: [number, number, number] = [0, -60, 0];
const expectations = sampleBlocks(res.built.grid, origin, 60, process.argv[2] ? [] : ['minecraft:soul_fire', 'minecraft:oak_sign[rotation=0,waterlogged=false]', 'minecraft:spruce_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]', 'minecraft:cracked_stone_bricks', 'minecraft:campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]']);

const failures = await withServer(
  {
    plugins: [WORLDEDIT],
    before: () => {
      mkdirSync(join(PAPER_DIR, 'plugins', 'WorldEdit', 'schematics'), { recursive: true });
      copyFileSync(schem, join(PAPER_DIR, 'plugins', 'WorldEdit', 'schematics', 'repoville-e2e.schem'));
    },
  },
  async ({ run }) => {
    const g = res.built.grid;
    console.log((await run(`forceload add ${origin[0]} ${origin[2]} ${origin[0] + g.width - 1} ${origin[2] + g.length - 1}`)).trim());
    // The test world only has terrain under the old town area; give the paste solid ground.
    await run(`fill ${origin[0]} ${origin[1] - 1} ${origin[2]} ${origin[0] + g.width - 1} ${origin[1] - 1} ${origin[2] + g.length - 1} minecraft:stone`);
    await run('//world world');
    await run(`//pos1 ${origin.join(',')}`);
    const loaded = await run('/schem load repoville-e2e');
    // Loading runs asynchronously in WorldEdit 7.3; larger schematics need a moment before //paste.
    await new Promise((r) => setTimeout(r, 4000));
    const pasted = await run('//paste -a');
    console.log(`${loaded.trim()} ${pasted.trim()}`.replace(/§./g, '').replace(/\n/g, ' | '));
    // WorldEdit pastes asynchronously in batches; give it a moment before checking.
    await new Promise((r) => setTimeout(r, 2000));
    return checkBlocks(run, expectations);
  },
);
console.log(failures ? `FAILED: ${failures}/${expectations.length} block checks` : `all ${expectations.length} block checks passed`);
process.exit(failures ? 1 : 0);
