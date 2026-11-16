import { describe, expect, it } from 'vitest';
import { createRepairRegion, patchPosition, repairInstructions } from './repair';

const size = { width: 100, height: 80 };
const points = [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 30 }, { x: 10, y: 30 }];

describe('repair regions', () => {
  it('places a patch using the upper-left corner in original pixels', () => {
    expect(patchPosition(points, { x: 60.2, y: 49.7 }, size)).toEqual({ x: 60, y: 50 });
  });
  it('rejects destinations extending beyond the image', () => {
    expect(() => patchPosition(points, { x: 71, y: 50 }, size)).toThrow();
    expect(() => patchPosition(points, { x: NaN, y: 0 }, size)).toThrow();
  });
  it('accepts a patch exactly on the image boundary', () => {
    expect(patchPosition(points, { x: 70, y: 60 }, size)).toEqual({ x: 70, y: 60 });
  });
  it('stores an independent polygon and trimmed instruction', () => {
    const region = createRepairRegion('a', points, '  Refaire le quai  ', size);
    expect(region.instruction).toBe('Refaire le quai');
    expect(region.points).toEqual(points);
    expect(region.points[0]).not.toBe(points[0]);
  });
  it('exports dimensions, coordinate convention and instruction', () => {
    const md = repairInstructions([createRepairRegion('a', points, 'Refaire le quai', size)], size);
    expect(md).toContain('100 × 80');
    expect(md).toContain('blanc = zone à reconstruire');
    expect(md).toContain('Refaire le quai');
    expect(md).toContain('(10.00, 10.00)');
  });
});
