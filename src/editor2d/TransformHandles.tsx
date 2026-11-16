import { HANDLE_AXES, layerFrame } from '../core/transform';
import type { ResizeHandle } from '../core/transform';
import type { RasterLayer } from '../core/layers';
import type { Size } from '../core/viewport';
import type { Point } from '../core/cutout';

interface Props {
  layer: RasterLayer;
  image: Size;
  source: Size;
  viewport: Size;
  zoom: number;
  offset: Point;
}
const names: Record<ResizeHandle, string> = { nw: 'haut gauche', n: 'haut', ne: 'haut droite', e: 'droite', se: 'bas droite', s: 'bas', sw: 'bas gauche', w: 'gauche' };
function resizeCursor(x: number, y: number, rotation: number) {
  const angle = Math.atan2(y, x) * 180 / Math.PI + rotation;
  const index = ((Math.round(angle / 45) % 4) + 4) % 4;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][index];
}
export function TransformHandles({ layer, image, source, viewport, zoom, offset }: Props) {
  const frame = layerFrame(layer, image);
  const cx = viewport.width / 2 + offset.x + (frame.center.x - source.width / 2) * zoom;
  const cy = viewport.height / 2 + offset.y + (frame.center.y - source.height / 2) * zoom;
  const w = frame.width * zoom;
  const h = frame.height * zoom;
  return (
    <svg className="transform-overlay" aria-label="Poignées de transformation">
      <g transform={'translate(' + cx + ' ' + cy + ') rotate(' + layer.rotation + ')'}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#60d4ed" strokeWidth="1.25" />
        <line x1="0" y1={-h / 2} x2="0" y2={-h / 2 - 26} stroke="#60d4ed" />
        <circle data-transform-handle="rotate" aria-label="Poignée de rotation" cx="0" cy={-h / 2 - 26} r="6" className="transform-handle" style={{ cursor: 'grab' }}><title>Rotation · Maj : paliers de 15°</title></circle>
        {(Object.keys(HANDLE_AXES) as ResizeHandle[]).map(handle => {
          const [x, y] = HANDLE_AXES[handle];
          // Hide the side handles on tiny frames so corners remain usable.
          if ((!x && w < 30) || (!y && h < 30)) return null;
          return <rect key={handle} data-transform-handle={handle} aria-label={'Poignée ' + names[handle]} className="transform-handle" x={x * w / 2 - 5} y={y * h / 2 - 5} width="10" height="10" rx="1" style={{ cursor: resizeCursor(x, y, layer.rotation) }}><title>{'Redimensionner : ' + names[handle]}</title></rect>;
        })}
      </g>
    </svg>
  );
}
