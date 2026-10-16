import { describe, expect, it } from 'vitest';
import { readTimeline } from '../src/history/timeline.js';
import { fixture } from './helpers.js';

describe('readTimeline', () => {
  it('reconstructs growth from numstat with the last frame at the current height', async () => {
    const t = await readTimeline(fixture('town'), [
      { path: 'src/hot.ts', merged: false, height: 40 },
      { path: 'src/util', merged: true, height: 20 },
      { path: 'nope.ts', merged: false, height: 9 },
    ], 12);
    expect(t).not.toBeNull();
    expect(t!.times).toHaveLength(12);
    const at = (f: number, i: number) => t!.heights[f * 3 + i]!;
    expect(at(11, 0)).toBe(40);
    expect(at(11, 1)).toBe(20);
    expect(at(0, 2)).toBe(0);
    // hot.ts exists from the first commit and never shrinks in this fixture.
    expect(at(0, 0)).toBeGreaterThan(0);
    expect(at(0, 0)).toBeLessThanOrEqual(at(11, 0));
  });
});
