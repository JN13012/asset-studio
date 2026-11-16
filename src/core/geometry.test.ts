import { describe, expect, it } from 'vitest';
import { createGeometry, insertVertex, moveGeometry, moveVertex, removeVertex, updateGeometry } from './geometry';
const size = { width: 100, height: 80 };
const points = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }];

describe('editable geometry', () => {
  it('creates independent source-space geometry', () => {
    const shape = createGeometry('a', points, true, size);
    expect(shape.points).toEqual(points);
    expect(shape.points[0]).not.toBe(points[0]);
    expect(shape.closed).toBe(true);
  });
  it('rejects invalid or underspecified shapes', () => {
    expect(() => createGeometry('a', points.slice(0,2), true, size)).toThrow();
    expect(() => createGeometry('a', [{x:-1,y:0},points[1]], false,size)).toThrow();
  });
  it('moves a vertex without touching its neighbors', () => {
    expect(moveVertex(points, 0, {x:-5,y:90},size)).toEqual([{x:0,y:80},...points.slice(1)]);
  });
  it('moves an entire path while keeping its shape at the boundary', () => {
    expect(moveGeometry(points,{x:100,y:-100},size)).toEqual([{x:80,y:0},{x:100,y:0},{x:100,y:20}]);
  });
  it('inserts a midpoint including a closed path closing edge', () => {
    expect(insertVertex(points,2,true)).toEqual([...points,{x:20,y:20}]);
    expect(insertVertex(points,2,false)).toBe(points);
  });
  it('keeps minimum vertex counts', () => {
    expect(removeVertex(points,0,true)).toBe(points);
    expect(removeVertex(points,0,false)).toEqual(points.slice(1));
  });
  it('validates property edits and protects locked shapes', () => {
    const shapes = [createGeometry('a',points,true,size)];
    const edited = updateGeometry(shapes,'a',{strokeWidth:0,opacity:2,stroke:'#ff0000'},size);
    expect(edited[0]).toMatchObject({strokeWidth:.5,opacity:1,stroke:'#ff0000'});
    const locked = updateGeometry(edited,'a',{locked:true},size);
    expect(updateGeometry(locked,'a',{strokeWidth:20},size)).toBe(locked);
  });
});
