import type { Size } from './viewport';
import { homography } from './perspective';
import type { Quad } from './perspective';

export interface RasterLayer {
  id: string;
  kind?: 'image' | 'patch';
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  stretchX?: number;
  stretchY?: number;
  rotation: number;
  quad?: Quad | null;
}
export const SOURCE_ID = 'source';
export const MAX_LAYERS = 32;
export const MAX_DOCUMENT_PIXELS = 128_000_000;

export function createLayer(id: string, name: string, image: Size, document: Size): RasterLayer {
  const source = id === SOURCE_ID;
  return {
    id, name, visible: true, locked: source, opacity: 1,
    x: source ? 0 : Math.round((document.width - image.width) / 2),
    y: source ? 0 : Math.round((document.height - image.height) / 2),
    scale: 1, rotation: 0,
  };
}

type LayerPatch = Partial<Omit<RasterLayer, 'id'>>;
const finite = (value: number | undefined, fallback: number, min: number, max: number) =>
  value === undefined || !Number.isFinite(value) ? fallback : Math.max(min, Math.min(max, value));

export function updateLayer(layers: RasterLayer[], id: string, patch: LayerPatch): RasterLayer[] {
  return layers.map(layer => {
    if (layer.id !== id) return layer;
    const next = { ...layer, visible: patch.visible ?? layer.visible };
    if (id === SOURCE_ID) return next;
    if (layer.locked) return { ...next, locked: patch.locked ?? true };
    return {
      ...next,
      locked: patch.locked ?? false,
      name: patch.name?.trim().slice(0, 120) || layer.name,
      opacity: finite(patch.opacity, layer.opacity, 0, 1),
      x: finite(patch.x, layer.x, -100_000, 100_000),
      y: finite(patch.y, layer.y, -100_000, 100_000),
      scale: finite(patch.scale, layer.scale, 0.01, 16),
      stretchX: patch.stretchX === undefined ? layer.stretchX : finite(patch.stretchX, layer.stretchX ?? 1, 0.01, 16),
      stretchY: patch.stretchY === undefined ? layer.stretchY : finite(patch.stretchY, layer.stretchY ?? 1, 0.01, 16),
      rotation: finite(patch.rotation, layer.rotation, -360, 360),
      quad: patch.quad === null ? null : patch.quad && homography(patch.quad) ? patch.quad : layer.quad,
    };
  });
}

export function reorderLayer(layers: RasterLayer[], id: string, direction: -1 | 1): RasterLayer[] {
  const index = layers.findIndex(layer => layer.id === id);
  const target = index + direction;
  if (index < 1 || target < 1 || target >= layers.length || layers[index].locked || layers[target].locked) return layers;
  const next = [...layers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeLayer(layers: RasterLayer[], id: string): RasterLayer[] {
  const layer = layers.find(item => item.id === id);
  if (!layer || layer.locked || id === SOURCE_ID) return layers;
  return layers.filter(item => item.id !== id);
}
