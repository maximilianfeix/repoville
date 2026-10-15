import { basename, resolve } from 'node:path';
import { readHistory } from './history/gitlog.js';
import { CITY_TREE_VERSION, type CityTree, type DirNode, type FileNode } from './model/city.js';
import type { Lang } from './scan/langs.js';
import { byCodeUnit, walk, type WalkOptions } from './scan/walk.js';

export interface AnalyzeOptions extends WalkOptions {
  sinceDays: number;
  name?: string;
}

function sortTree(dir: DirNode): void {
  dir.children.sort((a, b) => byCodeUnit(a.name, b.name));
  for (const c of dir.children) if (c.kind === 'dir') sortTree(c);
}

export async function analyze(root: string, opts: AnalyzeOptions): Promise<CityTree> {
  const abs = resolve(root);
  const [scanned, history] = await Promise.all([walk(abs, opts), readHistory(abs, { sinceDays: opts.sinceDays })]);

  const headTime = history.available
    ? history.headTime
    : scanned.reduce((m, f) => Math.max(m, f.mtime), 0);

  const churnOf = (path: string) => ({ churn: history.dirChurn.get(path) ?? 0, directChurn: history.dirDirectChurn.get(path) ?? 0 });
  const rootNode: DirNode = { kind: 'dir', name: opts.name ?? basename(abs), path: '', ...churnOf(''), children: [] };
  const dirIndex = new Map<string, DirNode>([['', rootNode]]);
  const dirFor = (path: string): DirNode => {
    const existing = dirIndex.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf('/');
    const parent = dirFor(slash === -1 ? '' : path.slice(0, slash));
    const node: DirNode = { kind: 'dir', name: path.slice(slash + 1), path, ...churnOf(path), children: [] };
    parent.children.push(node);
    dirIndex.set(path, node);
    return node;
  };

  let loc = 0;
  let todos = 0;
  const langLoc = new Map<Lang, number>();
  for (const f of scanned) {
    const slash = f.path.lastIndexOf('/');
    const h = history.files.get(f.path);
    const node: FileNode = {
      kind: 'file',
      name: f.path.slice(slash + 1),
      path: f.path,
      lang: f.lang,
      loc: f.loc,
      todos: f.todos,
      churn: h?.churn ?? 0,
      // Untracked files are brand new; tracked files missing from the log are older than the window.
      lastTouched: !history.available ? f.mtime : !f.tracked ? headTime : (h?.lastTouched ?? null),
      isTest: f.isTest,
      isDoc: f.isDoc,
    };
    dirFor(slash === -1 ? '' : f.path.slice(0, slash)).children.push(node);
    loc += f.loc;
    todos += f.todos;
    langLoc.set(f.lang, (langLoc.get(f.lang) ?? 0) + f.loc);
  }
  sortTree(rootNode);

  const languages = [...langLoc.entries()]
    .map(([lang, l]) => ({ lang, loc: l }))
    .sort((a, b) => b.loc - a.loc || byCodeUnit(a.lang, b.lang));

  return {
    version: CITY_TREE_VERSION,
    name: rootNode.name,
    head: history.head,
    headTime,
    sinceDays: opts.sinceDays,
    historyAvailable: history.available,
    root: rootNode,
    stats: { files: scanned.length, dirs: dirIndex.size, loc, todos, commits: history.commits, languages },
  };
}
