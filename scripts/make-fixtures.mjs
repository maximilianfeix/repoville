// Builds deterministic fixture repos under test/fixtures/repos/.
// Every commit gets a fixed author/committer date, so hashes and churn are stable.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'repos');

function git(cwd, args, date) {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.com',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  };
  if (date) {
    env.GIT_AUTHOR_DATE = date;
    env.GIT_COMMITTER_DATE = date;
  }
  return execFileSync('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function write(repo, path, content) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function lines(n, prefix = 'const x') {
  return Array.from({ length: n }, (_, i) => `${prefix}${i} = ${i};`).join('\n') + '\n';
}

function commit(repo, message, date) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--allow-empty', '-m', message], date);
}

function makeTown() {
  const repo = join(ROOT, 'town');
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'core.autocrlf', 'false']);

  write(repo, '.gitignore', 'build/\n*.log\n');
  write(repo, 'README.md', '# Town\n\nA fixture repo.\n\n## Usage\n\nRun it.\n');
  write(repo, 'docs/guide.md', '# Guide\n\n' + 'Some prose line.\n'.repeat(40));
  write(repo, 'src/index.ts', lines(120));
  write(repo, 'src/hot.ts', lines(60));
  write(repo, 'src/ruins.ts', lines(30) + '// TODO: fix\n// FIXME: broken\n// HACK: temporary\n// TODO again\n');
  write(repo, 'src/crlf.ts', 'const a = 1;\r\nconst b = 2;\r\n\r\nconst c = 3;\r\n');
  write(repo, 'src/util/strings.ts', lines(45));
  write(repo, 'src/util/tiny.ts', 'export const t = 1;\n');
  write(repo, 'src/util/old.py', 'def f():\n    return 1\n'.repeat(25));
  write(repo, 'core/engine.rs', 'fn main() {}\n'.repeat(200));
  write(repo, 'core/net.go', 'package core\n'.repeat(80));
  write(repo, 'test/index.test.ts', lines(50, 'expect'));
  write(repo, 'scripts/run.sh', '#!/bin/sh\necho hi\n'.repeat(5));
  write(repo, 'package-lock.json', '{"lockfileVersion":3}\n');
  write(repo, 'assets/logo.bin', Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0x00, 0x03]));
  write(repo, 'build/out.js', lines(10));
  write(repo, 'node_modules/dep/index.js', lines(10));
  commit(repo, 'initial', '2024-01-01T12:00:00Z');

  // Hot file: many commits inside the last year.
  for (let i = 0; i < 12; i++) {
    write(repo, 'src/hot.ts', lines(61 + i));
    commit(repo, `hot ${i}`, new Date(Date.UTC(2025, 10, 1) + i * 20 * 86400000).toISOString());
  }
  write(repo, 'src/index.ts', lines(121));
  write(repo, 'src/util/strings.ts', lines(46));
  commit(repo, 'touch index + strings', '2026-09-30T09:00:00Z');
  write(repo, 'test/index.test.ts', lines(52, 'expect'));
  commit(repo, 'tests', '2026-10-01T09:00:00Z');
  // Untracked file that is not ignored: must still be scanned.
  write(repo, 'src/untracked.ts', lines(5));
  return repo;
}

mkdirSync(ROOT, { recursive: true });
const town = makeTown();
console.log(`fixtures ready: ${town}`);
