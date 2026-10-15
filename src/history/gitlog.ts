import { spawn } from 'node:child_process';
import { hasGit, run } from '../util/exec.js';

export interface FileHistory {
  /** Commits touching the file inside the churn window. */
  churn: number;
  /** Commit time (epoch seconds) of the newest commit touching the file, if inside the history window. */
  lastTouched: number;
}

export interface History {
  available: boolean;
  head: string | null;
  /** HEAD commit time; the reference "now" so output does not depend on the wall clock. */
  headTime: number;
  files: Map<string, FileHistory>;
  commits: number;
}

export interface HistoryOptions {
  /** Churn window in days. */
  sinceDays: number;
  /** Ages are only resolved this far back (default 3 years); older files have no lastTouched. */
  ageWindowDays?: number;
}

const RS = '\x1e';

export interface ParsedCommit {
  time: number;
  files: string[];
}

/**
 * Incremental parser for `git log -z --name-only --format=%x1e%H %ct`.
 * Records are NUL separated; a record starting with RS is a commit header.
 */
export function parseLogChunks(onCommit: (c: ParsedCommit) => void) {
  let buf = '';
  let current: ParsedCommit | null = null;

  const token = (raw: string) => {
    const t = raw.startsWith('\n') ? raw.slice(1) : raw;
    if (t.startsWith(RS)) {
      if (current) onCommit(current);
      const space = t.indexOf(' ');
      current = { time: Number(t.slice(space + 1)), files: [] };
    } else if (t.length > 0 && current) {
      current.files.push(t);
    }
  };

  return {
    push(chunk: string) {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf('\0')) !== -1) {
        token(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    },
    end() {
      if (buf.length) token(buf);
      buf = '';
      if (current) onCommit(current);
      current = null;
    },
  };
}

const DAY = 86400;

export async function readHistory(root: string, opts: HistoryOptions): Promise<History> {
  const empty: History = { available: false, head: null, headTime: 0, files: new Map(), commits: 0 };
  if (!(await hasGit(root))) return empty;
  const head = await run('git', ['log', '-1', '--format=%H %ct'], root);
  if (head.code !== 0 || !head.stdout.trim()) return empty;
  const [sha, ct] = head.stdout.trim().split(' ');
  const headTime = Number(ct);
  const ageDays = Math.max(opts.ageWindowDays ?? 3 * 365, opts.sinceDays);
  const churnFrom = headTime - opts.sinceDays * DAY;
  const historyFrom = headTime - ageDays * DAY;

  const files = new Map<string, FileHistory>();
  let commits = 0;
  const parser = parseLogChunks((c) => {
    commits++;
    for (const f of c.files) {
      let h = files.get(f);
      if (!h) {
        h = { churn: 0, lastTouched: c.time };
        files.set(f, h);
      } else if (c.time > h.lastTouched) {
        h.lastTouched = c.time;
      }
      if (c.time >= churnFrom) h.churn++;
    }
  });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'git',
      ['-c', 'core.quotepath=off', 'log', '-z', '--name-only', '--no-renames', `--format=${RS}%H %ct`, `--since=${new Date(historyFrom * 1000).toISOString()}`, 'HEAD'],
      { cwd: root, shell: false, windowsHide: true },
    );
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d: string) => parser.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      parser.end();
      code === 0 ? resolve() : reject(new Error(`git log exited with ${code}`));
    });
  });

  return { available: true, head: sha ?? null, headTime, files, commits };
}
