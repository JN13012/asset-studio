import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { loadSourceImage } from '../core/sourceImage';
import type { SourceImage } from '../core/sourceImage';
import { Viewport } from '../editor2d/Viewport';

export function App() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const current = useRef<SourceImage | null>(null);

  useEffect(() => () => {
    request.current += 1;
    if (current.current) URL.revokeObjectURL(current.current.url);
    current.current = null;
  }, []);

  async function openFile(file: File) {
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
      current.current = next;
      setSource(next);
      if (previous) URL.revokeObjectURL(previous.url);
    } catch (err) {
      if (id === request.current) {
        setError(err instanceof Error ? err.message : 'Échec de l’import.');
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void openFile(file);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void openFile(file);
  }

  const choose = () => input.current?.click();

  return (
    <div className="studio" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <header className="topbar">
        <strong className="brand">ASSET<span> STUDIO</span></strong>
        <button onClick={choose}>Importer une image</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onInput} />
        <span className="spacer" />
        <span className="tag">M0 · prototype local</span>
      </header>
      <aside className="tools" aria-label="Outils">
        <button title="Déplacer / explorer la vue" aria-label="Déplacement de la vue" className="active">✥</button>
        <button disabled title="Sélection — M1/M3" aria-label="Sélection, non disponible">▧</button>
        <button disabled title="Annotation — M2" aria-label="Annotation, non disponible">✎</button>
        <button disabled title="Géométrie — M4" aria-label="Géométrie, non disponible">◇</button>
      </aside>
      <main className="workspace">
        <div className="document-tab">{source?.file.name ?? 'Aucun document'}</div>
        {error && <div role="alert" className="error">{error}</div>}
        {loading && <div role="status" className="notice">Lecture de l’image…</div>}
        <Viewport key={source?.url ?? 'empty'} source={source} choose={choose} />
      </main>
      <aside className="inspector" aria-label="Propriétés du document">
        <section>
          <h2>Calques</h2>
          {source ? <div className="layer"><span>▣</span><span>Image source</span><small>Verrouillée</small></div> : <p>Aucun calque.</p>}
        </section>
        <section>
          <h2>Propriétés</h2>
          <dl>
            <dt>Largeur</dt><dd>{source ? source.width + ' px' : '—'}</dd>
            <dt>Hauteur</dt><dd>{source ? source.height + ' px' : '—'}</dd>
            <dt>Format</dt><dd>{source?.file.type ?? '—'}</dd>
            <dt>Fichier</dt><dd>{source ? (source.file.size / 1048576).toFixed(2) + ' Mio' : '—'}</dd>
          </dl>
        </section>
        <section><h2>AI Handoff</h2><p>Annotation et export manuel prévus en M2.</p></section>
      </aside>
      <footer className="status"><span>Local · aucune transmission externe</span><span>{source ? source.width + ' × ' + source.height + ' px' : 'Prêt'}</span></footer>
    </div>
  );
}
