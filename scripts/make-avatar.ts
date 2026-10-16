// Renders assets/brand/avatar-512.png (mark on a deepslate square) with headless Chromium.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
const root = join(import.meta.dirname, '..');
const mark = readFileSync(join(root, 'assets', 'brand', 'mark.svg')).toString('base64');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
await p.setContent(`<body style="margin:0;width:512px;height:512px;background:#23262E;display:grid;place-items:center"><img src="data:image/svg+xml;base64,${mark}" width="400" height="400"></body>`);
await p.screenshot({ path: join(root, 'assets', 'brand', 'avatar-512.png') });
await b.close();
console.log('avatar written');
