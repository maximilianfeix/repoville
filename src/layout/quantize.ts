import type { Rect } from './treemap.js';

/**
 * Snaps a float treemap rectangle to whole blocks. Each edge is rounded on its
 * own, so two rectangles that share an edge in float space share it after
 * snapping, and rounding is monotonic, so disjoint rectangles stay disjoint.
 */
export function snap(n: { x0: number; y0: number; x1: number; y1: number }): Rect {
  return { x0: Math.round(n.x0), z0: Math.round(n.y0), x1: Math.round(n.x1), z1: Math.round(n.y1) };
}
