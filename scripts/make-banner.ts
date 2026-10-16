// README banners (light/dark) from real renders in site-dist/media: npx tsx scripts/make-banner.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const img = (f: string) => readFileSync(join(ROOT, 'site-dist', 'media', f)).toString('base64');
const themes = {
  light: { bg: '#F6F3EC', text: '#20231F', muted: '#596057', accent: '#356449', shot: 'inspect-busy.jpg' },
  dark: { bg: '#101410', text: '#F2F1E9', muted: '#B6BDAF', accent: '#9CC8A5', shot: 'react-night.jpg' },
};
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, t] of Object.entries(themes)) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 520 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:1600px;height:520px;overflow:hidden;background:${t.bg};color:${t.text};display:grid;grid-template-columns:780px 1fr">
  <div style="padding:58px 0 52px 64px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:12px;font:800 30px 'Bricolage Grotesque';letter-spacing:-.5px"><svg width="28" height="28" viewBox="0 0 24 24"><rect x="2" y="12" width="6" height="10" fill="${t.muted}"/><rect x="9" y="4" width="6" height="18" fill="${t.text}"/><rect x="16" y="9" width="6" height="13" fill="${t.accent}"/></svg>repoville</div>
    <div style="font:800 112px/.9 'Bricolage Grotesque';letter-spacing:-5px;margin-top:auto">See your repo as a city.</div>
    <div style="font:500 19px 'JetBrains Mono';color:${t.muted};margin-top:30px">folders → districts · files → buildings · git history → marks</div>
  </div>
  <img src="data:image/jpeg;base64,${img(t.shot)}" style="width:100%;height:520px;object-fit:cover;object-position:50% 50%">
  </body></html>`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(ROOT, 'docs', 'media', `banner-${name}.png`) });
  await page.close();
}
await browser.close();
console.log('wrote docs/media/banner-light.png and banner-dark.png');
