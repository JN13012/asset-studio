import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { SourceImage } from '../core/sourceImage';
import { clampZoom, fitScale } from '../core/viewport';
import type { Size } from '../core/viewport';

interface Props {
  source: SourceImage | null;
  choose: () => void;
}
interface Point { x: number; y: number }

export function Viewport({ source, choose }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; start: Point; offset: Point } | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const scale = zoom ?? (source ? fitScale(source, size) : 1);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!source || event.button !== 0 || drag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, offset };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const value = drag.current;
    if (!value || value.pointerId !== event.pointerId) return;
    setOffset({
      x: value.offset.x + event.clientX - value.start.x,
      y: value.offset.y + event.clientY - value.start.y,
    });
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  function fit() {
    setZoom(null);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <>
      <div
        ref={area}
        className={'viewport' + (source ? ' pannable' : '')}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        {source ? (
          <div className="image-stage" style={{
            width: source.width,
            height: source.height,
            transform: 'translate(-50%, -50%) translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + scale + ')',
          }}>
            <img src={source.url} alt="Image source du document" draggable={false} />
          </div>
        ) : (
          <div className="empty">
            <strong>Importer un asset</strong>
            <p>Glisser une image PNG, JPEG ou WebP dans cet espace.</p>
            <button onClick={choose}>Choisir un fichier</button>
          </div>
        )}
      </div>
      <div className="view-controls" aria-label="Contrôles de la vue">
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale / 1.25))} aria-label="Zoom arrière">−</button>
        <output aria-label="Niveau de zoom">{source ? (scale * 100).toFixed(scale < 0.1 ? 1 : 0) + ' %' : '—'}</output>
        <button disabled={!source} onClick={() => setZoom(clampZoom(scale * 1.25))} aria-label="Zoom avant">+</button>
        <button disabled={!source} onClick={fit}>Ajuster</button>
        <button disabled={!source} onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>100 %</button>
        <span>Glisser pour déplacer la vue</span>
      </div>
    </>
  );
}
