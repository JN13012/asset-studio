import { MAX_DOCUMENT_PIXELS, MAX_LAYERS, SOURCE_ID } from './layers';
import type { RasterLayer } from './layers';
import { loadSourceImage, MAX_FILE_BYTES } from './sourceImage';
import type { SourceImage } from './sourceImage';
import { homography } from './perspective';
import type { Quad } from './perspective';
import { validatePoints } from './geometry';
import type { Geometry } from './geometry';
import { polygonBounds } from './cutout';
import type { Point } from './cutout';
import type { RepairRegion } from './repair';
import type { Size } from './viewport';

export interface DocumentState {
  source: SourceImage;
  layers: RasterLayer[];
  assets: Record<string, SourceImage>;
  selected: string;
  repairs: RepairRegion[];
  geometry: Geometry[];
  selectedGeometry: string | null;
}

const MAGIC = 'ASTUDIO1';
const HEADER_BYTES = 12;
export const MAX_PROJECT_BYTES = 256 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
interface Descriptor extends Size { id: string; name: string; type: string; bytes: number }
interface Manifest {
  version: 1;
  layers: RasterLayer[];
  assets: Descriptor[];
  selected: string;
  repairs: RepairRegion[];
  geometry: Geometry[];
  selectedGeometry: string | null;
}
type RecordValue = Record<string, unknown>;
function invalid(): never { throw new Error('Projet Asset Studio invalide ou incompatible.'); }
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as RecordValue;
}
function string(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) return invalid();
  return value;
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return invalid();
  return value;
}
function bool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) return invalid();
  return value;
}
function id(value: unknown): string {
  const result = string(value, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(result) || ['__proto__', 'prototype', 'constructor'].includes(result)) return invalid();
  return result;
}
function unique(ids: string[]) { if (new Set(ids).size !== ids.length) invalid(); }
function color(value: unknown): string {
  const result = string(value, 7);
  return /^#[0-9a-f]{6}$/i.test(result) ? result : invalid();
}
function points(value: unknown, size: Size, min: number, max: number): Point[] {
  return array(value, min, max).map(value => {
    const p = record(value);
    return { x: number(p.x, 0, size.width), y: number(p.y, 0, size.height) };
  });
}
function layerFrom(value: unknown): RasterLayer {
  const p = record(value);
  const layer: RasterLayer = {
    id: id(p.id), name: string(p.name, 120), visible: bool(p.visible), locked: bool(p.locked),
    opacity: number(p.opacity, 0, 1), x: number(p.x, -100_000, 100_000), y: number(p.y, -100_000, 100_000),
    scale: number(p.scale, .01, 16), rotation: number(p.rotation, -360, 360),
  };
  if (p.kind !== undefined) {
    if (p.kind !== 'image' && p.kind !== 'patch') invalid();
    layer.kind = p.kind;
  }
  if (p.stretchX !== undefined) layer.stretchX = number(p.stretchX, .01, 16);
  if (p.stretchY !== undefined) layer.stretchY = number(p.stretchY, .01, 16);
  if (p.quad === null) layer.quad = null;
  else if (p.quad !== undefined) {
    const corners = array(p.quad, 4, 4).map(value => {
      const corner = record(value);
      return { x: number(corner.x, -8, 8), y: number(corner.y, -8, 8) };
    });
    const quad: Quad = [corners[0],corners[1],corners[2],corners[3]];
    if (!homography(quad)) invalid();
    layer.quad = quad;
  }
  return layer;
}
export function validateManifest(value: unknown): Manifest {
  const p = record(value);
  if (p.version !== 1) invalid();
  const layers = array(p.layers, 1, MAX_LAYERS).map(layerFrom);
  unique(layers.map(layer => layer.id));
  const source = layers[0];
  if (source.id !== SOURCE_ID || !source.locked || source.x !== 0 || source.y !== 0 || source.scale !== 1 ||
    source.rotation !== 0 || source.opacity !== 1 || (source.stretchX ?? 1) !== 1 || (source.stretchY ?? 1) !== 1 || source.quad) invalid();
  const assets = array(p.assets, layers.length, layers.length).map(value => {
    const a = record(value);
    const type = string(a.type, 32);
    if (!['image/png','image/jpeg','image/webp'].includes(type)) invalid();
    return { id: id(a.id), name: string(a.name, 1024), type, bytes: number(a.bytes, 1, MAX_FILE_BYTES, true),
      width: number(a.width, 1, 64_000_000, true), height: number(a.height, 1, 64_000_000, true) };
  });
  unique(assets.map(a => a.id));
  if (layers.some(layer => !assets.some(a => a.id === layer.id)) || assets.some(a => a.width * a.height > 64_000_000) ||
    assets.reduce((sum,a) => sum + a.width*a.height,0) > MAX_DOCUMENT_PIXELS) invalid();
  const size = assets.find(a => a.id === SOURCE_ID)!;
  const geometry = array(p.geometry, 0, 64).map(value => {
    const g = record(value);
    const closed = bool(g.closed);
    const vertices = points(g.points, size, closed ? 3 : 2, 256);
    validatePoints(vertices, closed, size);
    return { id: id(g.id), name: string(g.name, 120), closed, points: vertices, stroke: color(g.stroke), fill: color(g.fill),
      strokeWidth: number(g.strokeWidth,.5,1000), opacity: number(g.opacity,0,1), visible: bool(g.visible), locked: bool(g.locked) };
  });
  unique(geometry.map(g => g.id));
  const repairs = array(p.repairs, 0, 64).map(value => {
    const g = record(value);
    const vertices = points(g.points,size,3,2048);
    polygonBounds(vertices,size);
    return { id: id(g.id), points: vertices, instruction: string(g.instruction, 1000, true) };
  });
  unique(repairs.map(g => g.id));
  const selected = id(p.selected);
  const selectedGeometry = p.selectedGeometry === null ? null : id(p.selectedGeometry);
  if (!layers.some(layer => layer.id === selected) || (selectedGeometry !== null && !geometry.some(g => g.id === selectedGeometry))) invalid();
  return { version: 1, layers, assets, selected, selectedGeometry, geometry, repairs };
}

export function projectFilename(name: string) {
  return (name.replace(/\.[^.]+$/, '') || 'projet') + '.assetstudio';
}

export function saveProject(doc: DocumentState): Blob {
  // The binary payload contains exact original asset bytes, not data URLs or decoded pixels.
  const assets = doc.layers.map(layer => {
    const a = doc.assets[layer.id];
    return { id: layer.id, name: a.file.name, type: a.file.type, bytes: a.file.size, width: a.width, height: a.height };
  });
  const manifest = validateManifest({ version: 1, layers: doc.layers, assets, selected: doc.selected,
    geometry: doc.geometry, repairs: doc.repairs, selectedGeometry: doc.selectedGeometry });
  const metadata = new TextEncoder().encode(JSON.stringify(manifest));
  const total = HEADER_BYTES + metadata.length + assets.reduce((sum,a) => sum+a.bytes,0);
  if (metadata.length > MAX_MANIFEST_BYTES || total > MAX_PROJECT_BYTES) throw new Error('Projet trop volumineux (limite 256 Mio).');
  const header = new Uint8Array(HEADER_BYTES);
  header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(8, metadata.length, true);
  return new Blob([header, metadata, ...assets.map(a => doc.assets[a.id].file)], {type:'application/octet-stream'});
}

export async function readProject(file: Blob): Promise<DocumentState> {
  if (file.size < HEADER_BYTES || file.size > MAX_PROJECT_BYTES) invalid();
  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (new TextDecoder().decode(header.subarray(0,8)) !== MAGIC) invalid();
  const length = new DataView(header.buffer).getUint32(8,true);
  if (length < 1 || length > MAX_MANIFEST_BYTES || HEADER_BYTES+length > file.size) invalid();
  const manifest = validateManifest(JSON.parse(await file.slice(HEADER_BYTES,HEADER_BYTES+length).text()));
  let offset = HEADER_BYTES+length;
  if (offset + manifest.assets.reduce((sum,a) => sum+a.bytes,0) !== file.size) invalid();
  const assets: Record<string,SourceImage> = Object.create(null);
  try {
    for (const a of manifest.assets) {
      const image = await loadSourceImage(new File([file.slice(offset,offset+a.bytes)],a.name,{type:a.type}));
      assets[a.id] = image;
      if (image.width !== a.width || image.height !== a.height) invalid();
      offset += a.bytes;
    }
    return {source:assets[SOURCE_ID], assets, layers:manifest.layers, selected:manifest.selected,
      geometry:manifest.geometry, repairs:manifest.repairs, selectedGeometry:manifest.selectedGeometry};
  } catch (error) {
    for (const asset of Object.values(assets)) URL.revokeObjectURL(asset.url);
    throw error;
  }
}
