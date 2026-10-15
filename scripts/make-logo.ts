// Generates the Repoville mark as exact isometric geometry: npx tsx scripts/make-logo.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'assets', 'brand');
const C = { deep: '#23262E', deeper: '#16181D', plate: '#2E323B', sand: '#E8D9A8', shade: '#A8996E', bone: '#F6F1E4', moss: '#4E8C3A', lava: '#FF7A1A', dia: '#3FD0C9', win: '#3A3F4B' };

type P = [number, number];
function makeIso(cx: number, cy: number, a: number, b: number, c: number) {
  return (x: number, z: number, y: number): P => [cx + (x - z) * a, cy + (x + z) * b - y * c];
}
const poly = (pts: P[], fill: string) => `<path fill="${fill}" d="M${pts.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}Z"/>`;

interface Tower { x0: number; z0: number; x1: number; z1: number; h: number; lava?: boolean }

function mark(opts: { windows: boolean; branch: boolean; mono?: boolean; size: number }) {
  const s = opts.size / 64;
  const iso = makeIso(32 * s, 33.5 * s, 3.2 * s, 1.6 * s, 3.0 * s);
  const parts: string[] = [];
  const col = (c: string) => (opts.mono ? 'currentColor' : c);
  // Plate 0..8 × 0..8, 1 unit thick.
  const P = 8;
  parts.push(poly([iso(0, P, 0), iso(P, P, 0), iso(P, P, -1.2), iso(0, P, -1.2)], col(C.deeper)));
  parts.push(poly([iso(P, 0, 0), iso(P, P, 0), iso(P, P, -1.2), iso(P, 0, -1.2)], col(C.deep)));
  parts.push(poly([iso(0, 0, 0), iso(P, 0, 0), iso(P, P, 0), iso(0, P, 0)], col(C.plate)));
  if (opts.branch && !opts.mono) {
    // Git branch as a street: main line plus one branch with three commit dots.
    const a = iso(1.2, 7.3, 0), b = iso(7.3, 7.3, 0), m = iso(4.4, 7.3, 0), e = iso(7.2, 5.2, 0);
    const w = 1.6 * s;
    parts.push(`<path fill="none" stroke="${C.dia}" stroke-width="${+(w).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" d="M${a.map((v) => +v.toFixed(2)).join(' ')}L${b.map((v) => +v.toFixed(2)).join(' ')}M${m.map((v) => +v.toFixed(2)).join(' ')}L${e.map((v) => +v.toFixed(2)).join(' ')}"/>`);
  }
  const towers: Tower[] = [
    { x0: 0.8, z0: 0.8, x1: 3.8, z1: 3.8, h: 10.5, lava: true },
    { x0: 4.6, z0: 1.0, x1: 7.2, z1: 3.6, h: 6.8 },
    { x0: 1.6, z0: 4.4, x1: 4.2, z1: 6.6, h: 4 },
  ];
  // Painter's order: back to front by x0 + z0.
  for (const t of [...towers].sort((p, q) => p.x0 + p.z0 - (q.x0 + q.z0))) {
    parts.push(poly([iso(t.x0, t.z1, 0), iso(t.x1, t.z1, 0), iso(t.x1, t.z1, t.h), iso(t.x0, t.z1, t.h)], col(C.sand)));
    parts.push(poly([iso(t.x1, t.z0, 0), iso(t.x1, t.z1, 0), iso(t.x1, t.z1, t.h), iso(t.x1, t.z0, t.h)], col(C.shade)));
    parts.push(poly([iso(t.x0, t.z0, t.h), iso(t.x1, t.z0, t.h), iso(t.x1, t.z1, t.h), iso(t.x0, t.z1, t.h)], col(C.bone)));
    if (opts.windows && !opts.mono) {
      for (let y = 1.2; y < t.h - 0.8; y += 1.6) {
        for (const [u0, u1] of [[0.25, 0.45], [0.55, 0.75]] as const) {
          const x0 = t.x0 + (t.x1 - t.x0) * u0, x1 = t.x0 + (t.x1 - t.x0) * u1;
          parts.push(poly([iso(x0, t.z1, y), iso(x1, t.z1, y), iso(x1, t.z1, y + 0.7), iso(x0, t.z1, y + 0.7)], C.win));
          const z0 = t.z0 + (t.z1 - t.z0) * u0, z1 = t.z0 + (t.z1 - t.z0) * u1;
          parts.push(poly([iso(t.x1, z0, y), iso(t.x1, z1, y), iso(t.x1, z1, y + 0.7), iso(t.x1, z0, y + 0.7)], '#6E6650'));
        }
      }
    }
    if (t.lava && !opts.mono) {
      const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2, r = 0.75;
      parts.push(poly([iso(cx - r, cz - r, t.h + 1.1), iso(cx + r, cz - r, t.h + 1.1), iso(cx + r, cz + r, t.h + 1.1), iso(cx - r, cz + r, t.h + 1.1)], '#FFB066'));
      parts.push(poly([iso(cx - r, cz + r, t.h), iso(cx + r, cz + r, t.h), iso(cx + r, cz + r, t.h + 1.1), iso(cx - r, cz + r, t.h + 1.1)], C.lava));
      parts.push(poly([iso(cx + r, cz - r, t.h), iso(cx + r, cz + r, t.h), iso(cx + r, cz + r, t.h + 1.1), iso(cx + r, cz - r, t.h + 1.1)], '#D45F10'));
    }
  }
  return parts.join('');
}

const svg = (size: number, body: string, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"${extra}>${body}</svg>\n`;
writeFileSync(join(OUT, 'mark.svg'), svg(64, mark({ windows: true, branch: true, size: 64 })));
writeFileSync(join(OUT, 'mark-mono.svg'), svg(64, mark({ windows: false, branch: false, mono: true, size: 64 }), ' fill="currentColor"'));
writeFileSync(join(OUT, 'favicon.svg'), svg(16, mark({ windows: false, branch: false, size: 16 })));

// Wordmarks: keep the lettering paths, swap in the new mark.
for (const f of ['wordmark-on-dark.svg', 'wordmark-on-light.svg']) {
  const s = readFileSync(join(OUT, f), 'utf8');
  const letters = s.slice(s.indexOf('<g fill='));
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80"><g transform="translate(8 6) scale(1.05)">${mark({ windows: true, branch: true, size: 64 })}</g>\n${letters}`;
  writeFileSync(join(OUT, f), out);
}
console.log('logo written');
