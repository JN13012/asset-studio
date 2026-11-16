import type { Point } from './cutout';
import type { Size } from './viewport';

export interface Geometry {
  id: string;
  name: string;
  points: Point[];
  closed: boolean;
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}
export type GeometryPatch = Partial<Omit<Geometry, 'id' | 'closed'>>;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

export function validatePoints(points: Point[], closed: boolean, size: Size) {
  if (points.length < (closed ? 3 : 2) || points.length > 256 ||
    points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > size.width || p.y > size.height)) {
    throw new Error('Nombre de sommets ou coordonnées invalides.');
  }
  const distinct = new Set(points.map(p => p.x + ',' + p.y));
  if (distinct.size < (closed ? 3 : 2)) throw new Error('Tracé dégénéré.');
}
export function createGeometry(id: string, points: Point[], closed: boolean, size: Size): Geometry {
  validatePoints(points, closed, size);
  return { id, name: closed ? 'Polygone' : 'Ligne', points: points.map(p => ({...p})), closed,
    stroke: '#a6adb1', fill: '#7f868b', strokeWidth: closed ? 2 : 12, opacity: 1, visible: true, locked: false };
}

export function updateGeometry(shapes: Geometry[], id: string, patch: GeometryPatch, size: Size): Geometry[] {
  const shape = shapes.find(item => item.id === id);
  if (!shape) return shapes;
  const next = { ...shape, visible: patch.visible ?? shape.visible, locked: patch.locked ?? shape.locked };
  if (!shape.locked) {
    if (patch.points) {
      validatePoints(patch.points, shape.closed, size);
      next.points = patch.points.map(p => ({...p}));
    }
    next.name = patch.name?.trim().slice(0, 120) || shape.name;
    if (patch.stroke && /^#[\da-f]{6}$/i.test(patch.stroke)) next.stroke = patch.stroke;
    if (patch.fill && /^#[\da-f]{6}$/i.test(patch.fill)) next.fill = patch.fill;
    if (patch.strokeWidth !== undefined && Number.isFinite(patch.strokeWidth)) next.strokeWidth = clamp(patch.strokeWidth, .5, 1000);
    if (patch.opacity !== undefined && Number.isFinite(patch.opacity)) next.opacity = clamp(patch.opacity, 0, 1);
  }
  if (JSON.stringify(next) === JSON.stringify(shape)) return shapes;
  return shapes.map(item => item.id === id ? next : item);
}

export function moveVertex(points: Point[], index: number, point: Point, size: Size): Point[] {
  return points.map((p, i) => i === index ? { x: clamp(round(point.x), 0, size.width), y: clamp(round(point.y), 0, size.height) } : p);
}
export function moveGeometry(points: Point[], delta: Point, size: Size): Point[] {
  const dx = clamp(round(delta.x), -Math.min(...points.map(p => p.x)), size.width - Math.max(...points.map(p => p.x)));
  const dy = clamp(round(delta.y), -Math.min(...points.map(p => p.y)), size.height - Math.max(...points.map(p => p.y)));
  return points.map(p => ({ x: clamp(p.x + dx, 0, size.width), y: clamp(p.y + dy, 0, size.height) }));
}
export function insertVertex(points: Point[], index: number, closed: boolean): Point[] {
  if (index < 0 || index >= points.length || points.length >= 256 || (!closed && index === points.length - 1)) return points;
  const a = points[index], b = points[(index + 1) % points.length];
  return [...points.slice(0,index+1), { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }, ...points.slice(index+1)];
}
export function removeVertex(points: Point[], index: number, closed: boolean): Point[] {
  if (points.length <= (closed ? 3 : 2) || index < 0 || index >= points.length) return points;
  return points.filter((_,i) => i !== index);
}
