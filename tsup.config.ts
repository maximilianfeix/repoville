import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig([
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    bundle: true,
    noExternal: [/.*/],
    splitting: false,
    clean: true,
    define: { 'process.env.REPOVILLE_VERSION': JSON.stringify(version) },
    banner: { js: '#!/usr/bin/env node\nimport { createRequire as __rvCreateRequire } from "node:module";\nconst require = __rvCreateRequire(import.meta.url);' },
  },
  {
    entry: { viewer: 'viewer/main.ts' },
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    minify: true,
    bundle: true,
    noExternal: [/.*/],
    clean: false,
    outExtension: () => ({ js: '.js' }),
  },
]);
