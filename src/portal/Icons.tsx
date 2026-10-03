import type { ReactNode } from 'react';

export type PortalIconName = 'test' | 'reflection' | 'battle' | 'deck' | 'shop' | 'training' | 'ranking' | 'coin' | 'life' | 'stamp';

const drawings: Record<PortalIconName, ReactNode> = {
  test: <><rect x="7" y="7" width="18" height="22" rx="2" /><path d="M12 7V5h8v2M12 14h8M12 19h8M12 24h5" /></>,
  reflection: <><path d="M8 25 24 9l3 3-16 16-5 1zM21 12l3 3" /><path d="M7 6h11M7 12h6M7 18h2" /></>,
  battle: <><path d="m8 6 18 18M24 6 6 24M5 21l6 6M21 27l6-6" /><circle cx="16" cy="16" r="3" /></>,
  deck: <><rect x="5" y="9" width="17" height="20" rx="2" /><path d="M11 9V5h16v19h-5M12 16l2 2 2-2M13 23h4" /></>,
  shop: <><path d="M5 12h22l-2 16H7zM11 12V9a5 5 0 0 1 10 0v3" /><path d="M12 19h8M16 16v6" /></>,
  training: <><path d="M4 13v6m4-9v12m16-12v12m4-9v6M8 16h16" /><circle cx="16" cy="16" r="3" /></>,
  ranking: <><path d="M9 28V17h6v11M16 28V11h6v17M23 28v-8h5v8M5 28h23" /><path d="m18 5 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5L13 8.5l3.5-.5z" /></>,
  coin: <><circle cx="16" cy="16" r="13" fill="url(#coinFill)" stroke="#8d5411" strokeWidth="2" /><circle cx="16" cy="16" r="10" stroke="#fff0ad" strokeWidth="1.5" fill="none" /><path d="M21 11.5a7 7 0 1 0 0 9M15 10v12h5v-6h-5" stroke="#68420b" strokeWidth="2.4" fill="none" strokeLinejoin="round" /><path d="M7 12c2-4 5-6 9-6" stroke="#fff7bf" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>,
  life: <><path d="M16 28 5.5 18C-.5 12 7 3 13 8l3 3 3-3c6-5 13.5 4 7.5 10z" fill="url(#lifeFill)" stroke="#ffb8b0" strokeWidth="1.5" /><path d="M8 13c1-2 2-3 4-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" /></>,
  stamp: <><circle cx="16" cy="16" r="13" fill="url(#coinFill)" stroke="#8d5411" strokeWidth="2" /><circle cx="16" cy="16" r="10" stroke="#fff0ad" strokeWidth="1.4" fill="none" /><path d="m16 8 2.4 5 5.5.8-4 4 .9 5.5-4.8-2.6-4.8 2.6.9-5.5-4-4 5.5-.8z" fill="#fff8d5" stroke="#8d5411" strokeWidth="1" /></>,
};

export function PortalIcon({ name, className = '' }: { name: PortalIconName; className?: string }) {
  const filled = name === 'coin' || name === 'life' || name === 'stamp';
  return <svg className={`portal-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {filled && <defs><linearGradient id="coinFill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff4ab" /><stop offset=".5" stopColor="#ffcf4b" /><stop offset="1" stopColor="#bb6e0e" /></linearGradient><linearGradient id="lifeFill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff9a92" /><stop offset=".6" stopColor="#ef4558" /><stop offset="1" stopColor="#a81738" /></linearGradient></defs>}
    {drawings[name]}
  </svg>;
}
