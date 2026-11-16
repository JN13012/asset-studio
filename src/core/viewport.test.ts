import { describe, expect, it } from 'vitest';
import { clampZoom, fitScale, MAX_ZOOM, MIN_ZOOM } from './viewport';

describe('fitScale', () => {
  it('fits landscape images without distortion', () => {
    expect(fitScale({ width: 2000, height: 1000 }, { width: 1096, height: 800 })).toBe(0.5);
  });
  it('fits portrait images by height', () => {
    expect(fitScale({ width: 1000, height: 2000 }, { width: 1100, height: 1096 })).toBe(0.5);
  });
  it('does not enlarge small images', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 900, height: 900 })).toBe(1);
  });
  it('handles zero dimensions safely', () => {
    expect(fitScale({ width: 0, height: 100 }, { width: 900, height: 900 })).toBe(1);
  });
  it('handles invalid zoom', () => {
    expect(clampZoom(Infinity)).toBe(1);
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(50)).toBe(MAX_ZOOM);
  });
});
