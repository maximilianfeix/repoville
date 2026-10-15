const UNITS: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };

/** Parses "1y", "6m", "2w", "30d" (or a bare number of days) into days. */
export function parseDays(input: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([dwmy]?)$/i.exec(input.trim());
  if (!m) throw new Error(`Invalid duration "${input}". Use e.g. 30d, 6m, 1y.`);
  const days = Number(m[1]) * (UNITS[(m[2] || 'd').toLowerCase()] ?? 1);
  if (!(days > 0)) throw new Error(`Duration must be positive: "${input}"`);
  return Math.round(days);
}
