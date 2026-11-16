import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { SourceImage } from '../core/sourceImage';
import { SOURCE_ID } from '../core/layers';
import type { RasterLayer } from '../core/layers';
import { clampZoom, fitScale, zoomAtPoint } from '../core/viewport';
import { TransformHandles } from './TransformHandles';
import { PerspectiveHandles } from './PerspectiveHandles';
import { cornerDelta, IDENTITY_QUAD, moveCorner, rasterTransform } from '../core/perspective';
import { transformFromDrag } from '../core/transform';
import type { Handle, TransformPatch } from '../core/transform';
import type { Size } from '../core/viewport';
import { polygonBounds, sourcePoint } from '../core/cutout';
import { patchPosition } from '../core/repair';
import type { RepairRegion } from '../core/repair';
import type { Point } from '../core/cutout';

export type EditorTool = 'pan' | 'select' | 'lasso' | 'patch' | 'mask' | 'perspective';
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
  copyPolygon: (points: Point[], destination?: Point) => Promise<boolean>;
  repairs: RepairRegion[];
  addRepair: (points: Point[], instruction: string) => boolean;
}
interface Drag {
  pointerId: number;
  start: Point;
  offset: Point;
  layerId?: string;
  scale: number;
  original?: RasterLayer;
  image?: Size;
  handle?: Handle;
  corner?: number;
  patch?: TransformPatch;
}

export function Viewport({ source, choose, layers, assets, selected, tool, busy, select, change, copyPolygon, repairs, addRepair }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ id: string; patch: TransformPatch } | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [points, setPoints] = useState<Point[]>([]);
  const [picking, setPicking] = useState(false);
  const [destination, setDestination] = useState<Point | null>(null);
  const [instruction, setInstruction] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const polygonTool = tool === 'lasso' || tool === 'patch' || tool === 'mask';

  useEffect(() => {
    setPoints([]); setPicking(false); setDestination(null); setInstruction(''); setSelectionError('');
  }, [tool]);

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

  useEffect(() => {
    const element = area.current;
    if (!element || !source) return;
    let currentZoom = scale;
    let currentOffset = offset;
    function wheel(event: WheelEvent) {
      if (event.deltaY === 0) return;
      event.preventDefault();
      if (drag.current) return;
      const rect = element!.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const next = zoomAtPoint(currentZoom, currentOffset, {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }, Math.exp(-Math.max(-500, Math.min(500, delta)) * 0.0018));
      currentZoom = next.zoom;
      currentOffset = next.offset;
      setZoom(next.zoom);
      setOffset(next.offset);
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [source, scale, offset]);

  const visualLayers = layers.map(layer => draft?.id === layer.id ? { ...layer, ...draft.patch } : layer);
  const active = visualLayers.find(layer => layer.id === selected && !layer.locked && layer.visible);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!source || busy || event.button !== 0 || drag.current) return;
    event.currentTarget.focus({ preventScroll: true });
    if (polygonTool) {
      const rect = stage.current?.getBoundingClientRect();
      if (!rect) return;
      const point = sourcePoint({ x: event.clientX, y: event.clientY }, rect, source);
      if (point) {
        if (tool === 'patch' && picking) {
          try {
            setDestination(patchPosition(points, point, source));
            setSelectionError('');
          } catch (error) {
            setSelectionError(error instanceof Error ? error.message : 'Destination invalide.');
          }
        } else {
          setPoints(previous => previous.length < 2048 ? [...previous, point] : previous);
          setSelectionError('');
        }
      }
      return;
    }
    const start = { x: event.clientX, y: event.clientY };
    if (tool === 'select' || tool === 'perspective') {
      const target = event.target instanceof Element ? event.target : null;
      const handle = target?.closest('[data-transform-handle]')?.getAttribute('data-transform-handle') as Handle | null | undefined;
      const cornerValue = target?.closest('[data-perspective-corner]')?.getAttribute('data-perspective-corner');
      const corner = cornerValue == null ? undefined : Number(cornerValue);
      const layerId = handle || corner !== undefined ? selected : target?.closest('[data-layer-id]')?.getAttribute('data-layer-id');
      const layer = layers.find(item => item.id === layerId);
      if (!layer) return;
      select(layer.id);
      if (layer.locked || !layer.visible) return;
      drag.current = { pointerId: event.pointerId, start, offset: { x: layer.x, y: layer.y }, layerId: layer.id, scale, original: layer, image: assets[layer.id], handle: handle ?? undefined, corner };
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
    if (value.layerId) {
      let patch: TransformPatch = { x: Math.round(x), y: Math.round(y) };
      if (value.corner !== undefined && value.original && value.image) {
        const delta = cornerDelta(value.original, value.image, { x: (event.clientX - value.start.x) / value.scale, y: (event.clientY - value.start.y) / value.scale });
        patch = { quad: moveCorner(value.original.quad ?? IDENTITY_QUAD, value.corner, delta) };
      } else if (value.handle && value.original && value.image) {
        const rect = stage.current?.getBoundingClientRect();
        if (!rect) return;
        const from = { x: (value.start.x - rect.left) / value.scale, y: (value.start.y - rect.top) / value.scale };
        const to = { x: (event.clientX - rect.left) / value.scale, y: (event.clientY - rect.top) / value.scale };
        patch = transformFromDrag(value.original, value.image, value.handle, from, to, event.shiftKey);
      }
      value.patch = patch;
      setDraft({ id: value.layerId, patch });
    } else setOffset({ x, y });
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    const value = drag.current;
    if (!value || value.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.type === 'pointerup' && value.layerId && value.patch) change(value.layerId, value.patch);
    setDraft(null);
  }
  function fit() {
    setZoom(null);
    setOffset({ x: 0, y: 0 });
  }
  function resetSelection() {
    setPoints([]); setPicking(false); setDestination(null); setSelectionError('');
  }
  function chooseDestination() {
    if (!source) return;
    try {
      polygonBounds(points, source);
      setPicking(true); setSelectionError('');
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Sélection invalide.');
    }
  }
  async function extract() {
    if (busy || points.length < 3) return;
    if (tool === 'mask') {
      if (addRepair(points, instruction)) { resetSelection(); setInstruction(''); }
    } else if (tool === 'patch') {
      if (!picking) { chooseDestination(); return; }
      if (destination && await copyPolygon(points, destination)) resetSelection();
    } else if (await copyPolygon(points)) resetSelection();
  }

  let targetPoints: Point[] = [];
  if (tool === 'patch' && source && destination && points.length >= 3) {
    const bounds = polygonBounds(points, source);
    targetPoints = points.map(p => ({ x: p.x - bounds.x + destination.x, y: p.y - bounds.y + destination.y }));
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
          if (drag.current && (event.key === 'Escape' || event.ctrlKey || event.metaKey)) {
            drag.current = null;
            setDraft(null);
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (!polygonTool) return;
          if (event.key === 'Escape') resetSelection();
          if (event.key === 'Enter') { event.preventDefault(); void extract(); }
        }}
      >
        {source ? (
          <div ref={stage} className="image-stage" style={{
            width: source.width,
            height: source.height,
            transform: 'translate(-50%, -50%) translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + scale + ')',
          }}>
            {visualLayers.map(layer => {
              const asset = assets[layer.id];
              return (
                <img key={layer.id} src={asset.url} data-layer-id={layer.id}
                  alt={layer.id === SOURCE_ID ? 'Image source du document' : layer.name}
                  draggable={false} hidden={!layer.visible}
                  style={{
                    width: asset.width, height: asset.height,
                    left: layer.x, top: layer.y, opacity: layer.opacity,
                    ...rasterTransform(layer, asset),
                  }} />
              );
            })}
            {polygonTool && (points.length > 0 || (tool === 'mask' && repairs.length > 0)) && (
              <svg className="lasso-overlay" viewBox={'0 0 ' + source.width + ' ' + source.height} aria-hidden="true">
                {tool === 'mask' && repairs.map(region => (
                  <polygon key={region.id} points={region.points.map(p => p.x + ',' + p.y).join(' ')} fill="#ef7366" fillOpacity=".28" stroke="#ef7366" strokeWidth={2 / scale} />
                ))}
                {points.length >= 3 && <polygon points={points.map(p => p.x + ',' + p.y).join(' ')} fill={tool === 'mask' ? '#ef7366' : '#60d4ed'} fillOpacity=".16" />}
                {points.length > 0 && <polyline points={points.map(p => p.x + ',' + p.y).join(' ')} stroke={tool === 'mask' ? '#ef7366' : '#60d4ed'} strokeWidth={2 / scale} fill="none" />}
                {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5 / scale} fill="#e6faff" stroke="#307d97" strokeWidth={1 / scale} />)}
                {targetPoints.length > 0 && <polygon points={targetPoints.map(p => p.x + ',' + p.y).join(' ')} fill="#75e0a4" fillOpacity=".24" stroke="#75e0a4" strokeWidth={2 / scale} />}
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
        {source && active && tool === 'perspective' && (
          <PerspectiveHandles layer={active} image={assets[active.id]} source={source} viewport={size} zoom={scale} offset={offset} />
        )}
        {source && active && tool === 'select' && (
          <TransformHandles layer={active} image={assets[active.id]} source={source} viewport={size} zoom={scale} offset={offset} />
        )}
      </div>
      {source && tool === 'perspective' && (
        <div className="lasso-controls"><span>{active ? 'Glisser un sommet orange pour déformer le calque.' : 'Sélectionner un calque visible et déverrouillé.'}</span>
          <button disabled={!active?.quad || busy} onClick={() => active && change(active.id, { quad: null })}>Réinitialiser la perspective</button>
        </div>
      )}
      {source && polygonTool && (
        <div className="lasso-controls">
          <span>{tool === 'patch' && picking ? 'Cliquer sur le coin supérieur gauche de la zone à recouvrir (contour vert).' : tool === 'mask' ? 'Délimiter une zone à reconstruire' : tool === 'patch' ? 'Délimiter une texture propre sur la source' : 'Tracer les contours sur l’image source'} · {points.length} sommets</span>
          {tool === 'mask' && <label className="repair-instruction">Instruction <input value={instruction} maxLength={1000} placeholder="Ex. Remplacer la grue par du béton" onChange={event => setInstruction(event.currentTarget.value)} /></label>}
          <button disabled={!points.length || busy || picking} onClick={() => setPoints(previous => previous.slice(0, -1))}>Dernier point</button>
          <button disabled={!points.length || busy} onClick={resetSelection}>Annuler la sélection</button>
          <button disabled={points.length < 3 || busy || (tool === 'patch' && picking && !destination)} onClick={() => void extract()}>{tool === 'patch' ? picking ? 'Appliquer le patch' : 'Choisir la destination' : tool === 'mask' ? 'Ajouter la zone' : 'Copier en calque'}</button>
          {selectionError && <div role="alert" className="selection-error">{selectionError}</div>}
        </div>
      )}
      <div className="view-controls" aria-label="Contrôles de la vue">
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale / 1.25))} aria-label="Zoom arrière">−</button>
        <output aria-label="Niveau de zoom">{source ? (scale * 100).toFixed(scale < 0.1 ? 1 : 0) + ' %' : '—'}</output>
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale * 1.25))} aria-label="Zoom avant">+</button>
        <button disabled={!source} onClick={fit}>Ajuster</button>
        <button disabled={!source} onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>100 %</button>
        <span>{tool === 'patch' || tool === 'lasso' ? 'Prélèvement sur la source originale' : tool === 'mask' ? 'Zones rouges : reconstruction demandée' : tool === 'perspective' ? 'Déformation projective · Molette : zoom' : tool === 'select' ? 'Glisser le calque ou ses poignées · Molette : zoom' : 'Glisser pour déplacer la vue · Molette : zoom'}</span>
      </div>
    </>
  );
}
