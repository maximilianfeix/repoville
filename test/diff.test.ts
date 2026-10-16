import { describe, expect, it } from 'vitest';
import { readDiff } from '../src/history/diff.js';
import { fixture } from './helpers.js';

describe('readDiff', () => {
  it('reports modified files with line counts against a base', async () => {
    const d = await readDiff(fixture('town'), 'HEAD~2');
    expect(d.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    const idx = d.changes.get('src/index.ts');
    expect(idx).toMatchObject({ status: 'modified', added: 1, removed: 0 });
    expect(d.changes.get('test/index.test.ts')?.status).toBe('modified');
    expect(d.changes.has('src/hot.ts')).toBe(false);
  });
  it('fails clearly for an unknown base', async () => {
    await expect(readDiff(fixture('town'), 'no-such-ref')).rejects.toThrow(/merge base/);
  });
});
