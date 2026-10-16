export type Lang =
  | 'rust' | 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'kotlin'
  | 'c' | 'cpp' | 'ruby' | 'haskell' | 'fp' | 'shell' | 'config' | 'markdown'
  | 'swift' | 'csharp' | 'php' | 'lua' | 'other';

const BY_EXT: Record<string, Lang> = {
  rs: 'rust',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', vue: 'javascript', svelte: 'javascript',
  py: 'python', pyi: 'python', pyx: 'python',
  go: 'go',
  java: 'java', scala: 'java', groovy: 'java',
  kt: 'kotlin', kts: 'kotlin',
  c: 'c', h: 'c',
  cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp', m: 'c', mm: 'cpp',
  rb: 'ruby', erb: 'ruby', rake: 'ruby',
  swift: 'swift', cs: 'csharp', csx: 'csharp', php: 'php', phtml: 'php', lua: 'lua', luau: 'lua',
  hs: 'haskell', lhs: 'haskell',
  ml: 'fp', mli: 'fp', elm: 'fp', clj: 'fp', cljs: 'fp', ex: 'fp', exs: 'fp', erl: 'fp', fs: 'fp', fsx: 'fp', purs: 'fp',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell', ps1: 'shell', bat: 'shell', cmd: 'shell',
  json: 'config', jsonc: 'config', yml: 'config', yaml: 'config', toml: 'config', ini: 'config', cfg: 'config',
  xml: 'config', gradle: 'config', properties: 'config', cmake: 'config', mk: 'config', nix: 'config',
  md: 'markdown', mdx: 'markdown', rst: 'markdown', adoc: 'markdown', txt: 'markdown',
};

const BY_NAME: Record<string, Lang> = {
  dockerfile: 'shell', makefile: 'shell', justfile: 'shell', rakefile: 'ruby', gemfile: 'ruby',
  'cmakelists.txt': 'config', license: 'markdown', copying: 'markdown',
};

const LOCKFILES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock',
  'cargo.lock', 'go.sum', 'poetry.lock', 'pipfile.lock', 'uv.lock', 'composer.lock', 'gemfile.lock',
  'flake.lock', 'pubspec.lock', 'mix.lock', 'packages.lock.json', 'gradle.lockfile',
]);

const TEST_PATH = /(^|\/)(tests?|__tests__|spec|specs|e2e)(\/|$)|\.(test|spec)\.[^/]+$|_test\.(go|py|rb|exs?)$|(^|\/)test_[^/]+\.py$|Tests?\.(java|kt|cs)$/;
const DOC_PATH = /(^|\/)(docs?|documentation)(\/|$)/i;

export interface Classification {
  lang: Lang;
  isTest: boolean;
  isDoc: boolean;
  lockfile: boolean;
}

export function classify(path: string): Classification {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const lower = base.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot > 0 ? lower.slice(dot + 1) : '';
  const lang = BY_NAME[lower] ?? BY_EXT[ext] ?? 'other';
  return {
    lang,
    isTest: TEST_PATH.test(path),
    isDoc: lang === 'markdown' || (DOC_PATH.test(path) && lang !== 'other' && lang !== 'config'),
    lockfile: LOCKFILES.has(lower),
  };
}
