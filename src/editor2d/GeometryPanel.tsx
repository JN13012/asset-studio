import type { Geometry, GeometryPatch } from '../core/geometry';

interface Props {
  shapes: Geometry[];
  selected: string | null;
  select: (id: string) => void;
  change: (id: string, patch: GeometryPatch) => void;
  remove: (id: string) => void;
}
export function GeometryPanel({ shapes, selected, select, change, remove }: Props) {
  const shape = shapes.find(item => item.id === selected);
  return (
    <section>
      <h2>Géométrie vectorielle</h2>
      <p>Tracés au-dessus des calques raster.</p>
      {!shapes.length && <p>Aucun tracé. Utiliser l’outil ◇.</p>}
      <div className="layer-list">
        {[...shapes].reverse().map(item => <div className={'layer' + (selected === item.id ? ' selected' : '')} key={item.id}>
          <button aria-label={(item.visible ? 'Masquer ' : 'Afficher ') + item.name} onClick={() => change(item.id, { visible: !item.visible })}>{item.visible ? '◉' : '○'}</button>
          <button className="layer-name" aria-pressed={selected === item.id} onClick={() => select(item.id)}>{item.name}</button>
          <button aria-label={(item.locked ? 'Déverrouiller ' : 'Verrouiller ') + item.name} onClick={() => change(item.id, { locked: !item.locked })}>{item.locked ? '🔒' : '🔓'}</button>
        </div>)}
      </div>
      {shape && <>
        <label className="field">Nom du tracé
          <input key={shape.id + shape.name} disabled={shape.locked} defaultValue={shape.name} maxLength={120}
            onBlur={event => { const value = event.currentTarget.value; event.currentTarget.value = shape.name; change(shape.id, { name: value }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        </label>
        <label className="field">Couleur du contour<input type="color" value={shape.stroke} disabled={shape.locked} onChange={event => change(shape.id, { stroke: event.currentTarget.value })} /></label>
        {shape.closed && <label className="field">Remplissage<input type="color" value={shape.fill} disabled={shape.locked} onChange={event => change(shape.id, { fill: event.currentTarget.value })} /></label>}
        <label className="field">Épaisseur (px)
          <input key={shape.id + ':' + shape.strokeWidth} type="number" step="any" min=".5" max="1000" defaultValue={shape.strokeWidth} disabled={shape.locked}
            onBlur={event => { const value = event.currentTarget.valueAsNumber; event.currentTarget.value = String(shape.strokeWidth); if (Number.isFinite(value)) change(shape.id, { strokeWidth: value }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        </label>
        <label className="field">Opacité du tracé ({Math.round(shape.opacity*100)} %)<input type="range" min="0" max="100" value={Math.round(shape.opacity*100)} disabled={shape.locked} onChange={event => change(shape.id, {opacity:event.currentTarget.valueAsNumber/100})} /></label>
        <p>{shape.points.length} sommets · {shape.closed ? 'Polygone fermé' : 'Ligne ouverte'}</p>
        <button disabled={shape.locked} onClick={() => remove(shape.id)}>Supprimer le tracé</button>
      </>}
    </section>
  );
}
