import type { DocumentState } from './project';
import type { RasterLayer } from './layers';
import type { SourceImage } from './sourceImage';
import type { Geometry } from './geometry';
import type { Point } from './cutout';
import type { Size } from './viewport';
import { homography, cornerWorld } from './perspective';
import type { Quad } from './perspective';

export function inverseProject(quad: Quad, point: Point): Point | null {
  const m = homography(quad);
  return m ? inverseHomography(m, point.x, point.y) : null;
}
function inverseHomography(m: NonNullable<ReturnType<typeof homography>>, u: number, v: number): Point | null {
  const a = m.a - u*m.g, b = m.b - u*m.h, c = u - m.c;
  const d = m.d - v*m.g, e = m.e - v*m.h, f = v - m.f;
  const det = a*e - b*d;
  if (Math.abs(det) < 1e-12) return null;
  const x = (c*e - b*f)/det, y = (a*f - c*d)/det;
  return Number.isFinite(x) && Number.isFinite(y) ? {x,y} : null;
}

export function warpedBounds(layer: RasterLayer, asset: Size, document: Size) {
  if (!layer.quad) throw new Error('Perspective manquante.');
  const corners = layer.quad.map(p => cornerWorld(layer,asset,p));
  const x = Math.max(0,Math.min(document.width, Math.floor(Math.min(...corners.map(p => p.x)))));
  const y = Math.max(0,Math.min(document.height, Math.floor(Math.min(...corners.map(p => p.y)))));
  const right = Math.max(0, Math.min(document.width,Math.ceil(Math.max(...corners.map(p => p.x)))));
  const bottom = Math.max(0, Math.min(document.height,Math.ceil(Math.max(...corners.map(p => p.y)))));
  return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}

// Bilinear interpolation in premultiplied alpha avoids dark fringes on cutouts.
export function sampleBilinear(data: Uint8ClampedArray, width: number, height: number, u: number, v: number, out: Uint8ClampedArray, offset: number) {
  if (u < 0 || v < 0 || u > 1 || v > 1) return;
  const x = Math.max(0,Math.min(width-1,u*width-.5)), y = Math.max(0,Math.min(height-1,v*height-.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(width-1,x0+1), y1 = Math.min(height-1,y0+1);
  const tx = x-x0, ty = y-y0;
  const a = (y0*width+x0)*4, b = (y0*width+x1)*4, c = (y1*width+x0)*4, d = (y1*width+x1)*4;
  const wa = (1-tx)*(1-ty)*data[a+3], wb = tx*(1-ty)*data[b+3], wc = (1-tx)*ty*data[c+3], wd = tx*ty*data[d+3];
  const alpha = wa+wb+wc+wd;
  if (!alpha) return;
  for (let channel=0;channel<3;channel++) out[offset+channel] = (data[a+channel]*wa+data[b+channel]*wb+data[c+channel]*wc+data[d+channel]*wd)/alpha;
  out[offset+3] = alpha;
}

function createCanvas(width:number,height:number) {
  const canvas = document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  const context=canvas.getContext('2d');
  if(!context) throw new Error('Dimensions non prises en charge par Canvas.');
  return {canvas,context};
}
async function decode(asset:SourceImage) {
  const image=new Image();
  image.src=asset.url;
  await image.decode();
  return image;
}

async function renderWarp(context:CanvasRenderingContext2D, image:HTMLImageElement, layer:RasterLayer, asset:SourceImage, size:Size) {
  const m=layer.quad ? homography(layer.quad) : null;
  if(!m) throw new Error('Perspective invalide.');
  const bounds=warpedBounds(layer,asset,size);
  if(!bounds.width || !bounds.height) return;
  const input=createCanvas(asset.width,asset.height);
  const stripe=createCanvas(bounds.width,Math.min(64,bounds.height));
  try {
    input.context.drawImage(image,0,0);
    const pixels=input.context.getImageData(0,0,asset.width,asset.height).data;
    input.canvas.width=0; input.canvas.height=0;
    const angle=layer.rotation*Math.PI/180, cos=Math.cos(angle), sin=Math.sin(angle);
    const cx=layer.x+asset.width/2, cy=layer.y+asset.height/2;
    const sx=asset.width*layer.scale*(layer.stretchX??1), sy=asset.height*layer.scale*(layer.stretchY??1);
    for(let row=0;row<bounds.height;row+=64) {
      const h=Math.min(64,bounds.height-row);
      const output=stripe.context.createImageData(bounds.width,h);
      for(let y=0;y<h;y++) for(let x=0;x<bounds.width;x++) {
        const dx=bounds.x+x+.5-cx, dy=bounds.y+row+y+.5-cy;
        const p=inverseHomography(m,(cos*dx+sin*dy)/sx+.5,(-sin*dx+cos*dy)/sy+.5);
        if(p) sampleBilinear(pixels,asset.width,asset.height,p.x,p.y,output.data,(y*bounds.width+x)*4);
      }
      stripe.context.putImageData(output,0,0);
      context.drawImage(stripe.canvas,0,0,bounds.width,h,bounds.x,bounds.y+row,bounds.width,h);
      // Give the UI a chance to repaint during large projective exports.
      if(row%512===0) await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
  } finally {
    input.canvas.width=0; input.canvas.height=0;
    stripe.canvas.width=0; stripe.canvas.height=0;
  }
}

export function drawGeometry(context:CanvasRenderingContext2D, shape:Geometry) {
  if(!shape.visible || !shape.opacity) return;
  context.save();
  try {
    // SVG opacity applies to the combined fill/stroke; an isolated group is handled
    // by the caller for partially transparent polygons.
    context.strokeStyle=shape.stroke;
    context.fillStyle=shape.fill;
    context.lineWidth=shape.strokeWidth;
    context.lineJoin='round'; context.lineCap='round';
    context.beginPath();
    shape.points.forEach((p,i)=>i===0?context.moveTo(p.x,p.y):context.lineTo(p.x,p.y));
    if(shape.closed){context.closePath();context.fill('evenodd');}
    context.stroke();
  } finally {context.restore();}
}
function compositeGeometry(context:CanvasRenderingContext2D, shape:Geometry, size:Size) {
  if(!shape.visible || !shape.opacity) return;
  if(shape.opacity===1){drawGeometry(context,shape);return;}
  const padding=shape.strokeWidth/2+2;
  const x=Math.max(0,Math.floor(Math.min(...shape.points.map(p=>p.x))-padding));
  const y=Math.max(0,Math.floor(Math.min(...shape.points.map(p=>p.y))-padding));
  const w=Math.min(size.width,Math.ceil(Math.max(...shape.points.map(p=>p.x))+padding))-x;
  const h=Math.min(size.height,Math.ceil(Math.max(...shape.points.map(p=>p.y))+padding))-y;
  if(w<=0||h<=0)return;
  const group=createCanvas(w,h);
  try {
    group.context.translate(-x,-y);
    drawGeometry(group.context,shape);
    context.save();
    try{context.globalAlpha=shape.opacity;context.drawImage(group.canvas,x,y);}finally{context.restore();}
  } finally {group.canvas.width=0;group.canvas.height=0;}
}

export async function renderComposite(doc:DocumentState):Promise<Blob> {
  const {canvas,context}=createCanvas(doc.source.width,doc.source.height);
  try {
    for(const layer of doc.layers){
      if(!layer.visible||!layer.opacity)continue;
      const asset=doc.assets[layer.id];
      const image=await decode(asset);
      context.save();
      try{
        context.globalAlpha=layer.opacity;
        if(layer.quad)await renderWarp(context,image,layer,asset,doc.source);
        else{
          context.translate(layer.x+asset.width/2,layer.y+asset.height/2);
          context.rotate(layer.rotation*Math.PI/180);
          context.scale(layer.scale*(layer.stretchX??1),layer.scale*(layer.stretchY??1));
          context.drawImage(image,-asset.width/2,-asset.height/2);
        }
      }finally{context.restore();}
    }
    for(const shape of doc.geometry)compositeGeometry(context,shape,doc.source);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Impossible de générer le PNG.')),'image/png'));
  }finally{canvas.width=0;canvas.height=0;}
}

export function compositeFilename(name:string){
  return (name.replace(/\.[^.]+$/,'')||'asset')+'-edited.png';
}
