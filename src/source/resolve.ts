import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { hasGit, run } from '../util/exec.js';

export interface ResolvedSource {
  dir: string;
  /** Display name, e.g. "facebook/react" or the folder name. */
  name: string;
  owner?: string;
  repo?: string;
  remote: boolean;
}

const SHORTHAND = /^([A-Za-z0-9][\w.-]*)\/([\w.-]+?)(?:\.git)?$/;
const GITHUB_URL = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

export function cacheRoot(): string {
  if (process.env.REPOVILLE_CACHE) return process.env.REPOVILLE_CACHE;
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'repoville', 'Cache');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'repoville');
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'repoville');
}

export interface ParsedTarget {
  kind: 'local' | 'remote';
  path?: string;
  url?: string;
  owner?: string;
  repo?: string;
}

export function parseTarget(target: string, cwd = process.cwd()): ParsedTarget {
  const local = resolve(cwd, target);
  if (existsSync(local) && statSync(local).isDirectory()) return { kind: 'local', path: local };
  const gh = GITHUB_URL.exec(target);
  if (gh) return { kind: 'remote', url: `https://github.com/${gh[1]}/${gh[2]}.git`, owner: gh[1], repo: gh[2] };
  if (/^(https?|ssh|git):\/\//.test(target) || /^[\w.-]+@[\w.-]+:/.test(target)) {
    const name = target.replace(/\/$/, '').replace(/\.git$/, '').split(/[/:]/).pop() ?? 'repo';
    return { kind: 'remote', url: target, repo: name };
  }
  const short = SHORTHAND.exec(target);
  if (short) return { kind: 'remote', url: `https://github.com/${short[1]}/${short[2]}.git`, owner: short[1], repo: short[2] };
  throw new Error(`Not a folder, owner/repo or git URL: ${target}`);
}

export interface ResolveOptions {
  ref?: string;
  refresh?: boolean;
  log?: (msg: string) => void;
}

async function git(args: string[], cwd: string): Promise<void> {
  const res = await run('git', ['-c', 'core.longpaths=true', ...args], cwd);
  if (res.code !== 0) throw new Error(`git ${args[0]} failed: ${res.stderr.trim() || res.stdout.trim()}`);
}

export async function resolveSource(target: string, opts: ResolveOptions = {}): Promise<ResolvedSource> {
  const parsed = parseTarget(target);
  if (parsed.kind === 'local') {
    const name = parsed.path!.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'repo';
    return { dir: parsed.path!, name, remote: false };
  }
  if (!(await hasGit(process.cwd()))) throw new Error('Cloning a remote repo needs git on PATH. Clone it yourself and pass the folder instead.');

  const slug = [parsed.owner, parsed.repo].filter(Boolean).join('__').replace(/[^\w.-]/g, '_');
  const dir = join(cacheRoot(), 'repos', slug);
  const log = opts.log ?? (() => {});
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(join(cacheRoot(), 'repos'), { recursive: true });
    log(`cloning ${parsed.url} (blobless) into ${dir}`);
    await git(['clone', '--filter=blob:none', '--no-tags', '--single-branch', parsed.url!, dir], cacheRoot());
  } else if (opts.refresh) {
    log(`updating ${dir}`);
    await git(['fetch', '--filter=blob:none', 'origin'], dir);
    await git(['reset', '--hard', '-q', 'FETCH_HEAD'], dir);
  }
  if (opts.ref) {
    const has = await run('git', ['cat-file', '-e', `${opts.ref}^{commit}`], dir);
    if (has.code !== 0) await git(['fetch', '--filter=blob:none', 'origin', opts.ref], dir);
    await git(['checkout', '-q', '--detach', opts.ref], dir);
  }
  const name = parsed.owner ? `${parsed.owner}/${parsed.repo}` : (parsed.repo ?? 'repo');
  return { dir, name, owner: parsed.owner, repo: parsed.repo, remote: true };
}
