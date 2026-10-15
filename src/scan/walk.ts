import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import ignore from 'ignore';
import { glob } from 'tinyglobby';
import { hasGit, run } from '../util/exec.js';
import { classify, type Lang } from './langs.js';
import { countSource } from './loc.js';

export interface ScannedFile {
  path: string;
  lang: Lang;
  loc: number;
  lines: number;
  todos: number;
  isTest: boolean;
  isDoc: boolean;
  mtime: number;
  /** False for files git does not track yet (untracked but not ignored). */
  tracked: boolean;
}

export interface WalkOptions {
  include?: string[];
  exclude?: string[];
  ignore?: string[];
  maxFileBytes?: number;
}

const ALWAYS_SKIP = ['node_modules/', 'dist/', '.git/', 'vendor/', 'bower_components/', '.next/', '.nuxt/', 'target/debug/', 'target/release/', '__pycache__/'];
const MAX_BYTES = 1024 * 1024;

export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function listWithGit(root: string): Promise<{ paths: string[]; untracked: Set<string> } | null> {
  if (!(await hasGit(root))) return null;
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], root);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return null;
  const res = await run('git', ['-c', 'core.quotepath=off', 'ls-files', '-z', '-t', '--cached', '--others', '--exclude-standard'], root);
  if (res.code !== 0) return null;
  const paths: string[] = [];
  const untracked = new Set<string>();
  for (const entry of res.stdout.split('\0')) {
    if (entry.length < 3) continue;
    const path = entry.slice(2);
    paths.push(path);
    if (entry[0] === '?') untracked.add(path);
  }
  return { paths, untracked };
}

async function listWithGlob(root: string): Promise<string[]> {
  const ig = ignore();
  try {
    ig.add(await readFile(join(root, '.gitignore'), 'utf8'));
  } catch {
    // no .gitignore
  }
  const all = await glob('**/*', { cwd: root, dot: true, onlyFiles: true, ignore: ['**/.git/**', '**/node_modules/**'] });
  return all.filter((p) => !ig.ignores(p));
}

function skipped(path: string): boolean {
  const withSlash = '/' + path;
  return ALWAYS_SKIP.some((d) => path.startsWith(d) || withSlash.includes('/' + d));
}

export async function walk(root: string, opts: WalkOptions = {}): Promise<ScannedFile[]> {
  const fromGit = await listWithGit(root);
  const listed = fromGit?.paths ?? (await listWithGlob(root));
  const untracked = fromGit?.untracked ?? new Set<string>();
  let paths = listed.map((p) => p.replaceAll('\\', '/')).filter((p) => !skipped(p));

  if (opts.include?.length || opts.exclude?.length || opts.ignore?.length) {
    const filter = (patterns: string[]) => ignore().add(patterns);
    if (opts.include?.length) {
      const inc = filter(opts.include);
      paths = paths.filter((p) => inc.ignores(p));
    }
    const excl = [...(opts.exclude ?? []), ...(opts.ignore ?? [])];
    if (excl.length) {
      const exc = filter(excl);
      paths = paths.filter((p) => !exc.ignores(p));
    }
  }

  paths = [...new Set(paths)].sort(byCodeUnit);
  const maxBytes = opts.maxFileBytes ?? MAX_BYTES;
  const out: ScannedFile[] = [];
  const CONCURRENCY = 64;
  let next = 0;
  const results: Array<ScannedFile | null> = new Array(paths.length).fill(null);

  async function worker() {
    while (next < paths.length) {
      const i = next++;
      const path = paths[i]!;
      const cls = classify(path);
      if (cls.lockfile) continue;
      const full = join(root, path);
      let st;
      try {
        st = await stat(full);
      } catch {
        continue; // deleted in the working tree or a broken symlink
      }
      if (!st.isFile() || st.size > maxBytes) continue;
      const counted = countSource(await readFile(full));
      if (counted.binary) continue;
      results[i] = {
        path,
        lang: cls.lang,
        loc: counted.loc,
        lines: counted.lines,
        todos: counted.todos,
        isTest: cls.isTest,
        isDoc: cls.isDoc,
        mtime: Math.floor(st.mtimeMs / 1000),
        tracked: !untracked.has(path),
      };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  for (const r of results) if (r) out.push(r);
  return out;
}
