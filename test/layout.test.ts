import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyLod } from '../src/model/lod.js';
import { files, type CityTree, type DirNode, type FileNode, type Node } from '../src/model/city.js';
import { layoutCity, buildingHeight, type Rect } from '../src/layout/treemap.js';
import { roadWidth } from '../src/layout/roads.js';

function file(path: string, loc: number, extra: Partial<FileNode> = {}): FileNode {
  return { kind: 'file', name: path.split('/').pop()!, path, lang: 'typescript', loc, todos: 0, churn: 0, lastTouched: 0, isTest: false, isDoc: false, ...extra };
}

function tree(root: DirNode): CityTree {
  let n = 0;
  for (const _ of files(root)) n++;
  return {
    version: 1, name: 't', head: null, headTime: 0, sinceDays: 365, historyAvailable: false, root,
    stats: { files: n, dirs: 0, loc: 0, todos: 0, commits: 0, languages: [] },
  };
}

// Random directory trees with unique, sorted paths.
const arbTree = fc
  .array(fc.tuple(fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { minLength: 0, maxLength: 3 }), fc.integer({ min: 0, max: 20000 })), { minLength: 1, maxLength: 120 })
  .map((entries) => {
    const root: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: [] };
    entries.forEach(([segs, loc], i) => {
      let dir = root;
      let path = '';
      for (const s of segs) {
        path = path ? `${path}/${s}` : s;
        let next = dir.children.find((c): c is DirNode => c.kind === 'dir' && c.name === s);
        if (!next) {
          next = { kind: 'dir', churn: 0, directChurn: 0, name: s, path, children: [] };
          dir.children.push(next);
        }
        dir = next;
      }
      const fp = path ? `${path}/f${i}.ts` : `f${i}.ts`;
      dir.children.push(file(fp, loc));
    });
    const sort = (d: DirNode) => {
      d.children.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
      d.children.forEach((c) => c.kind === 'dir' && sort(c));
    };
    sort(root);
    return tree(root);
  });

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}
function inside(inner: Rect, outer: Rect): boolean {
  return inner.x0 >= outer.x0 && inner.z0 >= outer.z0 && inner.x1 <= outer.x1 && inner.z1 <= outer.z1;
}

describe('buildingHeight', () => {
  it('follows min(250, 4 + round(4·√(LOC/10)))', () => {
    expect(buildingHeight(0)).toBe(4);
    expect(buildingHeight(10)).toBe(8);
    expect(buildingHeight(1000)).toBe(44);
    expect(buildingHeight(10_000_000)).toBe(250);
  });
});

describe('roadWidth', () => {
  it('is max(2, 6 - depth)', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(roadWidth)).toEqual([6, 5, 4, 3, 2, 2, 2]);
  });
});

describe('layoutCity', () => {
  it('never overlaps lots, keeps buildings inside lots and lots inside the city', () => {
    fc.assert(
      fc.property(arbTree, (city) => {
        const l = layoutCity(city);
        const lots = l.buildings.map((b) => b.lot);
        for (let i = 0; i < lots.length; i++) {
          expect(inside(l.buildings[i]!.footprint, lots[i]!)).toBe(true);
          expect(inside(lots[i]!, { x0: 0, z0: 0, x1: l.width, z1: l.length })).toBe(true);
          const fp = l.buildings[i]!.footprint;
          expect(fp.x1 - fp.x0).toBeGreaterThanOrEqual(1);
          expect(fp.z1 - fp.z0).toBeGreaterThanOrEqual(1);
          for (let j = i + 1; j < lots.length; j++) expect(overlaps(lots[i]!, lots[j]!)).toBe(false);
        }
      }),
      { numRuns: Number(process.env.FC_RUNS ?? 150) },
    );
  });

  it('places every file exactly once', () => {
    fc.assert(
      fc.property(arbTree, (city) => {
        const l = layoutCity(city);
        const placed = l.buildings.map((b) => b.file.path).sort();
        const expected = [...files(city.root)].map((f) => f.path).sort();
        expect(placed).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('nests district rects inside their parents', () => {
    fc.assert(
      fc.property(arbTree, (city) => {
        const l = layoutCity(city);
        const byPath = new Map(l.districts.map((d) => [d.path, d]));
        for (const d of l.districts) {
          if (d.path === '') continue;
          const parentPath = d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : '';
          expect(inside(d.rect, byPath.get(parentPath)!.rect)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(arbTree, (city) => {
        expect(JSON.stringify(layoutCity(city))).toBe(JSON.stringify(layoutCity(structuredClone(city))));
      }),
      { numRuns: 30 },
    );
  });

  it('puts tiny files into a suburb of 3x3 houses', () => {
    const root: DirNode = {
      kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: [
        file('big.ts', 5000),
        ...Array.from({ length: 9 }, (_, i) => file(`t${i}.ts`, 3)),
      ],
    };
    const l = layoutCity(tree(root));
    const houses = l.buildings.filter((b) => b.kind === 'house');
    expect(houses).toHaveLength(9);
    for (const h of houses) {
      expect(h.footprint.x1 - h.footprint.x0).toBe(3);
      expect(h.footprint.z1 - h.footprint.z0).toBe(3);
    }
  });

  it('stays within a 1024x1024 footprint', () => {
    const root: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: Array.from({ length: 3000 }, (_, i) => file(`f${String(i).padStart(4, '0')}.c`, 30000)) };
    const l = layoutCity(tree(root));
    expect(l.width).toBeLessThanOrEqual(1024);
    expect(l.length).toBeLessThanOrEqual(1024);
  });
});

describe('applyLod', () => {
  it('merges deepest folders into towers until the building budget fits', () => {
    const mk = (dir: string, n: number): DirNode => ({
      kind: 'dir', churn: 0, directChurn: 0, name: dir.split('/').pop()!, path: dir,
      children: Array.from({ length: n }, (_, i) => file(`${dir}/f${i}.c`, 10, { churn: 1, todos: 1, lastTouched: i })),
    });
    const a = mk('a', 3);
    const deep = mk('a/deep', 50);
    deep.churn = 7;
    a.children.push(deep);
    const root: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: [a, mk('b', 5)] };
    const city = tree(root);
    const out = applyLod(city, 20);
    const all = [...files(out.root)];
    expect(all.length).toBeLessThanOrEqual(20);
    const tower = all.find((f) => f.path === 'a/deep')!;
    expect(tower).toMatchObject({ merged: 50, loc: 500, churn: 7, todos: 50, lastTouched: 49 });
    // The input is not mutated.
    expect([...files(city.root)].length).toBe(58);
  });

  it('is a no-op under budget', () => {
    const root: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: [file('x.ts', 1)] };
    expect(applyLod(tree(root), 10).root).toEqual(root);
  });
});

void (null as unknown as Node);

describe('terraces', () => {
  it('lays a folder of small towers out as rows of equal depth in path order', () => {
    const lib: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'lib', path: 'lib', children: [] };
    for (let i = 0; i < 10; i++) lib.children.push(file(`lib/m${String(i).padStart(2, '0')}.ts`, 30 + i * 3));
    const root: DirNode = { kind: 'dir', churn: 0, directChurn: 0, name: 'r', path: '', children: [lib, file('big.ts', 4000)] };
    const layout = layoutCity(tree(root));
    const rows = layout.buildings.filter((b) => b.file.path.startsWith('lib/'));
    expect(rows).toHaveLength(10);
    const alongX = rows.every((b) => b.footprint.z1 - b.footprint.z0 === 6);
    const depth = (b: (typeof rows)[number]) => (alongX ? b.footprint.z1 - b.footprint.z0 : b.footprint.x1 - b.footprint.x0);
    expect(rows.every((b) => depth(b) === 6)).toBe(true);
    // Within each band (same front coordinate) buildings run in path order.
    const front = (b: (typeof rows)[number]) => (alongX ? b.footprint.z0 : b.footprint.x0);
    const along = (b: (typeof rows)[number]) => (alongX ? b.footprint.x0 : b.footprint.z0);
    const bands = new Map<number, typeof rows>();
    for (const b of rows) bands.set(front(b), [...(bands.get(front(b)) ?? []), b]);
    expect(bands.size).toBeLessThan(10);
    for (const band of bands.values()) {
      const byPath = [...band].sort((a, b) => (a.file.path < b.file.path ? -1 : 1));
      expect(byPath.map(along)).toEqual([...byPath.map(along)].sort((a, b) => a - b));
    }
  });
});
