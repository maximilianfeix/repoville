import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command, Option } from 'commander';
import { analyze } from './analyze.js';
import { badgeMarkdown } from './badge.js';
import { DEFAULTS, parseFormats, readConfigFile, type RenderConfig } from './config.js';
import { DEFAULT_MC } from './mc.js';
import { render } from './render.js';
import { resolveSource } from './source/resolve.js';
import { formatHighlights } from './summary.js';
import { parseDays } from './util/duration.js';

const VERSION = process.env.REPOVILLE_VERSION ?? '0.0.0-dev';

const program = new Command();
program
  .name('repoville')
  .description('Walk your codebase. Turn any Git repo into a walkable Minecraft city.')
  .version(VERSION);

const collect = (v: string, prev: string[]) => [...prev, ...v.split(',').map((s) => s.trim()).filter(Boolean)];

program
  .command('build', { isDefault: true })
  .description('analyze a repo and render the city')
  .argument('[target]', 'folder, owner/repo or git URL', '.')
  .option('-o, --out <dir>', 'output folder', DEFAULTS.out)
  .option('--format <list>', 'comma list: html,schem,litematic,world,json', DEFAULTS.formats.join(','))
  .option('--mc <version>', 'target Minecraft Java version', DEFAULT_MC)
  .option('--max-buildings <n>', 'merge folders into towers above this many buildings', String(DEFAULTS.maxBuildings))
  .option('--since <duration>', 'churn window (30d, 6m, 1y)', DEFAULTS.since)
  .option('--include <glob>', 'only these paths (repeatable)', collect, [])
  .option('--exclude <glob>', 'skip these paths (repeatable)', collect, [])
  .option('--seed <n>', 'seed for decorations', '0')
  .option('--textured', 'viewer fetches Minecraft textures at runtime (opt-in)')
  .option('--open', 'open the 3D preview when done')
  .option('--gallery', 'also write gallery/<owner>-<repo>/ for a gallery PR')
  .addOption(new Option('--ref <commit>', 'render this commit of a remote repo'))
  .addOption(new Option('--refresh', 'fetch the latest commit for a cached remote repo'))
  .action(async (target: string, o: Record<string, string | boolean | string[] | undefined>) => {
    const t0 = performance.now();
    const log = (m: string) => console.error(`  ${m}`);
    const sinceDays = parseDays(String(o.since));
    const src = await resolveSource(target, { ref: o.ref as string | undefined, refresh: Boolean(o.refresh), historyDays: Math.max(sinceDays, 3 * 365), log });
    const fileCfg = readConfigFile(src.dir);
    const explicit = (k: string) => program.commands[0]!.getOptionValueSource(k) === 'cli';
    const pick = <K extends keyof RenderConfig>(key: K, cli: RenderConfig[K], optName = key as string): RenderConfig[K] =>
      explicit(optName) ? cli : ((fileCfg[key] as RenderConfig[K] | undefined) ?? cli);
    const cfg: RenderConfig = {
      out: resolve(pick('out', String(o.out))),
      formats: pick('formats', parseFormats(String(o.format)), 'format'),
      mc: pick('mc', String(o.mc)),
      maxBuildings: Number(pick('maxBuildings', Number(o.maxBuildings))),
      since: pick('since', String(o.since)),
      include: [...(fileCfg.include ?? []), ...(o.include as string[])],
      exclude: [...(fileCfg.exclude ?? []), ...(o.exclude as string[])],
      ignore: fileCfg.ignore ?? [],
      seed: Number(pick('seed', Number(o.seed))),
      textured: Boolean(o.textured ?? fileCfg.textured),
      open: Boolean(o.open ?? fileCfg.open),
      gallery: Boolean(o.gallery ?? fileCfg.gallery),
      palette: fileCfg.palette,
    };
    if (!Number.isInteger(cfg.maxBuildings) || cfg.maxBuildings < 1) throw new Error('--max-buildings must be a positive integer');

    console.error(`repoville: building ${src.name}`);
    const res = await render(src, cfg, log);
    const s = res.city.stats;
    console.error(`  ${s.files} files · ${s.loc.toLocaleString('en-US')} LOC · ${s.commits} commits · ${res.built.buildings.length} buildings on ${res.layout.width}×${res.layout.length} blocks`);
    for (const line of formatHighlights(res.highlights, cfg.since)) console.error(`  ${line}`);
    for (const out of res.outputs) console.error(`  wrote ${out.format.padEnd(9)} ${out.file}`);
    console.error(`  done in ${((performance.now() - t0) / 1000).toFixed(1)} s · analysis ran locally, nothing was uploaded`);
    console.error('');
    console.error('Add this badge to your README:');
    console.log(badgeMarkdown(src.owner, src.repo));
  });

program
  .command('badge')
  .description('print the README badge for a GitHub repo')
  .argument('[owner/repo]', 'GitHub repo; defaults to the origin remote of the current folder')
  .action(async (slug?: string) => {
    let owner: string | undefined;
    let repo: string | undefined;
    if (slug) [owner, repo] = slug.split('/');
    else {
      const { run } = await import('./util/exec.js');
      const url = (await run('git', ['remote', 'get-url', 'origin'], process.cwd()).catch(() => ({ stdout: '' }))).stdout.trim();
      const m = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url);
      if (m) [owner, repo] = [m[1], m[2]];
    }
    console.log(badgeMarkdown(owner, repo));
  });

program
  .command('analyze', { hidden: true })
  .argument('<target>', 'folder, owner/repo or git URL')
  .option('--since <duration>', 'churn window', '1y')
  .option('--ref <commit>', 'check out this commit of a remote repo')
  .option('--json <file>', 'write the city tree here instead of stdout')
  .action(async (target: string, o: { since: string; ref?: string; json?: string }) => {
    const t0 = performance.now();
    const sinceDays = parseDays(o.since);
    const src = await resolveSource(target, { ref: o.ref, historyDays: Math.max(sinceDays, 3 * 365), log: (m) => console.error(m) });
    const city = await analyze(src.dir, { sinceDays, name: src.name });
    const json = JSON.stringify(city);
    if (o.json) writeFileSync(o.json, json);
    else process.stdout.write(json + '\n');
    console.error(`analyzed ${city.stats.files} files, ${city.stats.loc} LOC, ${city.stats.commits} commits in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  });

program.parseAsync().catch((err: unknown) => {
  console.error(`repoville: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
