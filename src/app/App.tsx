import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { loadSourceImage } from '../core/sourceImage';
import type { SourceImage } from '../core/sourceImage';
import { createLayer, MAX_DOCUMENT_PIXELS, MAX_LAYERS, removeLayer, reorderLayer, SOURCE_ID, updateLayer } from '../core/layers';
import type { RasterLayer } from '../core/layers';
import { Viewport } from '../editor2d/Viewport';
import { LayerPanel } from '../editor2d/LayerPanel';

interface DocumentState {
  source: SourceImage;
  layers: RasterLayer[];
  assets: Record<string, SourceImage>;
  selected: string;
}
type ImportMode = 'source' | 'layer';

export function App() {
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [error, setError] = useState('');
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
    if (mode === 'source' && existing && existing.layers.length > 1 &&
        !window.confirm('Remplacer le document et perdre les calques non sauvegardés ?')) return;
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
        commit({ source: next, layers: [createLayer(SOURCE_ID, 'Image source', next, next)], assets: { [SOURCE_ID]: next }, selected: SOURCE_ID });
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
        <span className="tag">M1 · édition locale</span>
      </header>
      <aside className="tools" aria-label="Outils">
        <button title="Déplacer / explorer la vue" aria-label="Déplacement de la vue" className="active">✥</button>
        <button disabled title="Sélection sur image — M1.3" aria-label="Sélection, non disponible">▧</button>
        <button disabled title="Annotation — M2" aria-label="Annotation, non disponible">✎</button>
        <button disabled title="Géométrie — M1.4" aria-label="Géométrie, non disponible">◇</button>
      </aside>
      <main className="workspace">
        <div className="document-tab">{source?.file.name ?? 'Aucun document'}</div>
        {error && <div role="alert" className="error">{error}</div>}
        {loading && <div role="status" className="notice">Lecture de l’image…</div>}
        <Viewport key={source?.url ?? 'empty'} source={source} choose={() => choose()} layers={document?.layers ?? []} assets={document?.assets ?? {}} />
      </main>
      <aside className="inspector" aria-label="Propriétés du document">
        <LayerPanel layers={document?.layers ?? []} selected={document?.selected ?? ''} loading={loading}
          select={id => { const doc = current.current; if (doc) commit({ ...doc, selected: id }); }}
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
        <section><h2>AI Handoff</h2><p>Annotation et export manuel prévus en M2.</p><p>Calques temporaires : sauvegarde à venir.</p></section>
      </aside>
      <footer className="status"><span>Local · aucune transmission externe</span><span>{source ? source.width + ' × ' + source.height + ' px' : 'Prêt'}</span></footer>
    </div>
  );
}
