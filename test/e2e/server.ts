import { Rcon } from '../../src/live/rcon.js';
// @ts-expect-error untyped helper module
import { configure, fetchPaper, fetchPlugin, start } from './paper.mjs';

export const MC = process.env.MC_VERSION ?? '1.21.11';
// WorldEdit 7.4.x needs Java 25; Paper 1.21.11 runs on Java 21, so use the last 7.3 release.
export const WORLDEDIT = { url: 'https://cdn.modrinth.com/data/1u6JkXh5/versions/2YDdVDmG/worldedit-bukkit-7.3.19.jar', name: 'worldedit-bukkit-7.3.19.jar' };

export interface Session {
  rcon: Rcon;
  run: (cmd: string) => Promise<string>;
  password: string;
}

/** Starts Paper (or reuses one when E2E_RCON_PW is set) and hands an RCON session to `fn`. */
export async function withServer<T>(opts: { plugins?: Array<{ url: string; name: string }>; before?: () => void; freshWorld?: boolean }, fn: (s: Session) => Promise<T>): Promise<T> {
  const reuse = process.env.E2E_RCON_PW;
  const password = reuse ?? 'e2e-' + Math.random().toString(36).slice(2);
  let server: { ready: Promise<void>; stop: () => Promise<void> } | null = null;
  if (!reuse) {
    const jar = await fetchPaper(MC);
    for (const p of opts.plugins ?? []) await fetchPlugin(p.url, p.name);
    configure({ password, freshWorld: opts.freshWorld ?? true });
    opts.before?.();
    server = start(jar);
    await server!.ready;
  } else {
    opts.before?.();
  }
  const rcon = new Rcon('127.0.0.1', 25575);
  await rcon.connect(password);
  const run = async (cmd: string) => {
    const out = await rcon.send(cmd);
    if (process.env.E2E_VERBOSE) console.log(`> ${cmd}\n  ${out.trim()}`);
    return out;
  };
  try {
    return await fn({ rcon, run, password });
  } finally {
    rcon.close();
    await server?.stop();
  }
}

export interface Expect {
  x: number;
  y: number;
  z: number;
  block: string;
}

export async function checkBlocks(run: Session['run'], expectations: Expect[]): Promise<number> {
  let failures = 0;
  for (const e of expectations) {
    const reply = await run(`execute if block ${e.x} ${e.y} ${e.z} ${e.block}`);
    if (!/passed/i.test(reply)) {
      failures++;
      console.log(`  ✗ ${e.block} at ${e.x} ${e.y} ${e.z}: ${reply.trim()}`);
    }
  }
  return failures;
}
