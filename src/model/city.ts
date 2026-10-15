import type { Lang } from '../scan/langs.js';

export const CITY_TREE_VERSION = 1;

export interface FileNode {
  kind: 'file';
  name: string;
  path: string;
  lang: Lang;
  loc: number;
  todos: number;
  churn: number;
  /** Epoch seconds of the last commit touching the file; null if older than the history window or unknown. */
  lastTouched: number | null;
  isTest: boolean;
  isDoc: boolean;
  /** Set when LOD merged a whole folder into this one building; churn is then distinct commits for the folder. */
  merged?: number;
}

export interface DirNode {
  kind: 'dir';
  name: string;
  path: string;
  /** Distinct commits in the churn window touching anything below this folder. */
  churn: number;
  /** Distinct commits in the churn window touching a file directly in this folder. */
  directChurn: number;
  children: Node[];
}

export type Node = FileNode | DirNode;

export interface CityTree {
  version: typeof CITY_TREE_VERSION;
  name: string;
  head: string | null;
  /** Reference time for ages (HEAD commit time; file mtime fallback without git). */
  headTime: number;
  sinceDays: number;
  historyAvailable: boolean;
  root: DirNode;
  stats: {
    files: number;
    dirs: number;
    loc: number;
    todos: number;
    /** Commits inside the churn window. */
    commits: number;
    languages: Array<{ lang: Lang; loc: number }>;
  };
}

export function* files(node: Node): Generator<FileNode> {
  if (node.kind === 'file') yield node;
  else for (const c of node.children) yield* files(c);
}

export function* dirs(node: DirNode, depth = 0): Generator<{ dir: DirNode; depth: number }> {
  yield { dir: node, depth };
  for (const c of node.children) if (c.kind === 'dir') yield* dirs(c, depth + 1);
}
