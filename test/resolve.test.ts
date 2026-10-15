import { describe, expect, it } from 'vitest';
import { parseTarget } from '../src/source/resolve.js';

describe('parseTarget', () => {
  it('prefers an existing local folder', () => {
    expect(parseTarget('.').kind).toBe('local');
  });
  it('expands owner/repo shorthand to GitHub', () => {
    expect(parseTarget('facebook/react')).toEqual({ kind: 'remote', url: 'https://github.com/facebook/react.git', owner: 'facebook', repo: 'react' });
  });
  it('accepts GitHub https and ssh URLs', () => {
    expect(parseTarget('https://github.com/torvalds/linux').owner).toBe('torvalds');
    expect(parseTarget('git@github.com:oven-sh/bun.git').repo).toBe('bun');
  });
  it('accepts other git URLs', () => {
    expect(parseTarget('https://gitlab.com/a/b.git')).toMatchObject({ kind: 'remote', repo: 'b' });
  });
  it('rejects nonsense', () => {
    expect(() => parseTarget('not a repo at all!')).toThrow();
  });
});
