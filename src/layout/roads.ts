/** Road width between the children of a folder at this depth: max(2, 6 - depth). */
export function roadWidth(depth: number): number {
  return Math.max(2, 6 - depth);
}

/** Districts this deep (or shallower) with enough children get a plaza strip with a name sign. */
export const PLAZA_MAX_DEPTH = 3;
export const PLAZA_DEPTH = 3;
