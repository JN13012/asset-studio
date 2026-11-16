import { loadSourceImage } from './sourceImage';
import type { SourceImage } from './sourceImage';
import type { Size } from './viewport';

export interface Point { x: number; y: number }
export interface Bounds extends Size { x: number; y: number }

export function sourcePoint(client: Point, rect: Bounds, image: Size): Point | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (client.x - rect.x) * image.width / rect.width;
  const y = (client.y - rect.y) * image.height / rect.height;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > image.width || y > image.height) return null;
  return { x, y };
}

export function polygonBounds(points: Point[], image: Size): Bounds {
  if (points.length < 3 || points.length > 2048 ||
      points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > image.width || p.y > image.height)) {
    throw new Error('Tracer au moins trois sommets dans l’image.');
  }
  const x = Math.floor(Math.min(...points.map(p => p.x)));
  const y = Math.floor(Math.min(...points.map(p => p.y)));
  const width = Math.ceil(Math.max(...points.map(p => p.x))) - x;
  const height = Math.ceil(Math.max(...points.map(p => p.y))) - y;
  const area = Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0)) / 2;
  if (width <= 0 || height <= 0 || area < 1) throw new Error('Sélection trop petite ou invalide.');
  return { x, y, width, height };
}

export async function extractPolygon(source: SourceImage, points: Point[], pixelBudget: number) {
  const bounds = polygonBounds(points, source);
  if (bounds.width * bounds.height > pixelBudget) throw new Error('Limite cumulée de mégapixels atteinte.');
  const image = new Image();
  image.src = source.url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible.');
  context.beginPath();
  points.forEach((p, i) => {
    if (i === 0) context.moveTo(p.x - bounds.x, p.y - bounds.y);
    else context.lineTo(p.x - bounds.x, p.y - bounds.y);
  });
  context.closePath();
  context.clip('evenodd');
  context.drawImage(image, -bounds.x, -bounds.y);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('Impossible de créer le PNG.')), 'image/png');
  });
  const file = new File([blob], 'objet-detoure.png', { type: 'image/png' });
  return { x: bounds.x, y: bounds.y, image: await loadSourceImage(file) };
}
