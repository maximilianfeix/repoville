import { run } from '../util/exec.js';

export interface FileChange {
  status: 'added' | 'modified' | 'deleted';
  added: number;
  removed: number;
}

export interface RepoDiff {
  base: string;
  /** Resolved commit of the base (merge base with HEAD). */
  baseCommit: string;
  changes: Map<string, FileChange>;
}

/**
 * Changes between the merge base of `base` and HEAD, plus uncommitted work.
 * Renames are reported as delete + add so every path maps to one building.
 */
export async function readDiff(root: string, base: string): Promise<RepoDiff> {
  const mb = await run('git', ['merge-base', base, 'HEAD'], root);
  if (mb.code !== 0) throw new Error(`--diff: cannot find a merge base between "${base}" and HEAD: ${mb.stderr.trim()}`);
  const baseCommit = mb.stdout.trim();
  const status = await run('git', ['-c', 'core.quotepath=off', 'diff', '--no-renames', '--name-status', '-z', baseCommit], root);
  const numstat = await run('git', ['-c', 'core.quotepath=off', 'diff', '--no-renames', '--numstat', '-z', baseCommit], root);
  if (status.code !== 0 || numstat.code !== 0) throw new Error(`--diff: git diff failed: ${status.stderr || numstat.stderr}`);
  const changes = new Map<string, FileChange>();
  const st = status.stdout.split('\0');
  for (let i = 0; i + 1 < st.length; i += 2) {
    const code = st[i]!;
    const path = st[i + 1]!;
    if (!code) continue;
    changes.set(path, { status: code.startsWith('A') ? 'added' : code.startsWith('D') ? 'deleted' : 'modified', added: 0, removed: 0 });
  }
  for (const rec of numstat.stdout.split('\0')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(rec.replace(/^\n/, ''));
    if (!m) continue;
    const c = changes.get(m[3]!);
    if (c) {
      c.added = m[1] === '-' ? 0 : Number(m[1]);
      c.removed = m[2] === '-' ? 0 : Number(m[2]);
    }
  }
  return { base, baseCommit, changes };
}
