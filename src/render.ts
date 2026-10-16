import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from './analyze.js';
import { buildCity, type BuiltCity } from './build/city.js';
import { withOverrides } from './build/palette.js';
import type { RenderConfig } from './config.js';
import { layoutCity, type CityLayout } from './layout/treemap.js';
import { dataVersionFor } from './mc.js';
import { applyLod } from './model/lod.js';
import { files, type CityTree } from './model/city.js';
import { webBaseFor, type ResolvedSource } from './source/resolve.js';
import { highlights, type Highlights } from './summary.js';
import { parseDays } from './util/duration.js';
import { writeLitematic } from './write/litematic.js';
import { writeWorldZip } from './write/world.js';
import { renderThumbnail } from './write/thumbnail.js';
import { writeSchem } from './write/schem.js';
import { writeHtml } from './write/html.js';
import { badgeMarkdown, SITE } from './badge.js';

export interface RenderResult {
  city: CityTree;
  layout: CityLayout;
  built: BuiltCity;
  highlights: Highlights;
  outputs: Array<{ format: string; file: string; bytes?: number }>;
  timings: Record<string, number>;
}

export function slugOf(name: string): string {
  return name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'city';
}

export async function render(src: ResolvedSource, cfg: RenderConfig, log: (m: string) => void = () => {}): Promise<RenderResult> {
  const timings: Record<string, number> = {};
  let t = performance.now();
  const lap = (k: string) => {
    const now = performance.now();
    timings[k] = Math.round(now - t);
    t = now;
  };
  const sinceDays = parseDays(cfg.since);
  const dataVersion = dataVersionFor(cfg.mc);

  const full = await analyze(src.dir, { sinceDays, name: src.name, include: cfg.include, exclude: cfg.exclude, ignore: cfg.ignore });
  lap('analyze');
  if (full.stats.files === 0) throw new Error('No source files found (everything ignored, binary, or larger than 1 MB).');
  const city = applyLod(full, cfg.maxBuildings);
  const merged = full.stats.files - [...files(city.root)].length;
  if (merged > 0) log(`merged ${merged} files into folder towers to stay under ${cfg.maxBuildings} buildings`);
  const remaining = full.stats.files - merged;
  if (remaining > cfg.maxBuildings) log(`note: ${remaining} files sit directly in the root, more than --max-buildings ${cfg.maxBuildings}; rendering them all`);
  const layout = layoutCity(city);
  lap('layout');
  const built = buildCity(city, layout, { seed: cfg.seed, palettes: withOverrides(cfg.palette) });
  lap('voxelize');

  mkdirSync(cfg.out, { recursive: true });
  const base = slugOf(src.name);
  const outputs: RenderResult['outputs'] = [];
  const meta = { name: src.name, author: 'repoville', date: city.headTime * 1000, dataVersion };

  for (const format of cfg.formats) {
    if (format === 'html') {
      const file = join(cfg.out, `${base}.html`);
      const bytes = writeHtml(file, {
        city, built, highlights: highlights(city, built.buildings, built.districts), since: cfg.since,
        generator: `repoville ${process.env.REPOVILLE_VERSION ?? 'dev'}`, site: SITE, badge: badgeMarkdown(src.owner, src.repo), textured: cfg.textured,
        source: webBaseFor(src.url),
        full,
      });
      outputs.push({ format, file, bytes });
    } else if (format === 'schem') {
      const file = join(cfg.out, `${base}.schem`);
      await writeSchem(file, built.grid, meta);
      outputs.push({ format, file });
    } else if (format === 'litematic') {
      const file = join(cfg.out, `${base}.litematic`);
      await writeLitematic(file, built.grid, meta);
      outputs.push({ format, file });
    } else if (format === 'world') {
      const file = join(cfg.out, `${base}-world.zip`);
      writeWorldZip(file, built.grid, { name: `Repoville ${src.name}`, dataVersion, mcVersion: cfg.mc, date: city.headTime * 1000 });
      outputs.push({ format, file });
    } else if (format === 'json') {
      const file = join(cfg.out, `${base}.city.json`);
      writeFileSync(file, JSON.stringify(full));
      outputs.push({ format, file });
    } else {
      log(`format "${format}" is not available yet, skipped`);
      continue;
    }
    lap(format);
  }

  if (cfg.gallery) {
    const dir = join(cfg.out, 'gallery', base);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'city.png'), renderThumbnail(built.grid));
    const h = highlights(city, built.buildings, built.districts);
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({
      repo: src.name, head: city.head, files: city.stats.files, loc: city.stats.loc, commits: city.stats.commits,
      buildings: built.buildings.length, size: [layout.width, layout.length], since: cfg.since, highlights: h,
    }, null, 2) + '\n');
    outputs.push({ format: 'gallery', file: dir });
    lap('gallery');
  }

  return { city, layout, built, highlights: highlights(city, built.buildings, built.districts), outputs, timings };
}
