import { describe, expect, it } from 'vitest';
import { projectFilename, validateManifest, saveProject } from './project';
import { createLayer, SOURCE_ID } from './layers';
import type { SourceImage } from './sourceImage';

const size = {width:20,height:10};
const layer = createLayer(SOURCE_ID,'Image source',size,size);
const descriptor = {id:SOURCE_ID,name:'port.png',type:'image/png',bytes:3,...size};
const manifest = {version:1,layers:[layer],assets:[descriptor],geometry:[],repairs:[],selected:SOURCE_ID,selectedGeometry:null};

describe('project format', () => {
  it('validates a minimal manifest', () => expect(validateManifest(manifest)).toEqual(manifest));
  it('rejects unsupported versions', () => expect(() => validateManifest({...manifest,version:2})).toThrow());
  it('rejects an unlocked source', () => expect(() => validateManifest({...manifest,layers:[{...layer,locked:false}]})).toThrow());
  it('rejects missing assets', () => expect(() => validateManifest({...manifest,assets:[]})).toThrow());
  it('rejects excessive decoded dimensions', () => expect(() => validateManifest({...manifest,assets:[{...descriptor,width:100000,height:100000}]})).toThrow());
  it('generates the project filename', () => expect(projectFilename('port.png')).toBe('port.assetstudio'));
  it('preserves exact binary payload in the saved file', async () => {
    const source:SourceImage = {...size,file:new File([new Uint8Array([1,2,3])],'port.png',{type:'image/png'}),url:'blob:test'};
    const blob = saveProject({source,assets:{[SOURCE_ID]:source},layers:[layer],selected:SOURCE_ID,geometry:[],repairs:[],selectedGeometry:null});
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0,8))).toBe('ASTUDIO1');
    expect([...bytes.slice(-3)]).toEqual([1,2,3]);
  });
});
