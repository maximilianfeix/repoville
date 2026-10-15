import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { crc32, encodePng } from '../src/write/png.js';
import { renderThumbnail } from '../src/write/thumbnail.js';

describe('png', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
  it('encodes a decodable RGBA image', () => {
    const png = encodePng(2, 1, Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const idat = png.indexOf('IDAT');
    const len = png.readUInt32BE(idat - 4);
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + len));
    expect([...raw]).toEqual([0, 255, 0, 0, 255, 0, 0, 255, 255]);
  });
  it('renders a non-empty thumbnail deterministically', () => {
    const g = new VoxelGrid(30, 20, 30);
    for (let y = 0; y < 10; y++) g.setState(15, y, 15, 'minecraft:bricks');
    const a = renderThumbnail(g);
    expect(a.equals(renderThumbnail(g))).toBe(true);
    expect(a.length).toBeGreaterThan(100);
  });
});
