import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const FIXTURES = join(import.meta.dirname, 'fixtures', 'repos');

export function fixture(name: string): string {
  const dir = join(FIXTURES, name);
  if (!existsSync(dir)) execFileSync('node', [join(import.meta.dirname, '..', 'scripts', 'make-fixtures.mjs')]);
  return dir;
}
