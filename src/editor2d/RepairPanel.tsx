import { useState } from 'react';
import { downloadBlob, renderRepairMask, repairInstructions } from '../core/repair';
import type { RepairRegion } from '../core/repair';
import type { SourceImage } from '../core/sourceImage';

interface Props {
  source: SourceImage | null;
  repairs: RepairRegion[];
  remove: (id: string) => void;
  report: (message: string) => void;
}

export function RepairPanel({ source, repairs, remove, report }: Props) {
  const [busy, setBusy] = useState(false);
  async function exportMask() {
    if (!source || !repairs.length || busy) return;
    setBusy(true);
    try {
      downloadBlob(await renderRepairMask(source, repairs), 'edit-mask.png');
    } catch (error) {
      report(error instanceof Error ? error.message : 'Échec de l’export.');
    } finally {
      setBusy(false);
    }
  }
  function exportInstructions() {
    if (!source || !repairs.length) return;
    downloadBlob(new Blob([repairInstructions(repairs, source)], { type: 'text/markdown;charset=utf-8' }), 'instructions.md');
  }
  return (
    <section>
      <h2>Reconstruction / IA</h2>
      <p>Zones rouges visibles avec l’outil masque. Export manuel, sans connexion à ChatGPT.</p>
      {!repairs.length && <p>Aucune zone définie.</p>}
      {repairs.map((region, index) => (
        <div className="repair-row" key={region.id}>
          <div><strong>Zone {index + 1}</strong><p>{region.instruction || 'Reconstruction locale'}</p></div>
          <button aria-label={'Supprimer zone ' + (index + 1)} onClick={() => remove(region.id)}>×</button>
        </div>
      ))}
      <div className="repair-exports">
        <button disabled={!source || !repairs.length || busy} onClick={() => void exportMask()}>Exporter le masque PNG</button>
        <button disabled={!source || !repairs.length} onClick={exportInstructions}>Exporter les instructions</button>
      </div>
    </section>
  );
}
