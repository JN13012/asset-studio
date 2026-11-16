import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { loadSourceImage } from '../core/sourceImage';
import type { SourceImage } from '../core/sourceImage';
import { createLayer, MAX_DOCUMENT_PIXELS, MAX_LAYERS, removeLayer, reorderLayer, SOURCE_ID, updateLayer } from '../core/layers';
import type { RasterLayer } from '../core/layers';
import { Viewport } from '../editor2d/Viewport';
import { LayerPanel } from '../editor2d/LayerPanel';
import { extractPolygon } from '../core/cutout';
import { createRepairRegion, patchPosition } from '../core/repair';
import { RepairPanel } from '../editor2d/RepairPanel';
import { GeometryPanel } from '../editor2d/GeometryPanel';
import { readProject, saveProject, projectFilename } from '../core/project';
import { renderComposite, compositeFilename } from '../core/composite';
import type { DocumentState } from '../core/project';
import { downloadBlob } from '../core/repair';
import { createGeometry, updateGeometry } from '../core/geometry';
import type { GeometryPatch } from '../core/geometry';
import { emptyHistory, recordHistory, stepHistory, trimHistory } from '../core/history';
import type { History } from '../core/history';
import type { Point } from '../core/cutout';
import type { EditorTool } from '../editor2d/Viewport';

type ImportMode = 'source' | 'layer';

function retainedAssets(doc: DocumentState | null, history: History<DocumentState>) {
  const images = new Map<string, SourceImage>();
  for (const snapshot of [...history.past, ...history.future, ...(doc ? [doc] : [])]) {
    for (const image of Object.values(snapshot.assets)) images.set(image.url, image);
  }
  return images;
}
function retainedPixels(doc: DocumentState, history: History<DocumentState>) {
  return [...retainedAssets(doc, history).values()].reduce((sum, image) => sum + image.width * image.height, 0);
}

export function App() {
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [error, setError] = useState('');
  const [tool, setTool] = useState<EditorTool>('pan');
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const current = useRef<DocumentState | null>(null);
  const timeline = useRef<History<DocumentState>>(emptyHistory());
  const [availability, setAvailability] = useState({ undo: false, redo: false });
  const importMode = useRef<ImportMode>('source');
  const source = document?.source ?? null;

  useEffect(() => () => {
    request.current += 1;
    for (const url of retainedAssets(current.current, timeline.current).keys()) URL.revokeObjectURL(url);
    current.current = null;
    timeline.current = emptyHistory();
  }, []);

  function applyState(next: DocumentState, history: History<DocumentState>) {
    const previous = retainedAssets(current.current, timeline.current);
    const retained = retainedAssets(next, history);
    current.current = next;
    timeline.current = history;
    setDocument(next);
    setAvailability({ undo: history.past.length > 0, redo: history.future.length > 0 });
    for (const url of previous.keys()) if (!retained.has(url)) URL.revokeObjectURL(url);
  }

  function commit(next: DocumentState, mode: 'edit' | 'selection' | 'reset' = 'edit') {
    const previous = current.current;
    let history = timeline.current;
    if (mode === 'reset') history = emptyHistory();
    else if (mode === 'edit' && previous) {
      if (next.layers === previous.layers && next.assets === previous.assets && next.repairs === previous.repairs && next.geometry === previous.geometry) return;
      history = recordHistory(history, previous);
      history = trimHistory(history, candidate => retainedPixels(next, candidate) <= 256_000_000);
    }
    applyState(next, history);
  }

  function restore(direction: 'undo' | 'redo') {
    const doc = current.current;
    if (!doc || loading) return;
    const result = stepHistory(timeline.current, doc, direction);
    if (result) applyState(result.current, result.history);
  }

  async function openFile(file: File, mode: ImportMode) {
    if (loading) return;
    const existing = current.current;
    if (mode === 'layer' && !existing) return;
    if (mode === 'source' && existing && (existing.layers.length > 1 || existing.repairs.length > 0 || existing.geometry.length > 0 || timeline.current.past.length > 0) &&
        !window.confirm('Remplacer le document et perdre les modifications non sauvegardées ?')) return;
    if (mode === 'layer' && existing && existing.layers.length >= MAX_LAYERS) {
      setError('Limite de 32 calques atteinte.'); return;
    }
    const id = ++request.current;
    setError('');
    setLoading(true);
    try {
      const next = await loadSourceImage(file);
      if (id !== request.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      const previous = current.current;
      if (mode === 'layer' && previous) {
        const used = Object.values(previous.assets).reduce((sum, asset) => sum + asset.width * asset.height, 0);
        if (used + next.width * next.height > MAX_DOCUMENT_PIXELS) {
          URL.revokeObjectURL(next.url);
          throw new Error('Limite cumulée de 128 mégapixels atteinte.');
        }
        const layerId = crypto.randomUUID();
        const layer = createLayer(layerId, file.name, next, previous.source);
        commit({ ...previous, layers: [...previous.layers, layer], assets: { ...previous.assets, [layerId]: next }, selected: layerId });
      } else {
        setTool('pan');
        commit({ source: next, layers: [createLayer(SOURCE_ID, 'Image source', next, next)], assets: { [SOURCE_ID]: next }, selected: SOURCE_ID, repairs: [], geometry: [], selectedGeometry: null }, 'reset');
      }
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : 'Échec de l’import.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  async function openProject(file: File) {
    if (loading) return;
    if (current.current && !window.confirm('Remplacer le projet ouvert ? Les modifications non enregistrées seront perdues.')) return;
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const next = await readProject(file);
      if (id !== request.current) {
        for (const asset of Object.values(next.assets)) URL.revokeObjectURL(asset.url);
        return;
      }
      setTool('pan');
      commit(next, 'reset');
    } catch (error) {
      if (id === request.current) setError(error instanceof Error ? error.message : 'Projet illisible.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  function downloadProject() {
    const doc = current.current;
    if (!doc || loading) return;
    try {
      downloadBlob(saveProject(doc), projectFilename(doc.source.file.name));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Échec de la sauvegarde.');
    }
  }

  async function exportPNG() {
    const doc = current.current;
    if (!doc || loading) return;
    setLoading(true); setError('');
    try {
      downloadBlob(await renderComposite(doc), compositeFilename(doc.source.file.name));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Échec de l’export PNG.');
    } finally {
      setLoading(false);
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void openFile(file, importMode.current);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.assetstudio')) void openProject(file);
      else void openFile(file, 'source');
    }
  }

  function choose(mode: ImportMode = 'source') {
    importMode.current = mode;
    input.current?.click();
  }

  async function copyPolygon(points: Point[], destination?: Point): Promise<boolean> {
    const doc = current.current;
    if (!doc || loading) return false;
    if (doc.layers.length >= MAX_LAYERS) {
      setError('Limite de 32 calques atteinte.'); return false;
    }
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const used = Object.values(doc.assets).reduce((sum, asset) => sum + asset.width * asset.height, 0);
      const position = destination ? patchPosition(points, destination, doc.source) : null;
      const result = await extractPolygon(doc.source, points, MAX_DOCUMENT_PIXELS - used);
      const previous = current.current;
      if (id !== request.current || !previous || previous.source !== doc.source) {
        URL.revokeObjectURL(result.image.url);
        return false;
      }
      const layerId = crypto.randomUUID();
      const layer: RasterLayer = { ...createLayer(layerId, position ? 'Patch de reconstruction' : 'Objet détouré', result.image, previous.source), x: position?.x ?? result.x, y: position?.y ?? result.y, kind: position ? 'patch' : 'image' };
      const layers = [...previous.layers];
      // Put repairs behind foreground objects, above existing patches.
      const firstObject = layers.findIndex((item, index) => index > 0 && item.kind !== 'patch');
      layers.splice(position && firstObject !== -1 ? firstObject : layers.length, 0, layer);
      commit({ ...previous, layers, assets: { ...previous.assets, [layerId]: result.image }, selected: layerId });
      setTool('select');
      return true;
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : 'Échec du détourage.');
      return false;
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  function addRepair(points: Point[], instruction: string): boolean {
    const doc = current.current;
    if (!doc || loading) return false;
    try {
      if (doc.repairs.length >= 64) throw new Error('Limite de 64 zones de reconstruction atteinte.');
      const region = createRepairRegion(crypto.randomUUID(), points, instruction, doc.source);
      commit({ ...doc, repairs: [...doc.repairs, region] });
      setError('');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zone invalide.');
      return false;
    }
  }

  function deleteRepair(id: string) {
    const doc = current.current;
    if (doc && !loading) commit({ ...doc, repairs: doc.repairs.filter(region => region.id !== id) });
  }

  function addGeometry(points: Point[], closed: boolean): boolean {
    const doc = current.current;
    if (!doc || loading) return false;
    try {
      if (doc.geometry.length >= 64) throw new Error('Limite de 64 tracés atteinte.');
      const shape = createGeometry(crypto.randomUUID(), points, closed, doc.source);
      commit({ ...doc, geometry: [...doc.geometry, shape], selectedGeometry: shape.id });
      setError('');
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Tracé invalide.');
      return false;
    }
  }

  function selectGeometry(id: string) {
    const doc = current.current;
    if (doc && doc.geometry.some(shape => shape.id === id)) commit({ ...doc, selectedGeometry: id }, 'selection');
  }

  function changeGeometry(id: string, patch: GeometryPatch) {
    const doc = current.current;
    if (!doc || loading) return;
    try {
      const geometry = updateGeometry(doc.geometry, id, patch, doc.source);
      if (geometry !== doc.geometry) commit({ ...doc, geometry });
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Tracé invalide.');
    }
  }

  function deleteGeometry(id: string) {
    const doc = current.current;
    if (!doc || loading || doc.geometry.find(shape => shape.id === id)?.locked) return;
    const geometry = doc.geometry.filter(shape => shape.id !== id);
    if (geometry.length !== doc.geometry.length) commit({ ...doc, geometry, selectedGeometry: doc.selectedGeometry === id ? null : doc.selectedGeometry });
  }

  function selectLayer(id: string) {
    const doc = current.current;
    if (doc && doc.layers.some(layer => layer.id === id)) commit({ ...doc, selected: id }, 'selection');
  }

  function changeLayer(id: string, patch: Partial<Omit<RasterLayer, 'id'>>) {
    const doc = current.current;
    if (!doc || loading) return;
    const layers = updateLayer(doc.layers, id, patch);
    if (layers.every((layer, i) => JSON.stringify(layer) === JSON.stringify(doc.layers[i]))) return;
    commit({ ...doc, layers });
  }
  function moveLayer(id: string, direction: -1 | 1) {
    const doc = current.current;
    if (doc && !loading) commit({ ...doc, layers: reorderLayer(doc.layers, id, direction) });
  }
  function deleteLayer(id: string) {
    const doc = current.current;
    if (!doc || loading) return;
    const layers = removeLayer(doc.layers, id);
    if (layers === doc.layers) return;
    const assets = { ...doc.assets };
    delete assets[id];
    commit({ ...doc, layers, assets, selected: doc.selected === id ? layers[layers.length - 1].id : doc.selected });
  }

  return (
    <div className="studio" tabIndex={-1} onDragOver={event => event.preventDefault()} onDrop={onDrop}
      onKeyDown={event => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || loading) return;
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
        const key = event.key.toLowerCase();
        if (key === 's') { event.preventDefault(); downloadProject(); return; }
        if (key === 'z' || key === 'y') {
          event.preventDefault();
          restore(key === 'y' || event.shiftKey ? 'redo' : 'undo');
        }
      }}>
      <header className="topbar">
        <strong className="brand">ASSET<span> STUDIO</span></strong>
        <button disabled={loading} onClick={() => choose()}>Importer une image</button>
        <button disabled={loading} onClick={() => projectInput.current?.click()}>Ouvrir un projet</button>
        <input ref={projectInput} type="file" accept=".assetstudio" hidden onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void openProject(file); }} />
        <button disabled={!source || loading} onClick={downloadProject}>Enregistrer le projet</button>
        <button disabled={!source || loading} onClick={() => void exportPNG()}>Exporter PNG</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onInput} />
        <button disabled={!availability.undo || loading} onClick={() => restore('undo')} title="Ctrl+Z">Annuler</button>
        <button disabled={!availability.redo || loading} onClick={() => restore('redo')} title="Ctrl+Y / Ctrl+Maj+Z">Rétablir</button>
        <span className="spacer" />
        <span className="tag">M1.6 · projets</span>
      </header>
      <aside className="tools" aria-label="Outils">
        <button title="Déplacer la vue" aria-label="Déplacement de la vue" aria-pressed={tool === 'pan'} className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')}>✥</button>
        <button disabled={!source || loading} title="Sélectionner et déplacer un calque" aria-label="Sélection et déplacement" aria-pressed={tool === 'select'} className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖</button>
        <button disabled={!source || loading} title="Lasso polygonal — copier un objet de la source" aria-label="Lasso polygonal" aria-pressed={tool === 'lasso'} className={tool === 'lasso' ? 'active' : ''} onClick={() => setTool('lasso')}>⬠</button>
        <button disabled={!source || loading} title="Patch : copier une texture" aria-label="Patch polygonal" aria-pressed={tool === 'patch'} className={tool === 'patch' ? 'active' : ''} onClick={() => setTool('patch')}>▧</button>
        <button disabled={!source || loading} title="Masque de reconstruction" aria-label="Masque de reconstruction" aria-pressed={tool === 'mask'} className={tool === 'mask' ? 'active' : ''} onClick={() => setTool('mask')}>✎</button>
        <button disabled={!source || loading} title="Déformation et perspective" aria-label="Perspective" aria-pressed={tool === 'perspective'} className={tool === 'perspective' ? 'active' : ''} onClick={() => setTool('perspective')}>⛶</button>
        <button disabled={!source || loading} title="Géométrie vectorielle" aria-label="Géométrie vectorielle" aria-pressed={tool === 'geometry'} className={tool === 'geometry' ? 'active' : ''} onClick={() => setTool('geometry')}>◇</button>
      </aside>
      <main className="workspace">
        <div className="document-tab">{source?.file.name ?? 'Aucun document'}</div>
        {error && <div role="alert" className="error">{error}</div>}
        {loading && <div role="status" className="notice">Traitement local…</div>}
        <Viewport key={source?.url ?? 'empty'} source={source} choose={() => choose()} layers={document?.layers ?? []} assets={document?.assets ?? {}} selected={document?.selected ?? ''} tool={tool} busy={loading} select={selectLayer} change={changeLayer} copyPolygon={copyPolygon} repairs={document?.repairs ?? []} addRepair={addRepair} geometry={document?.geometry ?? []} selectedGeometry={document?.selectedGeometry ?? null} addGeometry={addGeometry} selectGeometry={selectGeometry} changeGeometry={changeGeometry} />
      </main>
      <aside className="inspector" aria-label="Propriétés du document">
        <LayerPanel layers={document?.layers ?? []} selected={document?.selected ?? ''} loading={loading}
          select={selectLayer}
          update={changeLayer} reorder={moveLayer} remove={deleteLayer} add={() => choose('layer')} />
        <section>
          <h2>Document</h2>
          <dl>
            <dt>Largeur</dt><dd>{source ? source.width + ' px' : '—'}</dd>
            <dt>Hauteur</dt><dd>{source ? source.height + ' px' : '—'}</dd>
            <dt>Format</dt><dd>{source?.file.type ?? '—'}</dd>
            <dt>Fichier</dt><dd>{source ? (source.file.size / 1048576).toFixed(2) + ' Mio' : '—'}</dd>
          </dl>
        </section>
        <GeometryPanel shapes={document?.geometry ?? []} selected={document?.selectedGeometry ?? null}
          select={id => { selectGeometry(id); setTool('geometry'); }} change={changeGeometry} remove={deleteGeometry} />
        <RepairPanel source={source} repairs={document?.repairs ?? []} remove={deleteRepair} report={setError} />
        <section><p>Enregistrer un projet .assetstudio pour conserver les calques et les tracés éditables.</p></section>
      </aside>
      <footer className="status"><span>Local · aucune transmission externe</span><span>{source ? source.width + ' × ' + source.height + ' px' : 'Prêt'}</span></footer>
    </div>
  );
}
