import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Biome, Palette } from './build/palette.js';

export const FORMATS = ['html', 'schem', 'litematic', 'world', 'json'] as const;
export type Format = (typeof FORMATS)[number];

export interface RenderConfig {
  out: string;
  formats: Format[];
  mc: string;
  maxBuildings: number;
  since: string;
  include: string[];
  exclude: string[];
  ignore: string[];
  seed: number;
  textured: boolean;
  open: boolean;
  gallery: boolean;
  palette?: Partial<Record<Biome, Partial<Palette>>>;
}

export const DEFAULTS: RenderConfig = {
  out: 'repoville-out',
  formats: ['html', 'schem'],
  mc: '1.21.11',
  maxBuildings: 4000,
  since: '1y',
  include: [],
  exclude: [],
  ignore: [],
  seed: 0,
  textured: false,
  open: false,
  gallery: false,
};

export const CONFIG_FILE = 'repoville.config.json';

export function parseFormats(input: string | string[]): Format[] {
  const list = (Array.isArray(input) ? input : input.split(',')).map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const f of list) if (!(FORMATS as readonly string[]).includes(f)) throw new Error(`Unknown format "${f}". Use: ${FORMATS.join(', ')}`);
  return [...new Set(list)] as Format[];
}

/** Reads repoville.config.json from the repo root (if present). Unknown keys are rejected to catch typos. */
export function readConfigFile(dir: string): Partial<RenderConfig> {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return {};
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const known = new Set<string>([...Object.keys(DEFAULTS), 'format', 'palette']);
  for (const k of Object.keys(raw)) if (!known.has(k)) throw new Error(`${CONFIG_FILE}: unknown key "${k}"`);
  const out: Partial<RenderConfig> = { ...(raw as Partial<RenderConfig>) };
  if (raw.format !== undefined) out.formats = parseFormats(raw.format as string | string[]);
  delete (out as Record<string, unknown>).format;
  return out;
}
