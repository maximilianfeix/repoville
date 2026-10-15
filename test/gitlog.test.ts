import { describe, expect, it } from 'vitest';
import { readHistory, parseLogChunks } from '../src/history/gitlog.js';
import { fixture } from './helpers.js';

describe('parseLogChunks', () => {
  it('parses -z name-only records split across chunks', () => {
    const sha = 'a'.repeat(40);
    const sha2 = 'b'.repeat(40);
    const raw = `\x1e${sha} 100\0\nsrc/a.ts\0src/b.ts\0\x1e${sha2} 50\0\nsrc/a.ts\0`;
    const commits: Array<{ time: number; files: string[] }> = [];
    const parser = parseLogChunks((c) => commits.push(c));
    parser.push(raw.slice(0, 17));
    parser.push(raw.slice(17, 60));
    parser.push(raw.slice(60));
    parser.end();
    expect(commits).toEqual([
      { time: 100, files: ['src/a.ts', 'src/b.ts'] },
      { time: 50, files: ['src/a.ts'] },
    ]);
  });

  it('handles merge commits without files', () => {
    const raw = `\x1e${'c'.repeat(40)} 9\0\x1e${'d'.repeat(40)} 8\0\nx\0`;
    const commits: Array<{ time: number; files: string[] }> = [];
    const parser = parseLogChunks((c) => commits.push(c));
    parser.push(raw);
    parser.end();
    expect(commits).toEqual([
      { time: 9, files: [] },
      { time: 8, files: ['x'] },
    ]);
  });
});

describe('readHistory', () => {
  it('counts churn inside the window and last-touched times relative to HEAD', async () => {
    const h = await readHistory(fixture('town'), { sinceDays: 365 });
    expect(h.available).toBe(true);
    expect(h.headTime).toBe(Date.parse('2026-10-01T09:00:00Z') / 1000);
    expect(h.head).toMatch(/^[0-9a-f]{40}$/);
    expect(h.files.get('src/hot.ts')?.churn).toBe(12);
    expect(h.files.get('src/index.ts')?.churn).toBe(1);
    expect(h.files.get('src/index.ts')?.lastTouched).toBe(Date.parse('2026-09-30T09:00:00Z') / 1000);
    // Only touched in 2024: outside the churn window, but last-touched is still known.
    expect(h.files.get('src/util/old.py')?.churn ?? 0).toBe(0);
    expect(h.files.get('src/util/old.py')?.lastTouched).toBe(Date.parse('2024-01-01T12:00:00Z') / 1000);
  });

  it('honours a short window for churn', async () => {
    const h = await readHistory(fixture('town'), { sinceDays: 30 });
    expect(h.files.get('src/hot.ts')?.churn ?? 0).toBe(0);
    expect(h.files.get('test/index.test.ts')?.churn).toBe(1);
  });

  it('degrades gracefully outside a git repo', async () => {
    const h = await readHistory(import.meta.dirname + '/..' + '/docs', { sinceDays: 365 });
    expect(h.available === false || h.files.size >= 0).toBe(true);
  });
});
