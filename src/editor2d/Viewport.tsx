import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { SourceImage } from '../core/sourceImage';
import { SOURCE_ID } from '../core/layers';
import type { RasterLayer } from '../core/layers';
import { clampZoom, fitScale } from '../core/viewport';
import type { Size } from '../core/viewport';
import { sourcePoint } from '../core/cutout';
import type { Point } from '../core/cutout';

export type EditorTool = 'pan' | 'select' | 'lasso';
interface Props {
  source: SourceImage | null;
  choose: () => void;
  layers: RasterLayer[];
  assets: Record<string, SourceImage>;
  selected: string;
  tool: EditorTool;
  busy: boolean;
  select: (id: string) => void;
  change: (id: string, patch: Partial<Omit<RasterLayer, 'id'>>) => void;
  copyPolygon: (points: Point[]) => Promise<boolean>;
}
interface Drag {
  pointerId: number;
  start: Point;
  offset: Point;
  layerId?: string;
  scale: number;
}

export function Viewport({ source, choose, layers, assets, selected, tool, busy, select, change, copyPolygon }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const scale = zoom ?? (source ? fitScale(source, size) : 1);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!source || busy || event.button !== 0 || drag.current) return;
    if (tool === 'lasso') {
      const rect = stage.current?.getBoundingClientRect();
      if (!rect) return;
      const point = sourcePoint({ x: event.clientX, y: event.clientY }, rect, source);
      if (point) setPoints(previous => previous.length < 2048 ? [...previous, point] : previous);
      return;
    }
    const start = { x: event.clientX, y: event.clientY };
    if (tool === 'select') {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-layer-id]') : null;
      const layer = layers.find(item => item.id === target?.dataset.layerId);
      if (!layer) return;
      select(layer.id);
      if (layer.locked || !layer.visible) return;
      drag.current = { pointerId: event.pointerId, start, offset: { x: layer.x, y: layer.y }, layerId: layer.id, scale };
    } else {
      drag.current = { pointerId: event.pointerId, start, offset, scale: 1 };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const value = drag.current;
    if (!value || value.pointerId !== event.pointerId) return;
    const x = value.offset.x + (event.clientX - value.start.x) / value.scale;
    const y = value.offset.y + (event.clientY - value.start.y) / value.scale;
    if (value.layerId) change(value.layerId, { x: Math.round(x), y: Math.round(y) });
    else setOffset({ x, y });
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  function fit() {
    setZoom(null);
    setOffset({ x: 0, y: 0 });
  }
  async function extract() {
    if (points.length >= 3 && !busy && await copyPolygon(points)) setPoints([]);
  }

  return (
    <>
      <div
        ref={area}
        className={'viewport' + (source ? ' tool-' + tool + (tool === 'pan' ? ' pannable' : '') : '')}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        tabIndex={source ? 0 : undefined}
        aria-label="Zone de travail"
        onKeyDown={event => {
          if (tool !== 'lasso') return;
          if (event.key === 'Escape') setPoints([]);
          if (event.key === 'Enter') { event.preventDefault(); void extract(); }
        }}
      >
        {source ? (
          <div ref={stage} className="image-stage" style={{
            width: source.width,
            height: source.height,
            transform: 'translate(-50%, -50%) translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + scale + ')',
          }}>
            {layers.map(layer => {
              const asset = assets[layer.id];
              return (
                <img key={layer.id} src={asset.url} data-layer-id={layer.id}
                  alt={layer.id === SOURCE_ID ? 'Image source du document' : layer.name}
                  draggable={false} hidden={!layer.visible}
                  className={tool === 'select' && selected === layer.id && !layer.locked ? 'selected-raster' : undefined}
                  style={{
                    width: asset.width, height: asset.height,
                    left: layer.x, top: layer.y, opacity: layer.opacity,
                    transform: 'rotate(' + layer.rotation + 'deg) scale(' + layer.scale + ')',
                  }} />
              );
            })}
            {tool === 'lasso' && points.length > 0 && (
              <svg className="lasso-overlay" viewBox={'0 0 ' + source.width + ' ' + source.height} aria-hidden="true">
                {points.length >= 3 && <polygon points={points.map(p => p.x + ',' + p.y).join(' ')} fill="#60d4ed" fillOpacity=".12" />}
                <polyline points={points.map(p => p.x + ',' + p.y).join(' ')} stroke="#60d4ed" strokeWidth={2 / scale} fill="none" />
                {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5 / scale} fill="#e6faff" stroke="#307d97" strokeWidth={1 / scale} />)}
              </svg>
            )}
          </div>
        ) : (
          <div className="empty">
            <strong>Importer un asset</strong>
            <p>Glisser une image PNG, JPEG ou WebP dans cet espace.</p>
            <button onClick={choose}>Choisir un fichier</button>
          </div>
        )}
      </div>
      {source && tool === 'lasso' && (
        <div className="lasso-controls">
          <span>Tracer les contours sur l’image source · {points.length} sommets</span>
          <button disabled={!points.length || busy} onClick={() => setPoints(previous => previous.slice(0, -1))}>Dernier point</button>
          <button disabled={!points.length || busy} onClick={() => setPoints([])}>Annuler</button>
          <button disabled={points.length < 3 || busy} onClick={() => void extract()}>Copier en calque</button>
        </div>
      )}
      <div className="view-controls" aria-label="Contrôles de la vue">
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale / 1.25))} aria-label="Zoom arrière">−</button>
        <output aria-label="Niveau de zoom">{source ? (scale * 100).toFixed(scale < 0.1 ? 1 : 0) + ' %' : '—'}</output>
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale * 1.25))} aria-label="Zoom avant">+</button>
        <button disabled={!source} onClick={fit}>Ajuster</button>
        <button disabled={!source} onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>100 %</button>
        <span>{tool === 'lasso' ? 'Copie sur la source originale, même si un autre calque est visible' : tool === 'select' ? 'Glisser un calque déverrouillé' : 'Glisser pour déplacer la vue'}</span>
      </div>
    </>
  );
}
