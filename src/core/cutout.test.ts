import { describe, expect, it } from 'vitest';
import { polygonBounds, sourcePoint } from './cutout';

describe('polygon cutout', () => {
  const image = { width: 100, height: 80 };
  it('maps viewport coordinates into original pixels', () => {
    expect(sourcePoint({ x: 35, y: 30 }, { x: 10, y: 10, width: 50, height: 40 }, image)).toEqual({ x: 50, y: 40 });
  });
  it('rejects coordinates outside the document', () => {
    expect(sourcePoint({ x: 61, y: 10 }, { x: 10, y: 10, width: 50, height: 40 }, image)).toBeNull();
  });
  it('encloses fractional polygon vertices', () => {
    expect(polygonBounds([{ x: 10.2, y: 5.1 }, { x: 40.8, y: 5.1 }, { x: 10.2, y: 25.4 }], image))
      .toEqual({ x: 10, y: 5, width: 31, height: 21 });
  });
  it('rejects degenerate or out-of-bounds polygons', () => {
    expect(() => polygonBounds([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], image)).toThrow();
    expect(() => polygonBounds([{ x: -1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }], image)).toThrow();
  });
});
