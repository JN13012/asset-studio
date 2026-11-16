import type { Point } from './cutout';
import type { RasterLayer } from './layers';
import type { Size } from './viewport';

// Corners in image-relative coordinates: TL, TR, BR, BL.
export type Quad = readonly [Point, Point, Point, Point];
export const IDENTITY_QUAD: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const EPSILON = 1e-5;

export function validQuad(quad: Quad): boolean {
  if (quad.length !== 4 || quad.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 8 || Math.abs(p.y) > 8)) return false;
  // Reject concavity, self intersections and collapsed edges.
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= EPSILON) return false;
  }
  return true;
}

// Unit-square to quad homography: (ax + by + c)/(gx + hy + 1).
export function homography(quad: Quad) {
  if (!validQuad(quad)) return null;
  const [p0,p1,p2,p3] = quad;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < EPSILON) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  // Keep the whole source rectangle on the positive side of the projective plane.
  if (Math.min(1, 1 + g, 1 + h, 1 + g + h) < EPSILON) return null;
  return { a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y, g, h };
}

export function projectPoint(quad: Quad, point: Point): Point | null {
  const m = homography(quad);
  if (!m) return null;
  const w = m.g * point.x + m.h * point.y + 1;
  if (w < EPSILON) return null;
  return { x: (m.a * point.x + m.b * point.y + m.c) / w, y: (m.d * point.x + m.e * point.y + m.f) / w };
}

export function moveCorner(quad: Quad, index: number, delta: Point): Quad {
  if (!Number.isInteger(index) || index < 0 || index > 3) return quad;
  const next = quad.map((point, i) => i === index ? { x: point.x + delta.x, y: point.y + delta.y } : point) as unknown as Quad;
  return homography(next) ? next : quad;
}

function rotate(point: Point, degrees: number): Point {
  const angle = degrees * Math.PI / 180;
  return { x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) };
}

export function cornerWorld(layer: RasterLayer, image: Size, point: Point): Point {
  const local = rotate({ x: (point.x - .5) * image.width * layer.scale * (layer.stretchX ?? 1),
    y: (point.y - .5) * image.height * layer.scale * (layer.stretchY ?? 1) }, layer.rotation);
  return { x: layer.x + image.width / 2 + local.x, y: layer.y + image.height / 2 + local.y };
}

export function cornerDelta(layer: RasterLayer, image: Size, delta: Point): Point {
  const local = rotate(delta, -layer.rotation);
  return { x: local.x / (image.width * layer.scale * (layer.stretchX ?? 1)),
    y: local.y / (image.height * layer.scale * (layer.stretchY ?? 1)) };
}

// CSS matrix3d is column-major. The homography is converted from normalized
// coordinates to native asset pixels; it is composed before the usual affine transform.
export function rasterTransform(layer: RasterLayer, image: Size): { transform: string; transformOrigin: string } {
  const sx = layer.scale * (layer.stretchX ?? 1), sy = layer.scale * (layer.stretchY ?? 1);
  const affine = 'rotate(' + layer.rotation + 'deg) scale(' + sx + ',' + sy + ')';
  const m = layer.quad ? homography(layer.quad) : null;
  if (!m) return { transform: affine, transformOrigin: 'center' };
  const { width: w, height: h } = image;
  const matrix = [m.a, m.d * h / w, 0, m.g / w, m.b * w / h, m.e, 0, m.h / h, 0, 0, 1, 0, m.c * w, m.f * h, 0, 1];
  return { transformOrigin: '0 0', transform: 'translate(' + w / 2 + 'px,' + h / 2 + 'px) ' + affine +
    ' translate(' + (-w / 2) + 'px,' + (-h / 2) + 'px) matrix3d(' + matrix.join(',') + ')' };
}
