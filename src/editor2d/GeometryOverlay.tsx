import type { Geometry } from '../core/geometry';
import type { Point } from '../core/cutout';

interface Props {
  shapes: Geometry[];
  selected: string | null;
  activeVertex: number | null;
  editable: boolean;
  drawing: Point[];
  closed: boolean;
  zoom: number;
}
const coords = (points: Point[]) => points.map(p => p.x + ',' + p.y).join(' ');

export function GeometryOverlay({ shapes, selected, activeVertex, editable, drawing, closed, zoom }: Props) {
  const active = shapes.find(s => s.id === selected && s.visible && !s.locked);
  return (
    <svg className="geometry-overlay" aria-label="Tracés vectoriels">
      {shapes.filter(shape => shape.visible).map(shape => {
        const props = {
          'data-geometry-id': shape.id,
          'aria-label': shape.name,
          points: coords(shape.points),
          stroke: shape.stroke, strokeWidth: shape.strokeWidth, opacity: shape.opacity,
          strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const,
          className: editable ? 'geometry-target' : undefined,
        };
        return shape.closed ? <polygon key={shape.id} {...props} fill={shape.fill} fillRule="evenodd" /> : <polyline key={shape.id} {...props} fill="none" />;
      })}
      {editable && active && <g data-geometry-id={active.id}>
        {active.closed
          ? <polygon points={coords(active.points)} fill="none" stroke="#61d9e9" strokeWidth={1.5 / zoom} strokeDasharray={4/zoom + ' ' + 3/zoom} />
          : <polyline points={coords(active.points)} fill="none" stroke="#61d9e9" strokeWidth={1.5 / zoom} strokeDasharray={4/zoom + ' ' + 3/zoom} />}
        {active.points.map((p,i) => <circle key={i} data-geometry-vertex={i} aria-label={'Sommet vectoriel ' + (i+1)}
          cx={p.x} cy={p.y} r={6/zoom} strokeWidth={1.5/zoom} className="geometry-vertex" fill={activeVertex === i ? '#f9b76a' : '#e1f7fc'} />)}
      </g>}
      {drawing.length > 0 && <>
        {closed && drawing.length >= 3 && <polygon points={coords(drawing)} fill="#61d9e9" fillOpacity=".15" />}
        <polyline points={coords(drawing)} fill="none" stroke="#61d9e9" strokeWidth={2/zoom} />
        {drawing.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={4/zoom} fill="#61d9e9" />)}
      </>}
    </svg>
  );
}
