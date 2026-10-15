import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { analyze } from './analyze.js';
import { resolveSource } from './source/resolve.js';
import { parseDays } from './util/duration.js';

const program = new Command();
program.name('repoville').description('Walk your codebase. Turn any Git repo into a walkable Minecraft city.');

program
  .command('analyze', { hidden: true })
  .argument('<target>', 'folder, owner/repo or git URL')
  .option('--since <duration>', 'churn window', '1y')
  .option('--ref <commit>', 'check out this commit of a remote repo')
  .option('--json <file>', 'write the city tree here instead of stdout')
  .action(async (target: string, o: { since: string; ref?: string; json?: string }) => {
    const t0 = performance.now();
    const src = await resolveSource(target, { ref: o.ref, log: (m) => console.error(m) });
    const city = await analyze(src.dir, { sinceDays: parseDays(o.since), name: src.name });
    const json = JSON.stringify(city);
    if (o.json) writeFileSync(o.json, json);
    else process.stdout.write(json + '\n');
    console.error(`analyzed ${city.stats.files} files, ${city.stats.loc} LOC, ${city.stats.commits} commits in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  });

program.parseAsync().catch((err: unknown) => {
  console.error(`repoville: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
