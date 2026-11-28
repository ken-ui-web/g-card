import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { frames, isFrameId } from '../data/frames';
import './FramedArt.css';

export function FramedArt({ frameId, children }: { frameId?: string; children: ReactNode }) {
  const snowRef = useRef<HTMLSpanElement>(null);
  const framed = isFrameId(frameId);
  useEffect(() => {
    const snow = snowRef.current;
    if (!snow || !framed) return;
    const update = () => {
      snow.style.setProperty('--snow-distance', `${snow.clientHeight + 22}px`);
      snow.parentElement?.style.setProperty('--snow-scale', String(Math.max(.65, Math.min(1.35, snow.parentElement.clientWidth / 300))));
    };
    const observer = new ResizeObserver(update); observer.observe(snow); update();
    return () => observer.disconnect();
  }, [framed]);
  if (!framed) return <>{children}</>;
  return <span className="framed-art" aria-label="白銀のクリスマスフレーム装着">
    <span className="framed-art__inner">{children}</span>
    <img className="framed-art__border" src={`${import.meta.env.BASE_URL}images/frames/${frames[frameId].image}`} alt="" draggable={false} />
    <span className="framed-art__snow" ref={snowRef} aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i className={i % 3 === 0 ? 'frame-flake frame-flake--crystal' : 'frame-flake'} key={i} style={{ '--flake-x': `${5 + i * 29 % 91}%`, '--flake-drift': `${(i % 2 ? 1 : -1) * (10 + i % 5 * 4)}px`, '--flake-duration': `${3.2 + i % 5 * .35}s`, '--flake-delay': `${-i * .57}s` } as CSSProperties}>{i % 3 === 0 ? '❄︎' : ''}</i>)}</span>
    <span className="framed-art__glints" aria-hidden="true">{[[9,9],[91,13],[6,43],[94,61],[22,94],[70,7],[7,78],[88,90]].map(([x,y],i) => <i key={i} style={{ left:`${x}%`, top:`${y}%`, animationDelay:`${-i * .49}s` }}>✦</i>)}</span>
  </span>;
}
