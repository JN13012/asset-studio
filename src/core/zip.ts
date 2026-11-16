// ZIP32, stored entries, UTF-8 paths. No external dependencies.
export interface ArchiveEntry { name: string; blob: Blob }
const table = Uint32Array.from({length:256},(_,i)=>{
  let c=i;
  for(let bit=0;bit<8;bit++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
  return c>>>0;
});
export function crc32(bytes: Uint8Array, previous=0): number {
  let c=(previous^0xffffffff)>>>0;
  for(const byte of bytes)c=(table[(c^byte)&255]^(c>>>8))>>>0;
  return (c^0xffffffff)>>>0;
}
async function blobCRC(blob:Blob){
  let crc=0;
  for(let i=0;i<blob.size;i+=1024*1024)crc=crc32(new Uint8Array(await blob.slice(i,i+1024*1024).arrayBuffer()),crc);
  return crc;
}
export async function createZip(entries:ArchiveEntry[]):Promise<Blob>{
  if(entries.length>65535 || new Set(entries.map(e=>e.name)).size!==entries.length)throw new Error('Archive invalide.');
  const chunks:BlobPart[]=[], central:BlobPart[]=[];
  let offset=0,centralSize=0;
  for(const entry of entries){
    if(!/^[a-zA-Z0-9._-]+$/.test(entry.name)||entry.name==='.'||entry.name==='..')throw new Error('Nom de fichier invalide.');
    const name=new TextEncoder().encode(entry.name), size=entry.blob.size;
    if(name.length>65535||offset+30+name.length+size>0xffffffff)throw new Error('Archive trop volumineuse.');
    const crc=await blobCRC(entry.blob);
    const local=new Uint8Array(30), l=new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);
    l.setUint32(14,crc,true);l.setUint32(18,size,true);l.setUint32(22,size,true);l.setUint16(26,name.length,true);
    chunks.push(local,name,entry.blob);
    const header=new Uint8Array(46), h=new DataView(header.buffer);
    h.setUint32(0,0x02014b50,true);h.setUint16(4,20,true);h.setUint16(6,20,true);h.setUint16(8,0x800,true);h.setUint16(14,33,true);
    h.setUint32(16,crc,true);h.setUint32(20,size,true);h.setUint32(24,size,true);h.setUint16(28,name.length,true);h.setUint32(42,offset,true);
    central.push(header,name);centralSize+=46+name.length;offset+=30+name.length+size;
  }
  if(offset+centralSize+22>0xffffffff)throw new Error('Archive trop volumineuse.');
  const end=new Uint8Array(22), e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
