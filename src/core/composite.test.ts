import { describe, expect, it } from 'vitest';
import { compositeFilename, inverseProject, sampleBilinear, warpedBounds } from './composite';
import { IDENTITY_QUAD, projectPoint } from './perspective';
import type { Quad } from './perspective';
import { createLayer } from './layers';
const quad:Quad=[{x:.1,y:.1},{x:1.2,y:0},{x:1,y:1.2},{x:0,y:1}];

describe('composite rendering math',()=>{
  it('inverts projective mappings',()=>{
    const p={x:.3,y:.7};
    const result=inverseProject(quad,projectPoint(quad,p)!)!;
    expect(result.x).toBeCloseTo(p.x,10);expect(result.y).toBeCloseTo(p.y,10);
  });
  it('clips warped bounds to output dimensions',()=>{
    const size={width:40,height:20};
    const layer={...createLayer('a','Asset',size,size),x:-10,y:5,quad:IDENTITY_QUAD};
    expect(warpedBounds(layer,size,size)).toEqual({x:0,y:5,width:30,height:15});
  });
  it('clips entirely offscreen warped layers',()=>{
    const size={width:40,height:20};
    const layer={...createLayer('a','Asset',size,size),x:100,y:100,quad:IDENTITY_QUAD};
    expect(warpedBounds(layer,size,size)).toEqual({x:40,y:20,width:0,height:0});
  });
  it('preserves alpha without darkening transparent edges',()=>{
    const data=new Uint8ClampedArray([255,0,0,255,0,0,0,0]);
    const out=new Uint8ClampedArray(4);
    sampleBilinear(data,2,1,.5,.5,out,0);
    expect([...out]).toEqual([255,0,0,128]);
  });
  it('does not sample outside the asset',()=>{
    const out=new Uint8ClampedArray(4);
    sampleBilinear(new Uint8ClampedArray([255,0,0,255]),1,1,-.1,.5,out,0);
    expect([...out]).toEqual([0,0,0,0]);
  });
  it('keeps a distinct output filename',()=>expect(compositeFilename('port.png')).toBe('port-edited.png'));
});
