import { polygonBounds } from './cutout';
import type { Point } from './cutout';
import type { Size } from './viewport';

export interface RepairRegion {
  id: string;
  points: Point[];
  instruction: string;
  kind?: 'edit' | 'protect';
}

export function patchPosition(points: Point[], destination: Point, image: Size): Point {
  const bounds = polygonBounds(points, image);
  const x = Math.round(destination.x);
  const y = Math.round(destination.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x + bounds.width > image.width || y + bounds.height > image.height) {
    throw new Error('Le patch doit tenir entièrement dans l’image.');
  }
  return { x, y };
}

export function createRepairRegion(id: string, points: Point[], instruction: string, image: Size, kind: 'edit' | 'protect' = 'edit'): RepairRegion {
  polygonBounds(points, image);
  return { id, points: points.map(point => ({ ...point })), instruction: instruction.trim().slice(0, 1000), kind };
}

export function repairInstructions(regions: RepairRegion[], image: Size): string {
  return [
    '# Zones de reconstruction',
    '',
    'Dimensions : ' + image.width + ' × ' + image.height + ' pixels.',
    'Masque : blanc = zone à reconstruire ; noir = zone à conserver.',
    'Conserver le reste de l’image, sa perspective, son éclairage et ses matériaux.',
    '',
    ...regions.flatMap((region, i) => [
      '## Zone ' + (i + 1) + ' — ' + (region.kind === 'protect' ? 'PROTÉGER' : 'RECONSTRUIRE'),
      'Instruction : ' + (region.instruction || (region.kind === 'protect' ? 'Conserver la zone.' : 'Reconstruire la zone en fonction des éléments voisins.')),
      'Sommets (pixels, origine en haut à gauche) : ' + region.points.map(p => '(' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ')').join(', '),
      '',
    ]),
  ].join('\n');
}

export async function renderRepairMask(image: Size, regions: RepairRegion[], kind: 'edit' | 'protect' = 'edit'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas indisponible.');
  context.fillStyle = '#000';
  context.fillRect(0, 0, image.width, image.height);
  const ordered = kind === 'protect' ? regions.filter(r => r.kind === 'protect') : [...regions.filter(r => r.kind !== 'protect'), ...regions.filter(r => r.kind === 'protect')];
  for (const region of ordered) {
    context.fillStyle = kind === 'edit' && region.kind === 'protect' ? '#000' : '#fff';
    polygonBounds(region.points, image);
    context.beginPath();
    for (const [i, p] of region.points.entries()) {
      if (i === 0) context.moveTo(p.x, p.y);
      else context.lineTo(p.x, p.y);
    }
    context.closePath();
    context.fill('evenodd');
  }
  // Make the mask strictly binary, limiting temporary buffer size.
  for (let y = 0; y < image.height; y += 64) {
    const stripe = context.getImageData(0, y, image.width, Math.min(64, image.height - y));
    for (let i = 0; i < stripe.data.length; i += 4) {
      const value = stripe.data[i] >= 128 ? 255 : 0;
      stripe.data[i] = value;
      stripe.data[i + 1] = value;
      stripe.data[i + 2] = value;
      stripe.data[i + 3] = 255;
    }
    context.putImageData(stripe, 0, y);
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    canvas.width = 0; canvas.height = 0;
    if (blob) resolve(blob);
    else reject(new Error('Échec de l’export du masque.'));
  }, 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
