import { spawn } from 'node:child_process';
import { buildingHeight } from '../layout/treemap.js';

/**
 * Line counts over time from one `git log --numstat --reverse` pass.
 * numstat counts all lines (not only non-blank), so heights are scaled so the
 * last frame matches the real building height; earlier frames keep the ratio.
 */
export interface TimelineInput {
  /** Building path; for merged towers every file below it counts. */
  path: string;
  merged: boolean;
  /** Real wall height of the building today. */
  height: number;
}

export interface Timeline {
  /** Commit time (epoch s) of each frame. */
  times: number[];
  /** frames × buildings wall heights (0 = not built yet), row-major by frame. */
  heights: Uint8Array;
}

const RS = '\x1e';

export async function readTimeline(root: string, buildings: TimelineInput[], frames = 48): Promise<Timeline | null> {
  // Pass 1 (cheap): commit times, to place the frames evenly in time.
  const times: number[] = [];
  await streamGit(root, ['log', '--reverse', '--format=%ct', 'HEAD'], (chunk) => {
    for (const line of chunk.split('\n')) if (line) times.push(Number(line));
  });
  if (times.length < 2) return null;
  const t0 = times[0]!;
  const t1 = times[times.length - 1]!;
  const frameTimes = Array.from({ length: frames }, (_, i) => Math.round(t0 + ((t1 - t0) * (i + 1)) / frames));

  // Map file paths to building indices (exact path, or the merged tower above it).
  const exact = new Map<string, number>();
  const towers = new Map<string, number>();
  buildings.forEach((b, i) => (b.merged ? towers : exact).set(b.path, i));
  const owner = (path: string): number => {
    const e = exact.get(path);
    if (e !== undefined) return e;
    for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
      const t = towers.get(path.slice(0, cut));
      if (t !== undefined) return t;
    }
    return -1;
  };

  const lines = new Float64Array(buildings.length);
  const fileLines = new Map<string, number>();
  const snapshots: Float64Array[] = [];
  let next = 0;
  let commitTime = t0;
  const snapshotUpTo = (t: number) => {
    while (next < frameTimes.length && frameTimes[next]! < t) {
      snapshots.push(lines.slice());
      next++;
    }
  };

  // Pass 2: numstat deltas, oldest first.
  let buf = '';
  const handle = (line: string) => {
    if (line.startsWith(RS)) {
      commitTime = Number(line.slice(1));
      snapshotUpTo(commitTime);
      return;
    }
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m || m[1] === '-') return;
    const path = m[3]!;
    const i = owner(path);
    if (i < 0) return;
    const delta = Number(m[1]) - Number(m[2]);
    const before = fileLines.get(path) ?? 0;
    const after = Math.max(0, before + delta);
    fileLines.set(path, after);
    lines[i] = Math.max(0, lines[i]! + (after - before));
  };
  await streamGit(root, ['-c', 'core.quotepath=off', 'log', '--reverse', '--numstat', '--no-renames', `--format=${RS}%ct`, 'HEAD'], (chunk) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      handle(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  });
  if (buf) handle(buf);
  while (snapshots.length < frames) snapshots.push(lines.slice());

  const final = snapshots[snapshots.length - 1]!;
  const heights = new Uint8Array(frames * buildings.length);
  snapshots.forEach((snap, f) => {
    for (let i = 0; i < buildings.length; i++) {
      const now = snap[i]!;
      if (now <= 0) continue;
      const end = final[i]! || now;
      // Scale against today's real height so the last frame lines up with the city.
      const h = Math.round(buildings[i]!.height * Math.min(1.5, buildingHeight(now) / Math.max(1, buildingHeight(end))));
      heights[f * buildings.length + i] = Math.max(1, Math.min(255, h));
    }
  });
  return { times: frameTimes, heights };
}

function streamGit(cwd: string, args: string[], onData: (s: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, shell: false, windowsHide: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`git ${args[args.length - 2]} exited with ${code}`))));
  });
}
