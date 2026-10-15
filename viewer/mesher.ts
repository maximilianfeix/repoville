/**
 * Greedy mesher over a dense chunk with a one-cell border on x and z.
 * Emits quads for faces between a solid cell and air, merging equal ids.
 * Output is plain arrays so it runs (and is tested) without three.js.
 */
export interface MeshOut {
  positions: Float32Array;
  /** Per vertex: s, t in block units, detail layer + 64·palette id, and the shade·AO factor. */
  tex: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  quads: number;
}

// Baked shade per face direction (+x, -x, +y, -y, +z, -z). Kept mild because
// the viewer also lights the scene; it keeps faces distinct without lights.
const SHADE = [0.94, 0.9, 1.0, 0.8, 0.96, 0.88];
/** Brightness per AO level (0 = fully occluded corner, 3 = open). */
const AO_LEVEL = [0.5, 0.68, 0.85, 1];
/** Corner offsets along the face's u and v axes, in quad corner order. */
const CORNER_U = [-1, 1, 1, -1];
const CORNER_V = [-1, -1, 1, 1];

export function greedyMesh(
  vox: Uint16Array,
  sx: number,
  sy: number,
  sz: number,
  colors: number[],
  kinds: number[],
  offset: [number, number, number],
  /** Convert sRGB palette colours to linear (for lit three.js materials). */
  linear = false,
  /** Bake per-vertex ambient occlusion on upward faces (costs ~10% more quads). */
  ao = true,
  /** Detail texture layer per palette id (side/top) and the chunk's integer origin. */
  texture?: { side: ArrayLike<number>; top: ArrayLike<number>; origin: [number, number] },
): MeshOut {
  const lin = (c: number) => (linear ? Math.pow(c, 2.2) : c);
  const bx = sx + 2;
  const bz = sz + 2;
  const solid = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= sy) return 0;
    return vox[(y * bz + (z + 1)) * bx + (x + 1)]!;
  };
  const dims = [sx, sy, sz];
  // Glass, foliage and thin blocks barely block light.
  const occludes = (id: number) => (id && kinds[id] !== 3 && kinds[id] !== 4 ? 1 : 0);
  let pos = new Float32Array(4096 * 12);
  let col = new Float32Array(4096 * 12);
  let nor = new Float32Array(4096 * 12);
  let tex = new Float32Array(4096 * 16);
  let idx = new Uint32Array(4096 * 6);
  let quads = 0;
  const grow = () => {
    const p2 = new Float32Array(pos.length * 2); p2.set(pos); pos = p2;
    const c2 = new Float32Array(col.length * 2); c2.set(col); col = c2;
    const n2 = new Float32Array(nor.length * 2); n2.set(nor); nor = n2;
    const t2 = new Float32Array(tex.length * 2); t2.set(tex); tex = t2;
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
            const ax = x[0]! + q[0]! * dir, ay = x[1]! + q[1]! * dir, az = x[2]! + q[2]! * dir;
            const b = solid(ax, ay, az);
            if (!(a && (!b || (kinds[b] === 3 && kinds[a] !== 3)))) {
              mask[n] = 0;
              continue;
            }
            // Per-corner ambient occlusion (0fps): look at the cells around the air
            // cell in the face plane. Packed into the mask so greedy merging only
            // joins faces with identical shading.
            let ao4 = 0xff;
            // AO only on upward faces (ground, roofs): that is where it reads from the
            // usual 3/4 view, and walls stay fully merged (quads matter most there).
            if (ao && kinds[a] !== 2 && d === 1 && side === 0) {
              ao4 = 0;
              for (let c = 0; c < 4; c++) {
                const su = CORNER_U[c]!, sv = CORNER_V[c]!;
                const o1 = [ax, ay, az]; o1[u]! += su;
                const o2 = [ax, ay, az]; o2[v]! += sv;
                const o3 = [ax, ay, az]; o3[u]! += su; o3[v]! += sv;
                const s1 = occludes(solid(o1[0]!, o1[1]!, o1[2]!));
                const s2 = occludes(solid(o2[0]!, o2[1]!, o2[2]!));
                const cc = occludes(solid(o3[0]!, o3[1]!, o3[2]!));
                const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
                ao4 |= level << (c * 2);
              }
            }
            mask[n] = a | (ao4 << 16);
          }
        }
        // Merge rectangles.
        n = 0;
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du; ) {
            const key = mask[n]!;
            const id = key & 0xffff;
            const ao4 = key >>> 16;
            if (!key) {
              i++;
              n++;
              continue;
            }
            let w = 1;
            while (i + w < du && mask[n + w] === key) w++;
            let h = 1;
            outer: for (; j + h < dv; h++) {
              for (let k = 0; k < w; k++) if (mask[n + k + h * du] !== key) break outer;
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
            if ((quads + 1) * 16 > tex.length || (quads + 1) * 12 > pos.length) grow();
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
            const r = lin(((rgb >> 16) & 255) / 255) * glow;
            const g = lin(((rgb >> 8) & 255) / 255) * glow;
            const bl = lin((rgb & 255) / 255) * glow;
            const lv = [ao4 & 3, (ao4 >> 2) & 3, (ao4 >> 4) & 3, (ao4 >> 6) & 3];
            const aoAt = (k: number) => (kinds[id] === 2 ? 1 : AO_LEVEL[lv[k]!]! * (0.86 + 0.14 * Math.min(1, corners[k]![1]! / 18)));
            if (texture) {
              // s runs horizontally, t vertically on walls (so brick rows stay level).
              const layer = (d === 1 ? texture.top[id]! : texture.side[id]!) + 64 * id;
              let tp = quads * 16;
              for (let k = 0; k < 4; k++) {
                const c = corners[k]!;
                const wx = c[0]! + texture.origin[0];
                const wz = c[2]! + texture.origin[1];
                tex[tp++] = d === 0 ? wz : wx;
                tex[tp++] = d === 1 ? wz : c[1]!;
                tex[tp++] = layer;
                tex[tp++] = glow * aoAt(k);
              }
            }
            let np = quads * 12;
            for (let k = 0; k < 4; k++) {
              nor[np + d] = side === 0 ? 1 : -1;
              np += 3;
            }
            let cp = quads * 12;
            for (let k = 0; k < 4; k++) {
              // Corner AO plus a gentle darkening toward street level.
              const ao = aoAt(k);
              col[cp++] = r * ao;
              col[cp++] = g * ao;
              col[cp++] = bl * ao;
            }
            // Counter-clockwise when seen from outside (u × v points along +d).
            const ip = quads * 6;
            // Flip the diagonal so AO interpolates without the classic seam.
            const flip = lv[0]! + lv[2]! < lv[1]! + lv[3]!;
            if (side === 0) idx.set(flip ? [vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi] : [vi, vi + 1, vi + 2, vi, vi + 2, vi + 3], ip);
            else idx.set(flip ? [vi + 1, vi + 3, vi + 2, vi + 1, vi, vi + 3] : [vi, vi + 2, vi + 1, vi, vi + 3, vi + 2], ip);
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
  return { positions: pos.slice(0, quads * 12), tex: tex.slice(0, quads * 16), normals: nor.slice(0, quads * 12), colors: col.slice(0, quads * 12), indices: idx.slice(0, quads * 6), quads };
}
