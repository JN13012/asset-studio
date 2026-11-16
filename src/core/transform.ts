import type { RasterLayer } from './layers';
import type { Point } from './cutout';
import type { Size } from './viewport';

export const HANDLE_AXES = { nw: [-1,-1], n: [0,-1], ne: [1,-1], e: [1,0], se: [1,1], s: [0,1], sw: [-1,1], w: [-1,0] } as const;
export type ResizeHandle = keyof typeof HANDLE_AXES;
export type Handle = ResizeHandle | 'rotate';
export type TransformPatch = Partial<Pick<RasterLayer, 'x' | 'y' | 'scale' | 'stretchX' | 'stretchY' | 'rotation'>>;

const radians = (angle: number) => angle * Math.PI / 180;
const rounded = (value: number) => Math.round(value * 1000) / 1000;
const bounded = (value: number) => Math.max(.01, Math.min(16, value));
const normalize = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;
function rotate(p: Point, angle: number): Point {
  const a = radians(angle);
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

export function layerFrame(layer: RasterLayer, image: Size) {
  return {
    center: { x: layer.x + image.width / 2, y: layer.y + image.height / 2 },
    width: image.width * layer.scale * (layer.stretchX ?? 1),
    height: image.height * layer.scale * (layer.stretchY ?? 1),
  };
}

export function transformFromDrag(layer: RasterLayer, image: Size, handle: Handle, from: Point, to: Point, snap = false): TransformPatch {
  const { center, width, height } = layerFrame(layer, image);
  if (handle === 'rotate') {
    const angle = (p: Point) => Math.atan2(p.y - center.y, p.x - center.x) * 180 / Math.PI;
    if (Math.hypot(to.x - center.x, to.y - center.y) < 0.001) return { rotation: layer.rotation };
    let rotation = normalize(layer.rotation + angle(to) - angle(from));
    if (snap) rotation = Math.round(rotation / 15) * 15;
    return { rotation: rounded(rotation) };
  }
  const [hx, hy] = HANDLE_AXES[handle];
  const delta = rotate({ x: to.x - from.x, y: to.y - from.y }, -layer.rotation);
  let scale = layer.scale;
  let stretchX = layer.stretchX ?? 1;
  let stretchY = layer.stretchY ?? 1;
  if (hx && hy) {
    const vx = hx * width, vy = hy * height;
    const factor = 1 + (delta.x * vx + delta.y * vy) / (vx * vx + vy * vy);
    scale = bounded(layer.scale * factor);
  } else if (hx) {
    stretchX = bounded(stretchX * (1 + hx * delta.x / width));
  } else if (hy) {
    stretchY = bounded(stretchY * (1 + hy * delta.y / height));
  }
  // Hold the opposite corner/edge still, even for rotated layers.
  const newWidth = image.width * scale * stretchX;
  const newHeight = image.height * scale * stretchY;
  const shift = rotate({ x: hx * (newWidth - width) / 2, y: hy * (newHeight - height) / 2 }, layer.rotation);
  return { scale, stretchX, stretchY, x: rounded(center.x + shift.x - image.width / 2), y: rounded(center.y + shift.y - image.height / 2) };
}
