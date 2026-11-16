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
import type { RepairRegion } from '../core/repair';
import { RepairPanel } from '../editor2d/RepairPanel';
import type { Point } from '../core/cutout';
import type { EditorTool } from '../editor2d/Viewport';

interface DocumentState {
  source: SourceImage;
  layers: RasterLayer[];
  assets: Record<string, SourceImage>;
  selected: string;
  repairs: RepairRegion[];
}
type ImportMode = 'source' | 'layer';

export function App() {
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [error, setError] = useState('');
  const [tool, setTool] = useState<EditorTool>('pan');
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const current = useRef<DocumentState | null>(null);
  const importMode = useRef<ImportMode>('source');
  const source = document?.source ?? null;

  useEffect(() => () => {
    request.current += 1;
    for (const image of Object.values(current.current?.assets ?? {})) URL.revokeObjectURL(image.url);
    current.current = null;
  }, []);

  function commit(next: DocumentState) {
    current.current = next;
    setDocument(next);
  }

  async function openFile(file: File, mode: ImportMode) {
    const existing = current.current;
    if (mode === 'layer' && !existing) return;
    if (mode === 'source' && existing && (existing.layers.length > 1 || existing.repairs.length > 0) &&
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
        commit({ source: next, layers: [createLayer(SOURCE_ID, 'Image source', next, next)], assets: { [SOURCE_ID]: next }, selected: SOURCE_ID, repairs: [] });
        for (const image of Object.values(previous?.assets ?? {})) URL.revokeObjectURL(image.url);
      }
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : 'Échec de l’import.');
    } finally {
      if (id === request.current) setLoading(false);
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
    if (file) void openFile(file, 'source');
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
    if (!doc) return false;
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
    if (doc) commit({ ...doc, repairs: doc.repairs.filter(region => region.id !== id) });
  }

  function selectLayer(id: string) {
    const doc = current.current;
    if (doc && doc.layers.some(layer => layer.id === id)) commit({ ...doc, selected: id });
  }

  function changeLayer(id: string, patch: Partial<Omit<RasterLayer, 'id'>>) {
    const doc = current.current;
    if (doc) commit({ ...doc, layers: updateLayer(doc.layers, id, patch) });
  }
  function moveLayer(id: string, direction: -1 | 1) {
    const doc = current.current;
    if (doc) commit({ ...doc, layers: reorderLayer(doc.layers, id, direction) });
  }
  function deleteLayer(id: string) {
    const doc = current.current;
    if (!doc) return;
    const layers = removeLayer(doc.layers, id);
    if (layers === doc.layers) return;
    const assets = { ...doc.assets };
    URL.revokeObjectURL(assets[id].url);
    delete assets[id];
    commit({ ...doc, layers, assets, selected: doc.selected === id ? layers[layers.length - 1].id : doc.selected });
  }

  return (
    <div className="studio" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
      <header className="topbar">
        <strong className="brand">ASSET<span> STUDIO</span></strong>
        <button onClick={() => choose()}>Importer une image</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onInput} />
        <span className="spacer" />
        <span className="tag">M1.3 · reconstruction locale</span>
      </header>
      <aside className="tools" aria-label="Outils">
        <button title="Déplacer la vue" aria-label="Déplacement de la vue" aria-pressed={tool === 'pan'} className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')}>✥</button>
        <button disabled={!source || loading} title="Sélectionner et déplacer un calque" aria-label="Sélection et déplacement" aria-pressed={tool === 'select'} className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖</button>
        <button disabled={!source || loading} title="Lasso polygonal — copier un objet de la source" aria-label="Lasso polygonal" aria-pressed={tool === 'lasso'} className={tool === 'lasso' ? 'active' : ''} onClick={() => setTool('lasso')}>⬠</button>
        <button disabled={!source || loading} title="Patch : copier une texture" aria-label="Patch polygonal" aria-pressed={tool === 'patch'} className={tool === 'patch' ? 'active' : ''} onClick={() => setTool('patch')}>▧</button>
        <button disabled={!source || loading} title="Masque de reconstruction" aria-label="Masque de reconstruction" aria-pressed={tool === 'mask'} className={tool === 'mask' ? 'active' : ''} onClick={() => setTool('mask')}>✎</button>
        <button disabled title="Géométrie — M1.4" aria-label="Géométrie, non disponible">◇</button>
      </aside>
      <main className="workspace">
        <div className="document-tab">{source?.file.name ?? 'Aucun document'}</div>
        {error && <div role="alert" className="error">{error}</div>}
        {loading && <div role="status" className="notice">Lecture de l’image…</div>}
        <Viewport key={source?.url ?? 'empty'} source={source} choose={() => choose()} layers={document?.layers ?? []} assets={document?.assets ?? {}} selected={document?.selected ?? ''} tool={tool} busy={loading} select={selectLayer} change={changeLayer} copyPolygon={copyPolygon} repairs={document?.repairs ?? []} addRepair={addRepair} />
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
        <RepairPanel source={source} repairs={document?.repairs ?? []} remove={deleteRepair} report={setError} />
        <section><p>Calques temporaires : sauvegarde à venir.</p></section>
      </aside>
      <footer className="status"><span>Local · aucune transmission externe</span><span>{source ? source.width + ' × ' + source.height + ' px' : 'Prêt'}</span></footer>
    </div>
  );
}
