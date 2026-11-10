const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
// Add student-facing changes to this day's list; admin-only changes do not affect it.
const studentRelease = {
  version: '1.10',
  date: '11/10',
  changes: ['オンライン対戦で保存したデッキが最初から選ばれます。'],
} as const;

function BrandContent() {
  return <><img src={logoUrl} alt="Gカード" /><span className="brand-identity__details"><small>ver{studentRelease.version} · 最終更新 {studentRelease.date}</small><span>{studentRelease.changes.join(' ')}</span></span></>;
}

export function BrandIdentity({ onClick, href = '#/home' }: { onClick?: () => void; href?: string }) {
  return onClick ? <button type="button" className="brand-identity" onClick={onClick}><BrandContent /></button>
    : <a className="brand-identity" href={href}><BrandContent /></a>;
}
