// Renders SVG files at several sizes on dark and light backgrounds into one PNG proof sheet.
// Usage: npx tsx scripts/svg-proof.ts out.png a.svg b.svg ...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { chromium } from 'playwright';

const [out, ...files] = process.argv.slice(2);
const rows = files.map((f) => {
  const svg = readFileSync(f, 'utf8');
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const wide = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const ratio = wide ? Number(wide[1]) / Number(wide[2]) : 1;
  const sizes = ratio > 1.5 ? [24, 48, 96] : [16, 32, 64, 128];
  const cells = (bg: string) => sizes.map((s) => `<div style="background:${bg};padding:10px;display:flex;align-items:center"><img src="${uri}" style="height:${s}px;width:${s * ratio}px;image-rendering:auto"></div>`).join('');
  return `<div style="display:flex;gap:6px;align-items:center;margin:6px 0"><code style="width:160px;color:#ccc;font:12px monospace">${basename(f)}</code>${cells('#23262E')}${cells('#F6F1E4')}</div>`;
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 200 } });
await page.setContent(`<body style="margin:12px;background:#111">${rows.join('')}</body>`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
