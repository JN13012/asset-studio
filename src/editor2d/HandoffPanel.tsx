import { useState } from 'react';
import type { DocumentState } from '../core/project';
import { buildHandoff, handoffZip } from '../core/handoff';
import { downloadBlob } from '../core/repair';
import type { ArchiveEntry } from '../core/zip';

interface Props{
  document:DocumentState|null;
  busy:boolean;
  setBusy:(value:boolean)=>void;
  report:(message:string)=>void;
}
export function HandoffPanel({document,busy,setBusy,report}:Props){
  const [request,setRequest]=useState('');
  const [prepared,setPrepared]=useState<{document:DocumentState;request:string;entries:ArchiveEntry[];zip:Blob}|null>(null);
  const ready=prepared?.document===document&&prepared.request===request?prepared:null;
  async function prepare(){
    if(!document||busy)return;
    setBusy(true);report('');setPrepared(null);
    try{
      const entries=await buildHandoff(document,request);
      const zip=await handoffZip(entries);
      setPrepared({document,request,entries,zip});
    }catch(error){report(error instanceof Error?error.message:'Échec du dossier IA.');}
    finally{setBusy(false);}
  }
  return <section>
    <h2>AI Handoff</h2>
    <p>Préparer les fichiers à transmettre manuellement à ChatGPT.</p>
    <label className="field">Demande globale<textarea rows={4} maxLength={4000} value={request} disabled={busy||!document} onChange={event=>setRequest(event.currentTarget.value)} placeholder="Ex. Finaliser le port en conservant le style et les positions." /></label>
    <button disabled={!document||busy} onClick={()=>void prepare()}>Préparer dossier IA</button>
    {ready&&<div className="repair-exports">
      <button onClick={()=>downloadBlob(ready.zip,'asset-handoff.zip')}>Télécharger dossier ZIP</button>
      {ready.entries.map(entry=><button key={entry.name} onClick={()=>downloadBlob(entry.blob,entry.name)}>{entry.name}</button>)}
    </div>}
    {prepared&&!ready&&<p>Le document ou la demande a changé. Préparer un nouveau dossier.</p>}
  </section>;
}
