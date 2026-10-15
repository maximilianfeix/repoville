import { colorOf } from '../build/colors.js';
import type { VoxelGrid } from '../build/voxel-grid.js';
import { encodePng } from './png.js';

/**
 * Isometric software render of the voxel grid (no browser needed). Each
 * visible voxel becomes a 2×2 diamond top plus two shaded side pixels;
 * columns are drawn back to front so nearer blocks cover farther ones.
 */
export function renderThumbnail(grid: VoxelGrid, maxWidth = 1200): Buffer {
  const top = grid.topY();
  const step = Math.max(1, Math.ceil((grid.width + grid.length) / (maxWidth / 2)));
  const W = Math.ceil(((grid.width + grid.length) / step) * 2) + 4;
  const H = Math.ceil((grid.width + grid.length) / step + (top / step) * 2.4) + 8;
  const img = new Uint8Array(W * H * 4);
  // Background: deepslate.
  for (let i = 0; i < W * H; i++) img.set([0x23, 0x26, 0x2e, 255], i * 4);
  const colors = grid.palette.map(colorOf);
  const put = (x: number, y: number, rgb: number, shade: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img[i] = Math.min(255, ((rgb >> 16) & 255) * shade);
    img[i + 1] = Math.min(255, ((rgb >> 8) & 255) * shade);
    img[i + 2] = Math.min(255, (rgb & 255) * shade);
    img[i + 3] = 255;
  };
  const ox = Math.ceil(grid.length / step) * 2 + 2;
  const oy = Math.ceil((top / step) * 2.4) + 4;
  // Back to front: increasing x + z.
  const cols = Math.ceil(grid.width / step);
  const rows = Math.ceil(grid.length / step);
  for (let s = 0; s < cols + rows; s++) {
    for (let cz = Math.max(0, s - cols + 1); cz <= Math.min(rows - 1, s); cz++) {
      const cx = s - cz;
      const gx = cx * step, gz = cz * step;
      for (let y = 0; y < top; y += step) {
        const id = grid.get(gx, y, gz);
        if (!id) continue;
        const rgb = colors[id]!;
        const px = ox + (cx - cz) * 2;
        const py = oy + (cx + cz) - Math.round((y / step) * 2.4);
        put(px, py, rgb, 1.05);
        put(px + 1, py, rgb, 1.05);
        put(px, py + 1, rgb, 0.78);
        put(px + 1, py + 1, rgb, 0.62);
        put(px, py + 2, rgb, 0.78);
        put(px + 1, py + 2, rgb, 0.62);
      }
    }
  }
  return encodePng(W, H, img);
}
