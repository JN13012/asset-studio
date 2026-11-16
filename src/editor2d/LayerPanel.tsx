import type { RasterLayer } from '../core/layers';
import { SOURCE_ID } from '../core/layers';

interface Props {
  layers: RasterLayer[];
  selected: string;
  select: (id: string) => void;
  update: (id: string, patch: Partial<Omit<RasterLayer, 'id'>>) => void;
  reorder: (id: string, direction: -1 | 1) => void;
  remove: (id: string) => void;
  add: () => void;
  loading: boolean;
}

export function LayerPanel({ layers, selected, select, update, reorder, remove, add, loading }: Props) {
  const layer = layers.find(item => item.id === selected);
  const index = layers.findIndex(item => item.id === selected);
  const editable = Boolean(layer && !layer.locked);
  return (
    <section>
      <div className="panel-title"><h2>Calques</h2><button disabled={!layers.length || loading} onClick={add}>+ Image</button></div>
      {!layers.length && <p>Aucun calque.</p>}
      <div className="layer-list">
        {[...layers].reverse().map(item => (
          <div className={'layer' + (item.id === selected ? ' selected' : '')} key={item.id}>
            <button className="layer-eye" aria-label={item.visible ? 'Masquer ' + item.name : 'Afficher ' + item.name}
              onClick={() => update(item.id, { visible: !item.visible })}>{item.visible ? '◉' : '○'}</button>
            <button className="layer-name" aria-pressed={item.id === selected} onClick={() => select(item.id)}>{item.name}</button>
            <button disabled={item.id === SOURCE_ID} aria-label={item.locked ? 'Déverrouiller ' + item.name : 'Verrouiller ' + item.name}
              onClick={() => update(item.id, { locked: !item.locked })}>{item.locked ? '🔒' : '🔓'}</button>
          </div>
        ))}
      </div>
      {layer && (
        <>
          <div className="layer-actions">
            <button disabled={!editable || index >= layers.length - 1 || Boolean(layers[index + 1]?.locked)} onClick={() => reorder(layer.id, 1)} aria-label="Monter le calque">↑</button>
            <button disabled={!editable || index <= 1 || Boolean(layers[index - 1]?.locked)} onClick={() => reorder(layer.id, -1)} aria-label="Descendre le calque">↓</button>
            <button disabled={!editable} onClick={() => remove(layer.id)}>Supprimer</button>
          </div>
          <h2>Transformation du calque</h2>
          <label className="field">Nom
            <input key={layer.id + ':name'} defaultValue={layer.name} disabled={!editable} onBlur={event => {
              update(layer.id, { name: event.currentTarget.value });
              if (!event.currentTarget.value.trim()) event.currentTarget.value = layer.name;
            }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          </label>
          <label className="field">Opacité ({Math.round(layer.opacity * 100)} %)
            <input type="range" min="0" max="100" value={Math.round(layer.opacity * 100)} disabled={!editable}
              onChange={event => update(layer.id, { opacity: event.currentTarget.valueAsNumber / 100 })} />
          </label>
          <div className="numeric-grid">
            <NumberField key={layer.id + ':x:' + layer.x} label="X (px)" value={layer.x} disabled={!editable} change={x => update(layer.id, { x })} />
            <NumberField key={layer.id + ':y:' + layer.y} label="Y (px)" value={layer.y} disabled={!editable} change={y => update(layer.id, { y })} />
            <NumberField key={layer.id + ':scale:' + layer.scale} label="Échelle (%)" value={Math.round(layer.scale * 10000) / 100} disabled={!editable} change={scale => update(layer.id, { scale: scale / 100 })} />
            <NumberField key={layer.id + ':rotation:' + layer.rotation} label="Rotation (°)" value={layer.rotation} disabled={!editable} change={rotation => update(layer.id, { rotation })} />
          </div>
        </>
      )}
    </section>
  );
}
function NumberField({ label, value, disabled, change }: { label: string; value: number; disabled: boolean; change: (value: number) => void }) {
  return (
    <label className="field">{label}
      <input type="number" step="any" defaultValue={value} disabled={disabled} onBlur={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) change(next);
        event.currentTarget.value = String(value);
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </label>
  );
}
