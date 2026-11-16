import { describe, expect, it } from 'vitest';
import { cornerDelta, cornerWorld, homography, IDENTITY_QUAD, moveCorner, projectPoint, rasterTransform, validQuad } from './perspective';
import type { Quad } from './perspective';
import { createLayer, updateLayer, SOURCE_ID } from './layers';

const quad: Quad = [{x:.1,y:.2},{x:1.2,y:0},{x:1,y:1.1},{x:0,y:.8}];
const image = { width: 100, height: 50 };

describe('projective transformation', () => {
  it('maps all four unit corners exactly', () => {
    IDENTITY_QUAD.forEach((point, i) => {
      const result = projectPoint(quad, point)!;
      expect(result.x).toBeCloseTo(quad[i].x, 10);
      expect(result.y).toBeCloseTo(quad[i].y, 10);
    });
  });
  it('keeps the identity transform unchanged', () => {
    expect(projectPoint(IDENTITY_QUAD, { x: .4, y: .8 })).toEqual({x:.4,y:.8});
  });
  it('rejects crossing or collapsed corners', () => {
    expect(validQuad([IDENTITY_QUAD[0], IDENTITY_QUAD[2], IDENTITY_QUAD[1], IDENTITY_QUAD[3]])).toBe(false);
    expect(homography([IDENTITY_QUAD[0], IDENTITY_QUAD[0], IDENTITY_QUAD[2], IDENTITY_QUAD[3]])).toBeNull();
    expect(moveCorner(IDENTITY_QUAD, 0, { x: 2, y: 2 })).toBe(IDENTITY_QUAD);
  });
  it('moves one corner without modifying the others', () => {
    expect(moveCorner(IDENTITY_QUAD, 0, { x: -.25, y: .1 })).toEqual([{x:-.25,y:.1}, ...IDENTITY_QUAD.slice(1)]);
  });
  it('converts drag deltas through rotation and scale', () => {
    const layer = {...createLayer('a','Objet',image,image), rotation:90, scale:2, stretchX:1.5};
    const delta = cornerDelta(layer, image, { x: 0, y: 30 });
    expect(delta.x).toBeCloseTo(.1);
    expect(delta.y).toBeCloseTo(0);
    const p = cornerWorld(layer,image,{x:.6,y:.5});
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(55);
  });
  it('composes projective and ordinary CSS transforms', () => {
    const base = createLayer('a','Objet',image,image);
    expect(rasterTransform(base,image).transformOrigin).toBe('center');
    const warped = rasterTransform({...base, quad},image);
    expect(warped.transformOrigin).toBe('0 0');
    expect(warped.transform).toContain('matrix3d(');
  });
  it('protects the source and rejects invalid perspective patches', () => {
    const layers = [createLayer(SOURCE_ID,'Source',image,image), createLayer('a','Objet',image,image)];
    expect(updateLayer(layers,SOURCE_ID,{quad})[0].quad).toBeUndefined();
    expect(updateLayer(layers,'a',{quad})[1].quad).toEqual(quad);
    expect(updateLayer(layers,'a',{quad:[quad[0],quad[0],quad[2],quad[3]]})[1].quad).toBeUndefined();
    expect(updateLayer(updateLayer(layers,'a',{quad}),'a',{quad:null})[1].quad).toBeNull();
  });
});
