import type { DocumentState } from './project';
import type { RepairRegion } from './repair';
import { renderRepairMask, repairInstructions } from './repair';
import { renderComposite } from './composite';
import { loadSourceImage } from './sourceImage';
import { createZip } from './zip';
import type { ArchiveEntry } from './zip';

export function originalFilename(mime:string){
  if(mime==='image/jpeg')return 'original.jpg';
  if(mime==='image/webp')return 'original.webp';
  return 'original.png';
}
const escapeXML=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function geometrySVG(doc: Pick<DocumentState,'source'|'geometry'>):string{
  const {width,height}=doc.source;
  const shapes=doc.geometry.filter(g=>g.visible).map(g=>{
    const tag=g.closed?'polygon':'polyline';
    return '<'+tag+' id="'+escapeXML(g.id)+'" points="'+g.points.map(p=>p.x+','+p.y).join(' ')+'" fill="'+(g.closed?escapeXML(g.fill):'none')+'" stroke="'+escapeXML(g.stroke)+'" stroke-width="'+g.strokeWidth+'" opacity="'+g.opacity+'" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd"><title>'+escapeXML(g.name)+'</title></'+tag+'>';
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">\n'+shapes.join('\n')+'\n</svg>';
}
function canvasFor(doc:DocumentState){
  const canvas=document.createElement('canvas');
  canvas.width=doc.source.width;canvas.height=doc.source.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas indisponible.');
  return {canvas,ctx};
}
async function drawBlob(ctx:CanvasRenderingContext2D,blob:Blob){
  const bitmap=await createImageBitmap(blob);
  try{ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}
}
function encode(canvas:HTMLCanvasElement){
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG indisponible.')),'image/png'));
}
function trace(ctx:CanvasRenderingContext2D,region:RepairRegion){
  ctx.beginPath();
  for(const [i,p] of region.points.entries())if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  ctx.closePath();
}
export async function annotatedPreview(doc:DocumentState,edited:Blob){
  const {canvas,ctx}=canvasFor(doc);
  try{
    await drawBlob(ctx,edited);
    const line=Math.max(1,Math.min(5,canvas.width/300));
    for(const [i,region] of doc.repairs.entries()){
      trace(ctx,region);
      ctx.fillStyle=region.kind==='protect'?'rgba(54,190,111,.25)':'rgba(239,80,65,.25)';
      ctx.strokeStyle=region.kind==='protect'?'#45d584':'#f35347';
      ctx.lineWidth=line;ctx.fill('evenodd');ctx.stroke();
      const p=region.points[0], label=(region.kind==='protect'?'P':'E')+(i+1);
      const font=Math.max(10,Math.min(28,canvas.width/50));
      ctx.font='bold '+font+'px sans-serif';
      const w=ctx.measureText(label).width+8;
      const x=Math.max(0,Math.min(canvas.width-w,p.x)),y=Math.max(font+4,Math.min(canvas.height,p.y));
      ctx.fillStyle='#18242e';ctx.fillRect(x,y-font-4,w,font+4);
      ctx.fillStyle='#fff';ctx.fillText(label,x+4,y-3);
    }
    return await encode(canvas);
  }finally{canvas.width=0;canvas.height=0;}
}

export function handoffInstructions(doc:DocumentState,request:string){
  const edits=doc.repairs.some(r=>r.kind!=='protect');
  return [
    '# Demande de retouche Asset Studio',
    '',request.trim()||'Finaliser la composition modifiée en respectant les contraintes.',
    '', '## Références',
    '- original : image source originale, non modifiée.',
    '- edited.png : composition actuelle, référence principale à finaliser.',
    '- annotated.png : aperçu avec identifiants E (éditer) et P (protéger). Ne pas reproduire les annotations.',
    '- geometry.svg : géométrie cible visible, à interpréter avec des matériaux réalistes.',
    '- edit-mask.png : blanc = édition autorisée ; noir = hors masque.',
    '- protect-mask.png : blanc = protéger, prioritaire sur toute modification.',
    '', edits?'Remplacer uniquement les zones blanches du masque d’édition.':'Aucune zone d’édition explicite : retouche globale possible hors zones protégées.',
    'Conserver cadrage, dimensions, transparence, perspective et style sauf demande explicite. Renvoyer une image de mêmes dimensions.',
    '',repairInstructions(doc.repairs,doc.source),
  ].join('\n');
}
export async function buildHandoff(doc:DocumentState,request:string):Promise<ArchiveEntry[]>{
  const edited=await renderComposite(doc);
  const annotated=await annotatedPreview(doc,edited);
  const editMask=await renderRepairMask(doc.source,doc.repairs,'edit');
  const protectMask=await renderRepairMask(doc.source,doc.repairs,'protect');
  const original=originalFilename(doc.source.file.type);
  const entries:ArchiveEntry[]=[
    {name:original,blob:doc.source.file},{name:'edited.png',blob:edited},{name:'annotated.png',blob:annotated},
    {name:'edit-mask.png',blob:editMask},{name:'protect-mask.png',blob:protectMask},
    {name:'geometry.svg',blob:new Blob([geometrySVG(doc)],{type:'image/svg+xml'})},
    {name:'instructions.md',blob:new Blob([handoffInstructions(doc,request)],{type:'text/markdown;charset=utf-8'})},
  ];
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',await doc.source.file.arrayBuffer()));
  const manifest={
    schemaVersion:1, source:{name:doc.source.file.name,mime:doc.source.file.type,width:doc.source.width,height:doc.source.height,sha256:Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')},
    coordinateConvention:'decoded source pixels; origin top left; x right; y down',
    editPolicy:doc.repairs.some(r=>r.kind!=='protect')?'edit-mask-only':'global-except-protect', request:request.trim(),
    operations:doc.repairs.map((r,i)=>({...r,kind:r.kind??'edit',label:(r.kind==='protect'?'P':'E')+(i+1)})),
    layers:doc.layers, geometry:doc.geometry,
    files:[...entries.map(e=>e.name),'manifest.json'],
  };
  entries.push({name:'manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})});
  return entries;
}
export async function handoffZip(entries:ArchiveEntry[]){
  if(entries.reduce((sum,e)=>sum+e.blob.size,0)>256*1024*1024)throw new Error('Export trop volumineux (256 Mio).');
  return createZip(entries);
}

// Merge the manually returned image into the CURRENT composition. Only exact-size
// images are accepted. Masks are binary and protect always overrides edit.
export async function mergeRevision(doc:DocumentState,file:File){
  const incoming=await loadSourceImage(file);
  try{
    if(incoming.width!==doc.source.width||incoming.height!==doc.source.height)throw new Error('Le résultat IA doit avoir les mêmes dimensions que la source.');
    const edits=doc.repairs.some(r=>r.kind!=='protect'), protects=doc.repairs.some(r=>r.kind==='protect');
    if(!edits&&!protects)return await loadSourceImage(file);
    const baseline=await renderComposite(doc);
    const mask=await renderRepairMask(doc.source,doc.repairs,edits?'edit':'protect');
    const output=canvasFor(doc), input=canvasFor(doc), stencil=canvasFor(doc);
    try{
      await drawBlob(output.ctx,baseline);
      await drawBlob(input.ctx,file);
      await drawBlob(stencil.ctx,mask);
      for(let y=0;y<doc.source.height;y+=64){
        const h=Math.min(64,doc.source.height-y),w=doc.source.width;
        const old=output.ctx.getImageData(0,y,w,h),next=input.ctx.getImageData(0,y,w,h),m=stencil.ctx.getImageData(0,y,w,h);
        for(let i=0;i<m.data.length;i+=4){
          if(edits?m.data[i]===255:m.data[i]===0){
            old.data[i]=next.data[i];old.data[i+1]=next.data[i+1];old.data[i+2]=next.data[i+2];old.data[i+3]=next.data[i+3];
          }
        }
        output.ctx.putImageData(old,0,y);
      }
      return await loadSourceImage(new File([await encode(output.canvas)],'revision-ia.png',{type:'image/png'}));
    }finally{for(const c of [output.canvas,input.canvas,stencil.canvas]){c.width=0;c.height=0;}}
  }finally{URL.revokeObjectURL(incoming.url);}
}
