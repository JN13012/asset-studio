import { describe, expect, it } from 'vitest';
import { createLayer, removeLayer, reorderLayer, SOURCE_ID, updateLayer } from './layers';

const size = { width: 100, height: 80 };
function stack() {
  return [
    createLayer(SOURCE_ID, 'Image source', size, size),
    createLayer('a', 'Tour', { width: 20, height: 10 }, size),
    createLayer('b', 'Avion', size, size),
  ];
}

describe('layers', () => {
  it('centers overlays in source coordinates', () => {
    expect(stack()[1]).toMatchObject({ x: 40, y: 35, scale: 1, rotation: 0 });
  });
  it('keeps the source locked and allows hiding it', () => {
    const layers = stack();
    expect(updateLayer(layers, SOURCE_ID, { x: 30, locked: false, visible: false })[0])
      .toMatchObject({ x: 0, locked: true, visible: false });
    expect(removeLayer(layers, SOURCE_ID)).toBe(layers);
    expect(reorderLayer(layers, SOURCE_ID, 1)).toBe(layers);
  });
  it('changes editable metadata immutably', () => {
    const layers = stack();
    const edited = updateLayer(layers, 'a', { name: ' Nouvelle tour ', opacity: 0.4, scale: 2, rotation: 45 });
    expect(edited[1]).toMatchObject({ name: 'Nouvelle tour', opacity: 0.4, scale: 2, rotation: 45 });
    expect(layers[1]).toMatchObject({ name: 'Tour', opacity: 1, scale: 1 });
  });
  it('clamps transforms and rejects non-finite values', () => {
    expect(updateLayer(stack(), 'a', { opacity: 2, scale: 0, x: NaN, rotation: 900 })[1])
      .toMatchObject({ opacity: 1, scale: 0.01, x: 40, rotation: 360 });
  });
  it('reorders overlays without moving the source', () => {
    const layers = stack();
    expect(reorderLayer(layers, 'a', 1).map(layer => layer.id)).toEqual([SOURCE_ID, 'b', 'a']);
    expect(reorderLayer(layers, 'a', -1)).toBe(layers);
  });
  it('protects locked overlays from modification and deletion', () => {
    const layers = updateLayer(stack(), 'a', { locked: true });
    expect(updateLayer(layers, 'a', { x: 0, visible: false })[1]).toMatchObject({ x: 40, visible: false });
    expect(removeLayer(layers, 'a')).toBe(layers);
    expect(reorderLayer(layers, 'b', -1)).toBe(layers);
    expect(removeLayer(updateLayer(layers, 'a', { locked: false }), 'a').map(layer => layer.id))
      .toEqual([SOURCE_ID, 'b']);
  });
});
