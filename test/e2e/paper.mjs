// Headless Paper server harness for end-to-end checks.
// Downloads Paper (fill.papermc.io v3) and optional plugins into test/e2e/.paper/,
// writes eula + server.properties (flat world, RCON on) and starts the server.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PAPER_DIR = join(HERE, '.paper');
const UA = 'repoville-e2e (https://github.com/maximilianfeix/repoville)';

async function download(url, file, sha256) {
  if (existsSync(file)) return file;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256 && createHash('sha256').update(buf).digest('hex') !== sha256) throw new Error(`checksum mismatch for ${url}`);
  writeFileSync(file, buf);
  return file;
}

export async function fetchPaper(version) {
  const res = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/latest`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Paper ${version}: ${res.status}`);
  const build = await res.json();
  const dl = build.downloads['server:default'];
  mkdirSync(PAPER_DIR, { recursive: true });
  return download(dl.url, join(PAPER_DIR, dl.name), dl.checksums.sha256);
}

export async function fetchPlugin(url, name) {
  mkdirSync(join(PAPER_DIR, 'plugins'), { recursive: true });
  return download(url, join(PAPER_DIR, 'plugins', name));
}

export function configure({ rconPort = 25575, password, levelName = 'world', freshWorld = true }) {
  mkdirSync(PAPER_DIR, { recursive: true });
  if (freshWorld) for (const d of [levelName, `${levelName}_nether`, `${levelName}_the_end`]) rmSync(join(PAPER_DIR, d), { recursive: true, force: true });
  writeFileSync(join(PAPER_DIR, 'eula.txt'), 'eula=true\n');
  writeFileSync(
    join(PAPER_DIR, 'server.properties'),
    [
      'enable-rcon=true', `rcon.port=${rconPort}`, `rcon.password=${password}`, 'online-mode=false', 'level-type=minecraft\\:flat',
      `level-name=${levelName}`, 'generate-structures=false', 'spawn-protection=0', 'server-port=25599', 'view-distance=4',
      'simulation-distance=4', 'max-players=1', 'allow-nether=false', 'motd=repoville e2e', 'sync-chunk-writes=false',
      'generator-settings={"layers"\\:[{"block"\\:"minecraft\\:bedrock","height"\\:1},{"block"\\:"minecraft\\:stone","height"\\:2}],"biome"\\:"minecraft\\:plains"}',
    ].join('\n') + '\n',
  );
}

export function start(jar, { timeoutMs = 240_000, memory = '2G' } = {}) {
  const child = spawn('java', [`-Xmx${memory}`, '-jar', jar, '--nogui'], { cwd: PAPER_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
  let log = '';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Paper did not start in ${timeoutMs} ms\n${log.slice(-3000)}`)), timeoutMs);
    const onData = (d) => {
      log += d.toString();
      if (/Done \([\d.,]+s\)!/.test(log)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Paper exited with ${code}\n${log.slice(-3000)}`));
    });
  });
  return {
    child,
    ready,
    log: () => log,
    async stop() {
      if (child.exitCode !== null) return;
      child.stdin.write('stop\n');
      await new Promise((r) => {
        const t = setTimeout(() => { child.kill('SIGKILL'); r(); }, 60_000);
        child.on('exit', () => { clearTimeout(t); r(); });
      });
    },
  };
}

export function readServerLog() {
  const f = join(PAPER_DIR, 'logs', 'latest.log');
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
}
