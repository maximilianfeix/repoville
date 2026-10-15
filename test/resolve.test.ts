import { describe, expect, it } from 'vitest';
import { parseTarget, webBaseFor } from '../src/source/resolve.js';

describe('parseTarget', () => {
  it('prefers an existing local folder', () => {
    expect(parseTarget('.').kind).toBe('local');
  });
  it('expands owner/repo shorthand to GitHub', () => {
    expect(parseTarget('facebook/react')).toMatchObject({ kind: 'remote', url: 'https://github.com/facebook/react.git', owner: 'facebook', repo: 'react' });
  });
  it('accepts GitHub https and ssh URLs', () => {
    expect(parseTarget('https://github.com/torvalds/linux').owner).toBe('torvalds');
    expect(parseTarget('git@github.com:oven-sh/bun.git').repo).toBe('bun');
  });
  it('accepts other git URLs', () => {
    expect(parseTarget('https://gitlab.com/a/b.git')).toMatchObject({ kind: 'remote', repo: 'b' });
  });
  it('matches GitHub by exact host only', () => {
    const fake = parseTarget('https://notgithub.com/a/b.git');
    expect(fake.url).toBe('https://notgithub.com/a/b.git');
    expect(fake.owner).toBeUndefined();
    expect(parseTarget('https://github.com.evil.io/a/b').owner).toBeUndefined();
    expect(parseTarget('git@github.com:a/b.git')).toMatchObject({ owner: 'a', repo: 'b', url: 'https://github.com/a/b.git' });
  });
  it('gives different hosts and owners different identities', () => {
    const a = parseTarget('https://gitlab.com/a/same.git');
    const b = parseTarget('https://gitlab.com/b/same.git');
    expect(a.id).not.toBe(b.id);
    expect(parseTarget('https://gitlab.com/group/sub/proj.git').repo).toBe('proj');
  });
  it('rejects path traversal in URLs', () => {
    expect(() => parseTarget('git@gitlab.com:../x.git')).toThrow();
  });
  it('rejects nonsense', () => {
    expect(() => parseTarget('not a repo at all!')).toThrow();
  });
});

describe('webBaseFor', () => {
  it('builds browser links for GitHub and GitLab only', () => {
    expect(webBaseFor('https://github.com/facebook/react.git')).toEqual({ base: 'https://github.com/facebook/react', host: 'github' });
    expect(webBaseFor('git@github.com:a/b.git')).toEqual({ base: 'https://github.com/a/b', host: 'github' });
    expect(webBaseFor('https://gitlab.com/group/sub/proj.git')).toEqual({ base: 'https://gitlab.com/group/sub/proj', host: 'gitlab' });
    expect(webBaseFor('https://example.org/a/b.git')).toBeNull();
    expect(webBaseFor(undefined)).toBeNull();
  });
  it('never carries credentials into the link', () => {
    expect(webBaseFor('https://user:token@github.com/a/b.git')?.base).toBe('https://github.com/a/b');
  });
});
