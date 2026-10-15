import { byCodeUnit } from '../scan/walk.js';
import type { Lang } from '../scan/langs.js';
import { files, type CityTree, type DirNode, type FileNode, type Node } from './city.js';

function count(node: Node): number {
  if (node.kind === 'file') return 1;
  let n = 0;
  for (const c of node.children) n += count(c);
  return n;
}

function mergeDir(dir: DirNode): FileNode {
  const all = [...files(dir)];
  const langLoc = new Map<Lang, number>();
  let loc = 0, todos = 0, churn = 0;
  let last: number | null = null;
  for (const f of all) {
    loc += f.loc;
    todos += f.todos;
    churn += f.churn;
    if (f.lastTouched !== null && (last === null || f.lastTouched > last)) last = f.lastTouched;
    langLoc.set(f.lang, (langLoc.get(f.lang) ?? 0) + f.loc);
  }
  const lang = [...langLoc.entries()].sort((a, b) => b[1] - a[1] || byCodeUnit(a[0], b[0]))[0]?.[0] ?? 'other';
  return {
    kind: 'file',
    name: dir.name,
    path: dir.path,
    lang,
    loc,
    todos,
    churn,
    lastTouched: last,
    isTest: all.length > 0 && all.every((f) => f.isTest),
    isDoc: all.length > 0 && all.every((f) => f.isDoc),
    merged: all.reduce((n, f) => n + (f.merged ?? 1), 0),
  };
}

/**
 * Merges folders bottom-up into single tower buildings until the city has at
 * most `maxBuildings` buildings. Deepest folders go first; among equals the
 * folder with the most files, then by path. The input tree is not mutated.
 */
export function applyLod(city: CityTree, maxBuildings: number): CityTree {
  let total = count(city.root);
  if (total <= maxBuildings) return city;
  const root = structuredClone(city.root);

  while (total > maxBuildings) {
    // Leaf folders: folders whose children are all files.
    const leaves: Array<{ parent: DirNode; index: number; dir: DirNode; depth: number; n: number }> = [];
    const visit = (dir: DirNode, depth: number) => {
      dir.children.forEach((c, index) => {
        if (c.kind !== 'dir') return;
        if (c.children.every((g) => g.kind === 'file')) leaves.push({ parent: dir, index, dir: c, depth: depth + 1, n: c.children.length });
        else visit(c, depth + 1);
      });
    };
    visit(root, 0);
    if (leaves.length === 0) break;
    const maxDepth = Math.max(...leaves.map((l) => l.depth));
    const level = leaves
      .filter((l) => l.depth === maxDepth)
      .sort((a, b) => b.n - a.n || byCodeUnit(a.dir.path, b.dir.path));
    for (const l of level) {
      if (total <= maxBuildings) break;
      l.parent.children[l.index] = mergeDir(l.dir);
      total -= l.n - 1;
    }
  }
  return { ...city, root };
}
