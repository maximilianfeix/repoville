/** Java Edition release → DataVersion (checked against PrismarineJS minecraft-data 3.117.0 on 2026-10-15). */
export const DATA_VERSIONS: Record<string, number> = {
  '1.20.4': 3700,
  '1.20.6': 3839,
  '1.21': 3953,
  '1.21.1': 3955,
  '1.21.3': 4082,
  '1.21.4': 4189,
  '1.21.5': 4325,
  '1.21.8': 4440,
  '1.21.10': 4556,
  '1.21.11': 4671,
  '26.1': 4786,
  '26.1.1': 4788,
  '26.1.2': 4790,
  '26.2': 4903,
  '26.3': 5023,
};

export const DEFAULT_MC = '1.21.11';

export function dataVersionFor(mc: string): number {
  const v = DATA_VERSIONS[mc];
  if (v === undefined) throw new Error(`Unknown Minecraft version "${mc}". Known: ${Object.keys(DATA_VERSIONS).join(', ')}`);
  return v;
}
