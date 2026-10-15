import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFormats, readConfigFile, validateBlockState } from '../src/config.js';

function withConfig(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'rv-cfg-'));
  writeFileSync(join(dir, 'repoville.config.json'), JSON.stringify(obj));
  return dir;
}

describe('config file', () => {
  it('reads supported keys', () => {
    const cfg = readConfigFile(withConfig({ format: 'html,schem', since: '6m', exclude: ['fixtures/**'], palette: { plains: { wall: 'minecraft:white_concrete' } } }));
    expect(cfg.formats).toEqual(['html', 'schem']);
    expect(cfg.since).toBe('6m');
  });
  it('refuses to let a repo choose the output folder', () => {
    expect(() => readConfigFile(withConfig({ out: '../../etc' }))).toThrow(/not supported/);
  });
  it('rejects command blocks and block entity data in palettes', () => {
    expect(() => readConfigFile(withConfig({ palette: { plains: { wall: 'minecraft:command_block' } } }))).toThrow(/not allowed/);
    expect(() => readConfigFile(withConfig({ palette: { plains: { wall: 'minecraft:chest{Items:[]}' } } }))).toThrow(/plain block state/);
    expect(validateBlockState('minecraft:oak_slab[type=bottom,waterlogged=false]', 'x')).toBeTruthy();
  });
  it('validates formats', () => {
    expect(() => parseFormats('html,gif')).toThrow(/Unknown format/);
  });
});
