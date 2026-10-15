import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
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
const SCP = /^([\w.-]+)@([\w.-]+):([\w./-]+?)(?:\.git)?\/?$/;
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

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
  /** Canonical identity (host/path) used for the cache key. */
  id?: string;
}

function remoteFrom(host: string, path: string, url: string): ParsedTarget {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => p === '..' || p === '.')) throw new Error(`Not a repository URL: ${url}`);
  const h = host.toLowerCase();
  if (GITHUB_HOSTS.has(h) && parts.length === 2) {
    return { kind: 'remote', url: `https://github.com/${parts[0]}/${parts[1]}.git`, owner: parts[0], repo: parts[1], id: `github.com/${parts[0]}/${parts[1]}`.toLowerCase() };
  }
  return { kind: 'remote', url, repo: parts[parts.length - 1], id: `${h}/${clean}`.toLowerCase() };
}

export function parseTarget(target: string, cwd = process.cwd()): ParsedTarget {
  const local = resolve(cwd, target);
  if (existsSync(local) && statSync(local).isDirectory()) return { kind: 'local', path: local };
  if (/^(https?|ssh|git):\/\//.test(target)) {
    let u: URL;
    try {
      u = new URL(target);
    } catch {
      throw new Error(`Not a valid git URL: ${target}`);
    }
    return remoteFrom(u.hostname, u.pathname, target);
  }
  const scp = SCP.exec(target);
  if (scp) return remoteFrom(scp[2]!, scp[3]!, target);
  const short = SHORTHAND.exec(target);
  if (short) return remoteFrom('github.com', `${short[1]}/${short[2]}`, target);
  throw new Error(`Not a folder, owner/repo or git URL: ${target}`);
}

export interface ResolveOptions {
  ref?: string;
  /** Only fetch history this many days back (plus a margin). Omit for full history. */
  historyDays?: number;
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

  // Cache key: readable prefix + hash of the canonical identity, so different
  // hosts or owners never share a checkout. A --ref gets its own checkout.
  const identity = parsed.id ?? parsed.url!;
  const readable = (parsed.owner ? `${parsed.owner}__${parsed.repo}` : `${parsed.repo}`).replace(/[^\w.-]/g, '_');
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 10);
  const refSuffix = opts.ref ? `@${opts.ref.replace(/[^\w.-]/g, '_').slice(0, 40)}` : '';
  const dir = join(cacheRoot(), 'repos', `${readable}-${hash}${refSuffix}`);
  const log = opts.log ?? (() => {});
  // One-time migration from the old cache naming (<owner>__<repo>) when the origin matches.
  const legacy = join(cacheRoot(), 'repos', readable);
  if (!opts.ref && !existsSync(join(dir, '.git')) && existsSync(join(legacy, '.git'))) {
    const origin = (await run('git', ['remote', 'get-url', 'origin'], legacy)).stdout.trim();
    if (origin === parsed.url) renameSync(legacy, dir);
  }
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(join(cacheRoot(), 'repos'), { recursive: true });
    log(`cloning ${parsed.url} (blobless) into ${dir}`);
    const base = ['clone', '--filter=blob:none', '--no-tags', '--single-branch'];
    if (opts.historyDays && !opts.ref) {
      const since = new Date(Date.now() - (opts.historyDays + 30) * 86400_000).toISOString().slice(0, 10);
      try {
        await git([...base, `--shallow-since=${since}`, parsed.url!, dir], cacheRoot());
      } catch {
        // Repos without commits after the cutoff reject --shallow-since; take everything.
        await rm(dir, { recursive: true, force: true });
        await git([...base, parsed.url!, dir], cacheRoot());
      }
    } else {
      await git([...base, parsed.url!, dir], cacheRoot());
    }
  } else {
    // Never reuse a checkout of a different remote.
    const origin = (await run('git', ['remote', 'get-url', 'origin'], dir)).stdout.trim();
    if (origin !== parsed.url) throw new Error(`Cache ${dir} belongs to ${origin}, not ${parsed.url}. Delete it and retry.`);
  }
  if (existsSync(join(dir, '.git')) && opts.refresh) {
    log(`updating ${dir}`);
    await git(['fetch', '--filter=blob:none', 'origin'], dir);
    await git(['reset', '--hard', '-q', 'FETCH_HEAD'], dir);
  }
  if (opts.ref) {
    const has = await run('git', ['cat-file', '-e', `${opts.ref}^{commit}`], dir);
    if (has.code !== 0) await git(['fetch', '--filter=blob:none', '--unshallow', 'origin', opts.ref], dir).catch(() => git(['fetch', '--filter=blob:none', 'origin', opts.ref!], dir));
    await git(['checkout', '-q', '--detach', opts.ref], dir);
  }
  const name = parsed.owner ? `${parsed.owner}/${parsed.repo}` : (parsed.repo ?? 'repo');
  return { dir, name, owner: parsed.owner, repo: parsed.repo, remote: true };
}
