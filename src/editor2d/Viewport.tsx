import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { SourceImage } from '../core/sourceImage';
import { SOURCE_ID } from '../core/layers';
import type { RasterLayer } from '../core/layers';
import { clampZoom, fitScale, zoomAtPoint } from '../core/viewport';
import { TransformHandles } from './TransformHandles';
import { PerspectiveHandles } from './PerspectiveHandles';
import { GeometryOverlay } from './GeometryOverlay';
import { moveGeometry, moveVertex, insertVertex, removeVertex } from '../core/geometry';
import type { Geometry, GeometryPatch } from '../core/geometry';
import { cornerDelta, IDENTITY_QUAD, moveCorner, rasterTransform } from '../core/perspective';
import { transformFromDrag } from '../core/transform';
import type { Handle, TransformPatch } from '../core/transform';
import type { Size } from '../core/viewport';
import { polygonBounds, sourcePoint } from '../core/cutout';
import { patchPosition } from '../core/repair';
import type { RepairRegion } from '../core/repair';
import type { Point } from '../core/cutout';

export type EditorTool = 'pan' | 'select' | 'lasso' | 'patch' | 'mask' | 'perspective' | 'geometry';
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
  addRepair: (points: Point[], instruction: string, kind: 'edit' | 'protect') => boolean;
  geometry: Geometry[];
  selectedGeometry: string | null;
  addGeometry: (points: Point[], closed: boolean) => boolean;
  selectGeometry: (id: string) => void;
  changeGeometry: (id: string, patch: GeometryPatch) => void;
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

export function Viewport({ source, choose, layers, assets, selected, tool, busy, select, change, copyPolygon, repairs, addRepair, geometry, selectedGeometry, addGeometry, selectGeometry, changeGeometry }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const geometryDrag = useRef<{ pointerId: number; start: Point; shape: Geometry; vertex?: number; points?: Point[] } | null>(null);
  const [geometryDraft, setGeometryDraft] = useState<Geometry | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [vertexIndex, setVertexIndex] = useState<number | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ id: string; patch: TransformPatch } | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [points, setPoints] = useState<Point[]>([]);
  const [picking, setPicking] = useState(false);
  const [destination, setDestination] = useState<Point | null>(null);
  const [instruction, setInstruction] = useState('');
  const [maskKind, setMaskKind] = useState<'edit' | 'protect'>('edit');
  const [selectionError, setSelectionError] = useState('');
  const polygonTool = tool === 'lasso' || tool === 'patch' || tool === 'mask';

  useEffect(() => {
    setPoints([]); setPicking(false); setDestination(null); setInstruction(''); setSelectionError(''); setDrawing(false); setVertexIndex(null); setGeometryDraft(null); geometryDrag.current = null;
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
      if (drag.current || geometryDrag.current) return;
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

  const displayedGeometry = geometry.map(shape => geometryDraft?.id === shape.id ? geometryDraft : shape);
  const activeGeometry = displayedGeometry.find(shape => shape.id === selectedGeometry && shape.visible && !shape.locked);
  function geometryPoint(event: PointerEvent<HTMLDivElement>): Point | null {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !source) return null;
    return sourcePoint({ x: event.clientX, y: event.clientY }, rect, source);
  }
  function finishGeometry() {
    if (addGeometry(points, closed)) {
      setPoints([]); setDrawing(false); setVertexIndex(null);
    }
  }
  function beginGeometry(event: PointerEvent<HTMLDivElement>) {
    if (drawing) {
      const point = geometryPoint(event);
      if (!point) return;
      const snapped = event.shiftKey && source ? { x: Math.min(source.width, Math.round(point.x / 10) * 10), y: Math.min(source.height, Math.round(point.y / 10) * 10) } : point;
      setPoints(previous => previous.length < 256 ? [...previous, snapped] : previous);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest('[data-geometry-id]')?.getAttribute('data-geometry-id');
    const shape = geometry.find(item => item.id === id);
    if (!shape) return;
    selectGeometry(shape.id);
    const value = target?.closest('[data-geometry-vertex]')?.getAttribute('data-geometry-vertex');
    const vertex = value == null ? undefined : Number(value);
    setVertexIndex(vertex ?? null);
    if (shape.locked || !shape.visible) return;
    geometryDrag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, shape, vertex };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!source || busy || event.button !== 0 || drag.current || geometryDrag.current) return;
    event.currentTarget.focus({ preventScroll: true });
    if (tool === 'geometry') { beginGeometry(event); return; }
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
    const g = geometryDrag.current;
    if (g && g.pointerId === event.pointerId && source) {
      const delta = { x: (event.clientX - g.start.x) / scale, y: (event.clientY - g.start.y) / scale };
      if (g.vertex === undefined) g.points = moveGeometry(g.shape.points, delta, source);
      else {
        const original = g.shape.points[g.vertex];
        const point = { x: original.x + delta.x, y: original.y + delta.y };
        if (event.shiftKey) { point.x = Math.round(point.x / 10) * 10; point.y = Math.round(point.y / 10) * 10; }
        g.points = moveVertex(g.shape.points, g.vertex, point, source);
      }
      setGeometryDraft({ ...g.shape, points: g.points });
      return;
    }
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
    const g = geometryDrag.current;
    if (g?.pointerId === event.pointerId) {
      geometryDrag.current = null;
      setGeometryDraft(null);
      if (event.type === 'pointerup' && g.points) changeGeometry(g.shape.id, { points: g.points });
      return;
    }
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
      if (addRepair(points, instruction, maskKind)) { resetSelection(); setInstruction(''); }
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
          if (geometryDrag.current && (event.key === 'Escape' || event.ctrlKey || event.metaKey)) {
            geometryDrag.current = null; setGeometryDraft(null); event.preventDefault(); event.stopPropagation(); return;
          }
          if (tool === 'geometry' && drawing && event.key === 'Escape') { setDrawing(false); setPoints([]); return; }
          if (tool === 'geometry' && drawing && event.key === 'Enter') { event.preventDefault(); finishGeometry(); return; }
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
            <GeometryOverlay shapes={displayedGeometry} selected={selectedGeometry} activeVertex={vertexIndex}
              editable={tool === 'geometry' && !drawing} drawing={tool === 'geometry' && drawing ? points : []} closed={closed} zoom={scale} />
            {polygonTool && (points.length > 0 || (tool === 'mask' && repairs.length > 0)) && (
              <svg className="lasso-overlay" viewBox={'0 0 ' + source.width + ' ' + source.height} aria-hidden="true">
                {tool === 'mask' && repairs.map(region => (
                  <polygon key={region.id} points={region.points.map(p => p.x + ',' + p.y).join(' ')} fill={region.kind === 'protect' ? '#75e0a4' : '#ef7366'} fillOpacity=".28" stroke={region.kind === 'protect' ? '#75e0a4' : '#ef7366'} strokeWidth={2 / scale} />
                ))}
                {points.length >= 3 && <polygon points={points.map(p => p.x + ',' + p.y).join(' ')} fill={tool === 'mask' ? maskKind === 'protect' ? '#75e0a4' : '#ef7366' : '#60d4ed'} fillOpacity=".16" />}
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
      {source && tool === 'geometry' && (
        <div className="lasso-controls">
          {drawing ? <>
            <span>Cliquer pour tracer · Maj : grille de 10 px · {points.length} sommets</span>
            <button disabled={!points.length} onClick={() => setPoints(previous => previous.slice(0, -1))}>Dernier point</button>
            <button onClick={() => { setDrawing(false); setPoints([]); }}>Annuler le tracé</button>
            <button disabled={points.length < (closed ? 3 : 2) || busy} onClick={finishGeometry}>Valider le tracé</button>
          </> : <>
            <span>Glisser le tracé ou ses sommets. Choisir un sommet pour insérer ou supprimer un point.</span>
            <button disabled={busy} onClick={() => { setPoints([]); setClosed(false); setDrawing(true); }}>Nouvelle ligne</button>
            <button disabled={busy} onClick={() => { setPoints([]); setClosed(true); setDrawing(true); }}>Nouveau polygone</button>
            <button disabled={!activeGeometry || vertexIndex === null || vertexIndex >= activeGeometry.points.length || (!activeGeometry.closed && vertexIndex === activeGeometry.points.length - 1) || activeGeometry.points.length >= 256 || busy}
              onClick={() => { if (activeGeometry && vertexIndex !== null) { changeGeometry(activeGeometry.id, { points: insertVertex(activeGeometry.points, vertexIndex, activeGeometry.closed) }); setVertexIndex(vertexIndex + 1); } }}>Insérer un sommet</button>
            <button disabled={!activeGeometry || vertexIndex === null || vertexIndex >= activeGeometry.points.length || activeGeometry.points.length <= (activeGeometry.closed ? 3 : 2) || busy}
              onClick={() => { if (activeGeometry && vertexIndex !== null) { changeGeometry(activeGeometry.id, { points: removeVertex(activeGeometry.points, vertexIndex, activeGeometry.closed) }); setVertexIndex(null); } }}>Supprimer le sommet</button>
          </>}
        </div>
      )}
      {source && tool === 'perspective' && (
        <div className="lasso-controls"><span>{active ? 'Glisser un sommet orange pour déformer le calque.' : 'Sélectionner un calque visible et déverrouillé.'}</span>
          <button disabled={!active?.quad || busy} onClick={() => active && change(active.id, { quad: null })}>Réinitialiser la perspective</button>
        </div>
      )}
      {source && polygonTool && (
        <div className="lasso-controls">
          <span>{tool === 'patch' && picking ? 'Cliquer sur le coin supérieur gauche de la zone à recouvrir (contour vert).' : tool === 'mask' ? 'Délimiter une zone à reconstruire' : tool === 'patch' ? 'Délimiter une texture propre sur la source' : 'Tracer les contours sur l’image source'} · {points.length} sommets</span>
          {tool === 'mask' && <label>Type de zone <select value={maskKind} onChange={event => setMaskKind(event.currentTarget.value === 'protect' ? 'protect' : 'edit')}><option value="edit">Reconstruire</option><option value="protect">Protéger</option></select></label>}
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
        <span>{tool === 'patch' || tool === 'lasso' ? 'Prélèvement sur la source originale' : tool === 'mask' ? 'Rouge : reconstruire · Vert : protéger' : tool === 'geometry' ? 'Tracés vectoriels · Molette : zoom' : tool === 'perspective' ? 'Déformation projective · Molette : zoom' : tool === 'select' ? 'Glisser le calque ou ses poignées · Molette : zoom' : 'Glisser pour déplacer la vue · Molette : zoom'}</span>
      </div>
    </>
  );
}
