import { describe,expect,it } from 'vitest';
import { crc32,createZip } from './zip';
import { geometrySVG,handoffInstructions,originalFilename } from './handoff';
import { createGeometry } from './geometry';
import { createRepairRegion } from './repair';
import { createLayer,SOURCE_ID } from './layers';
import type { DocumentState } from './project';
const source={width:100,height:100,url:'blob:test',file:new File(['data'],'port.webp',{type:'image/webp'})};
const points=[{x:1,y:1},{x:10,y:1},{x:10,y:10}];
const doc:DocumentState={source,layers:[createLayer(SOURCE_ID,'Source',source,source)],assets:{[SOURCE_ID]:source},selected:SOURCE_ID,
 geometry:[createGeometry('g',points,true,source)],selectedGeometry:null,repairs:[createRepairRegion('r',points,'Protéger',source,'protect')]};

describe('manual handoff',()=>{
  it('computes standard CRC32',()=>expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));
  it('supports incremental CRC32',()=>expect(crc32(new TextEncoder().encode('456789'),crc32(new TextEncoder().encode('123')))).toBe(0xcbf43926));
  it('writes ZIP headers and correct CRC',async()=>{
    const blob=await createZip([{name:'a.txt',blob:new Blob(['123456789'])}]);
    const bytes=await blob.arrayBuffer(),view=new DataView(bytes);
    expect(view.getUint32(0,true)).toBe(0x04034b50);
    expect(view.getUint32(14,true)).toBe(0xcbf43926);
    expect(view.getUint32(bytes.byteLength-22,true)).toBe(0x06054b50);
  });
  it('rejects unsafe and duplicate archive paths',async()=>{
    await expect(createZip([{name:'../a',blob:new Blob()}])).rejects.toThrow();
    await expect(createZip([{name:'a',blob:new Blob()},{name:'a',blob:new Blob()}])).rejects.toThrow();
  });
  it('uses the original image format',()=>expect(originalFilename('image/webp')).toBe('original.webp'));
  it('exports visible geometry with escaped text',()=>{
    const xml=geometrySVG({...doc,geometry:[{...doc.geometry[0],name:'A & B < C'}]});
    expect(xml).toContain('viewBox="0 0 100 100"');expect(xml).toContain('A &amp; B &lt; C');
  });
  it('documents global edit and protect semantics',()=>{
    const text=handoffInstructions(doc,'Refaire le quai');
    expect(text).toContain('Refaire le quai');expect(text).toContain('retouche globale');expect(text).toContain('PROTÉGER');
  });
});
