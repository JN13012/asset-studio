import { cornerWorld, IDENTITY_QUAD } from '../core/perspective';
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
export function PerspectiveHandles({ layer, image, source, viewport, zoom, offset }: Props) {
  const points = (layer.quad ?? IDENTITY_QUAD).map(point => {
    const p = cornerWorld(layer, image, point);
    return {
      x: viewport.width / 2 + offset.x + (p.x - source.width / 2) * zoom,
      y: viewport.height / 2 + offset.y + (p.y - source.height / 2) * zoom,
    };
  });
  return (
    <svg className="transform-overlay" aria-label="Poignées de perspective">
      <polygon points={points.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="#eeb36a" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} data-perspective-corner={i} aria-label={'Sommet de perspective ' + (i + 1)}
          cx={p.x} cy={p.y} r="7" className="perspective-handle"><title>Déplacer ce sommet</title></circle>
      ))}
    </svg>
  );
}
