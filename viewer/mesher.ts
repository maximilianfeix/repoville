/**
 * Greedy mesher over a dense chunk with a one-cell border on x and z.
 * Emits quads for faces between a solid cell and air, merging equal ids.
 * Output is plain arrays so it runs (and is tested) without three.js.
 */
export interface MeshOut {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  quads: number;
}

// Shade per face direction: +x, -x, +y, -y, +z, -z.
const SHADE = [0.82, 0.7, 1.0, 0.5, 0.9, 0.62];

export function greedyMesh(
  vox: Uint16Array,
  sx: number,
  sy: number,
  sz: number,
  colors: number[],
  kinds: number[],
  offset: [number, number, number],
): MeshOut {
  const bx = sx + 2;
  const bz = sz + 2;
  const solid = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= sy) return 0;
    return vox[(y * bz + (z + 1)) * bx + (x + 1)]!;
  };
  const dims = [sx, sy, sz];
  let pos = new Float32Array(4096 * 12);
  let col = new Float32Array(4096 * 12);
  let idx = new Uint32Array(4096 * 6);
  let quads = 0;
  const grow = () => {
    const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = p2;
    const c2 = new Float32Array(col.length * 2); c2.set(col); col = c2;
    const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = i2;
  };

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = dims[u]!;
    const dv = dims[v]!;
    const mask = new Int32Array(du * dv);
    const x = [0, 0, 0];
    const q = [0, 0, 0];
    q[d] = 1;
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? 1 : -1;
      const shade = SHADE[d * 2 + side]!;
      for (x[d] = 0; x[d]! < dims[d]!; x[d]!++) {
        // Build the mask for this slice.
        let n = 0;
        for (x[v] = 0; x[v] < dv; x[v]++) {
          for (x[u] = 0; x[u] < du; x[u]++, n++) {
            const a = solid(x[0]!, x[1]!, x[2]!);
            const b = solid(x[0]! + q[0]! * dir, x[1]! + q[1]! * dir, x[2]! + q[2]! * dir);
            mask[n] = a && (!b || (kinds[b] === 3 && kinds[a] !== 3)) ? a : 0;
          }
        }
        // Merge rectangles.
        n = 0;
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du; ) {
            const id = mask[n]!;
            if (!id) {
              i++;
              n++;
              continue;
            }
            let w = 1;
            while (i + w < du && mask[n + w] === id) w++;
            let h = 1;
            outer: for (; j + h < dv; h++) {
              for (let k = 0; k < w; k++) if (mask[n + k + h * du] !== id) break outer;
            }
            // Emit the quad.
            const base = [0, 0, 0];
            base[d] = x[d]! + (side === 0 ? 1 : 0);
            base[u] = i;
            base[v] = j;
            const du3 = [0, 0, 0];
            const dv3 = [0, 0, 0];
            du3[u] = w;
            dv3[v] = h;
            if ((quads + 1) * 12 > pos.length) grow();
            const vi = quads * 4;
            const corners = [
              [base[0]!, base[1]!, base[2]!],
              [base[0]! + du3[0]!, base[1]! + du3[1]!, base[2]! + du3[2]!],
              [base[0]! + du3[0]! + dv3[0]!, base[1]! + du3[1]! + dv3[1]!, base[2]! + du3[2]! + dv3[2]!],
              [base[0]! + dv3[0]!, base[1]! + dv3[1]!, base[2]! + dv3[2]!],
            ];
            let pp = quads * 12;
            for (const c of corners) {
              pos[pp++] = c[0]! + offset[0];
              pos[pp++] = c[1]! + offset[1];
              pos[pp++] = c[2]! + offset[2];
            }
            const rgb = colors[id] ?? 0x808080;
            const glow = kinds[id] === 2 ? 1 : shade;
            const r = (((rgb >> 16) & 255) / 255) * glow;
            const g = (((rgb >> 8) & 255) / 255) * glow;
            const bl = ((rgb & 255) / 255) * glow;
            let cp = quads * 12;
            for (const c of corners) {
              // Cheap ambient occlusion: walls darken toward the street.
              const ao = kinds[id] === 2 ? 1 : 0.68 + 0.32 * Math.min(1, c[1]! / 22);
              col[cp++] = r * ao;
              col[cp++] = g * ao;
              col[cp++] = bl * ao;
            }
            // Counter-clockwise when seen from outside (u × v points along +d).
            const ip = quads * 6;
            if (side === 0) idx.set([vi, vi + 1, vi + 2, vi, vi + 2, vi + 3], ip);
            else idx.set([vi, vi + 2, vi + 1, vi, vi + 3, vi + 2], ip);
            quads++;
            // Clear the merged area.
            for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * du] = 0;
            i += w;
            n += w;
          }
        }
      }
    }
  }
  return { positions: pos.slice(0, quads * 12), colors: col.slice(0, quads * 12), indices: idx.slice(0, quads * 6), quads };
}
