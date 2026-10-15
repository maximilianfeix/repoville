import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a binary without a shell. Never throws for a non-zero exit; throws if the binary is missing. */
export function run(cmd: string, args: string[], cwd: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }),
    );
  });
}

export async function hasGit(cwd: string): Promise<boolean> {
  try {
    return (await run('git', ['--version'], cwd)).code === 0;
  } catch {
    return false;
  }
}
