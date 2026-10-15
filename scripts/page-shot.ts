// Screenshot a static page: npx tsx scripts/page-shot.ts <file.html> <out.png> <width> [fullPage]
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const [file, out, w, full] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: Number(w) > 600 ? 900 : 844 } });
await p.goto(pathToFileURL(file!).href);
await p.waitForTimeout(1500);
await p.screenshot({ path: out!, fullPage: full === 'full' });
const overflow = await p.evaluate('document.documentElement.scrollWidth > window.innerWidth');
console.log('horizontal overflow:', overflow);
await b.close();
