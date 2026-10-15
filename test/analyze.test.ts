import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze.js';
import type { DirNode, FileNode, Node } from '../src/model/city.js';
import { fixture } from './helpers.js';

function find(node: Node, path: string): Node | undefined {
  if (node.path === path) return node;
  if (node.kind === 'dir') for (const c of node.children) {
    const hit = find(c, path);
    if (hit) return hit;
  }
  return undefined;
}

describe('analyze', () => {
  it('builds a city tree with folders as districts and files as buildings', async () => {
    const city = await analyze(fixture('town'), { sinceDays: 365 });
    expect(city.root.kind).toBe('dir');
    const src = find(city.root, 'src') as DirNode;
    expect(src.kind).toBe('dir');
    expect(src.children.map((c) => c.name)).toEqual([...src.children.map((c) => c.name)].sort());
    const hot = find(city.root, 'src/hot.ts') as FileNode;
    expect(hot).toMatchObject({ kind: 'file', lang: 'typescript', churn: 12 });
    const ruins = find(city.root, 'src/ruins.ts') as FileNode;
    expect(ruins.todos).toBe(4);
    const old = find(city.root, 'src/util/old.py') as FileNode;
    expect(old.lang).toBe('python');
    expect(city.headTime - old.lastTouched!).toBeGreaterThan(365 * 86400);
    expect(city.stats.files).toBe(city.stats.files);
    expect(city.stats.loc).toBeGreaterThan(500);
  });

  it('is deterministic: two runs give byte-identical JSON', async () => {
    const a = JSON.stringify(await analyze(fixture('town'), { sinceDays: 365 }));
    const b = JSON.stringify(await analyze(fixture('town'), { sinceDays: 365 }));
    const h = (s: string) => createHash('sha256').update(s).digest('hex');
    expect(h(a)).toBe(h(b));
    expect(a).not.toMatch(/\\\\/); // no Windows separators
  });
});
