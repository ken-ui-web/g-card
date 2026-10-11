import { useEffect, useRef, useState } from 'react';

export function useScrolledPast(active: boolean) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const update = () => setVisible(Boolean(markerRef.current && markerRef.current.getBoundingClientRect().top <= 0));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  useEffect(() => {
    if (active) setVisible(Boolean(markerRef.current && markerRef.current.getBoundingClientRect().top <= 0));
  });

  return { markerRef, visible };
}
