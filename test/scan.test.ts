import { describe, expect, it } from 'vitest';
import { countSource } from '../src/scan/loc.js';
import { classify } from '../src/scan/langs.js';
import { walk } from '../src/scan/walk.js';
import { fixture } from './helpers.js';

describe('countSource', () => {
  it('counts non-blank lines with LF and CRLF alike', () => {
    expect(countSource(Buffer.from('a\nb\n\nc\n'))).toMatchObject({ binary: false, loc: 3, lines: 4 });
    expect(countSource(Buffer.from('a\r\nb\r\n\r\nc'))).toMatchObject({ binary: false, loc: 3, lines: 4 });
  });

  it('counts TODO, FIXME, HACK and XXX markers as whole words', () => {
    const src = '// TODO a\n// FIXME b\n# HACK\n/* XXX */\nconst TODOS = 1; // not a marker\n';
    expect(countSource(Buffer.from(src)).todos).toBe(4);
  });

  it('flags a NUL byte in the first 8 KB as binary', () => {
    expect(countSource(Buffer.from([0x61, 0x00, 0x62])).binary).toBe(true);
    const late = Buffer.concat([Buffer.alloc(9000, 0x61), Buffer.from([0])]);
    expect(countSource(late).binary).toBe(false);
  });

  it('treats an empty file as zero lines', () => {
    expect(countSource(Buffer.alloc(0))).toMatchObject({ loc: 0, lines: 0, todos: 0 });
  });
});

describe('classify', () => {
  it('maps extensions and special names to languages', () => {
    expect(classify('src/a.ts').lang).toBe('typescript');
    expect(classify('src/a.tsx').lang).toBe('typescript');
    expect(classify('x/main.rs').lang).toBe('rust');
    expect(classify('pkg/x.go').lang).toBe('go');
    expect(classify('a/b.py').lang).toBe('python');
    expect(classify('Dockerfile').lang).toBe('shell');
    expect(classify('README.md').lang).toBe('markdown');
    expect(classify('weird.zzz').lang).toBe('other');
  });

  it('detects tests and docs', () => {
    expect(classify('test/index.test.ts').isTest).toBe(true);
    expect(classify('src/__tests__/a.js').isTest).toBe(true);
    expect(classify('pkg/x_test.go').isTest).toBe(true);
    expect(classify('tests/test_api.py').isTest).toBe(true);
    expect(classify('src/contest.ts').isTest).toBe(false);
    expect(classify('docs/guide.md').isDoc).toBe(true);
    expect(classify('src/index.ts').isDoc).toBe(false);
  });

  it('recognizes lockfiles', () => {
    expect(classify('package-lock.json').lockfile).toBe(true);
    expect(classify('sub/Cargo.lock').lockfile).toBe(true);
    expect(classify('src/lock.ts').lockfile).toBe(false);
  });
});

describe('walk', () => {
  it('lists source files and skips ignored, vendored, lockfile and binary entries', async () => {
    const files = await walk(fixture('town'));
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/untracked.ts');
    expect(paths).toContain('README.md');
    expect(paths).not.toContain('package-lock.json');
    expect(paths).not.toContain('assets/logo.bin');
    expect(paths.some((p) => p.startsWith('node_modules/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('build/'))).toBe(false);
    expect(paths).toEqual([...paths].sort());
  });

  it('applies include and exclude globs', async () => {
    const files = await walk(fixture('town'), { include: ['src/**'], exclude: ['**/*.py'] });
    const paths = files.map((f) => f.path);
    expect(paths.every((p) => p.startsWith('src/'))).toBe(true);
    expect(paths).not.toContain('src/util/old.py');
  });

  it('reports CRLF files with correct line counts', async () => {
    const files = await walk(fixture('town'));
    expect(files.find((f) => f.path === 'src/crlf.ts')).toMatchObject({ loc: 3, lines: 4 });
  });
});
