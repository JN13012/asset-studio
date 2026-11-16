import { describe, expect, it } from 'vitest';
import { layerFrame, transformFromDrag } from './transform';
import { createLayer } from './layers';
import { zoomAtPoint } from './viewport';

const image = { width: 40, height: 20 };
const layer = { ...createLayer('a', 'Objet', image, image), x: 10, y: 20 };

describe('interactive transformations', () => {
  it('scales proportionally about the opposite corner', () => {
    const patch = transformFromDrag(layer, image, 'se', { x: 50, y: 40 }, { x: 90, y: 60 });
    expect(patch).toMatchObject({ scale: 2, x: 30, y: 30 });
    expect(layerFrame({ ...layer, ...patch }, image)).toEqual({ center: { x: 50, y: 40 }, width: 80, height: 40 });
  });
  it('stretches only the chosen axis', () => {
    expect(transformFromDrag(layer, image, 'e', { x: 50, y: 30 }, { x: 70, y: 30 }))
      .toMatchObject({ scale: 1, stretchX: 1.5, stretchY: 1, x: 20, y: 20 });
  });
  it('handles rotated edge dragging in local coordinates', () => {
    expect(transformFromDrag({ ...layer, rotation: 90 }, image, 'e', { x: 30, y: 50 }, { x: 30, y: 70 }))
      .toMatchObject({ stretchX: 1.5, x: 10, y: 30 });
  });
  it('rotates around the center, with optional snapping', () => {
    expect(transformFromDrag(layer, image, 'rotate', { x: 30, y: 0 }, { x: 60, y: 30 })).toEqual({ rotation: 90 });
    expect(transformFromDrag(layer, image, 'rotate', { x: 30, y: 0 }, { x: 40, y: 0 }, true)).toEqual({ rotation: 15 });
  });
  it('prevents a resize from flipping through the anchor', () => {
    expect(transformFromDrag(layer, image, 'e', { x: 50, y: 30 }, { x: -50, y: 30 }).stretchX).toBe(.01);
  });
  it('keeps the document point below the cursor stationary', () => {
    expect(zoomAtPoint(1, { x: 20, y: 10 }, { x: 70, y: 40 }, 2)).toEqual({ zoom: 2, offset: { x: -30, y: -20 } });
  });
});
