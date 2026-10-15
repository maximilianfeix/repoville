export interface ParsedState {
  name: string;
  properties: Record<string, string>;
}

/** "minecraft:oak_slab[type=bottom,waterlogged=false]" -> name + properties. */
export function parseState(state: string): ParsedState {
  const open = state.indexOf('[');
  if (open === -1) return { name: state, properties: {} };
  const properties: Record<string, string> = {};
  for (const kv of state.slice(open + 1, -1).split(',')) {
    if (!kv) continue;
    const [k, v] = kv.split('=');
    properties[k!] = v!;
  }
  return { name: state.slice(0, open), properties };
}
