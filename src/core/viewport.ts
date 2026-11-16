export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.001;
export const MAX_ZOOM = 16;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function fitScale(image: Size, viewport: Size, padding = 48): number {
  if ([image.width, image.height, viewport.width, viewport.height].some(
    (value) => !Number.isFinite(value) || value <= 0,
  )) return 1;
  const inset = Number.isFinite(padding) ? Math.max(0, padding) : 48;
  const width = Math.max(1, viewport.width - inset * 2);
  const height = Math.max(1, viewport.height - inset * 2);
  return clampZoom(Math.min(1, width / image.width, height / image.height));
}
