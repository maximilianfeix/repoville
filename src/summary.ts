import type { BuildingFact, DistrictFact } from './build/city.js';
import { dirs, type CityTree } from './model/city.js';
import { byCodeUnit } from './scan/walk.js';

export interface Highlights {
  hottestDistricts: Array<{ path: string; commits: number; burning: number }>;
  mostRuined: Array<{ path: string; todos: number; loc: number; share: number }>;
  oldestCorner: { path: string; lastTouched: number | null; ageDays: number | null } | null;
}

const DAY = 86400;

export function highlights(city: CityTree, buildings: BuildingFact[], districts: DistrictFact[]): Highlights {
  // Rank folders by distinct commits, but skip a folder when one child folder
  // carries most of its heat: the fire lives deeper.
  const shown = new Set(districts.map((d) => d.path));
  const burningIn = new Map<string, number>();
  for (const b of buildings) {
    if (!b.fire) continue;
    const dir = b.path.includes('/') ? b.path.slice(0, b.path.lastIndexOf('/')) : '';
    burningIn.set(dir, (burningIn.get(dir) ?? 0) + 1);
  }
  const hottestDistricts = [...dirs(city.root)]
    .filter(({ dir, depth }) => depth >= 1 && shown.has(dir.path) && dir.churn > 0)
    .filter(({ dir }) => dir.children.some((c) => c.kind === 'file'))
    .filter(({ dir }) => !dir.children.some((c) => c.kind === 'dir' && c.churn >= 0.8 * dir.churn))
    .map(({ dir }) => ({ path: dir.path, commits: dir.churn, burning: burningIn.get(dir.path) ?? 0 }))
    .sort((a, b) => b.commits - a.commits || byCodeUnit(a.path, b.path))
    .slice(0, 3);

  const mostRuined = buildings
    .filter((b) => b.todos > 0)
    .map((b) => ({ path: b.path, todos: b.todos, loc: b.loc, share: b.ruinShare }))
    .sort((a, b) => b.todos - a.todos || b.share - a.share || byCodeUnit(a.path, b.path))
    .slice(0, 3);

  const oldest = buildings
    .filter((b) => b.mossy)
    .sort((a, b) => (a.lastTouched ?? -Infinity) - (b.lastTouched ?? -Infinity) || b.loc - a.loc || byCodeUnit(a.path, b.path))[0];
  const oldestCorner = oldest
    ? { path: oldest.path, lastTouched: oldest.lastTouched, ageDays: oldest.lastTouched === null ? null : Math.floor((city.headTime - oldest.lastTouched) / DAY) }
    : null;
  return { hottestDistricts, mostRuined, oldestCorner };
}

export function formatHighlights(h: Highlights, sinceLabel: string): string[] {
  const lines: string[] = [];
  if (h.hottestDistricts.length) {
    lines.push(`hottest districts (commits in ${sinceLabel}):`);
    for (const d of h.hottestDistricts) lines.push(`  ${d.path}: ${d.commits} commits${d.burning ? `, ${d.burning} ${d.burning === 1 ? 'roof' : 'roofs'} on fire` : ''}`);
  }
  if (h.mostRuined.length) {
    lines.push('most ruined buildings (TODO/FIXME/HACK/XXX):');
    for (const r of h.mostRuined) lines.push(`  ${r.path}: ${r.todos} markers in ${r.loc} lines`);
  }
  if (h.oldestCorner) {
    const age = h.oldestCorner.ageDays === null ? 'untouched for 3+ years' : `untouched for ${h.oldestCorner.ageDays} days`;
    lines.push(`oldest mossy corner: ${h.oldestCorner.path} (${age})`);
  }
  return lines;
}
