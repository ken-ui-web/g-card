const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
// Change this only when a release changes the student-facing experience.
const studentRelease = { version: '1.5', date: '10/10', note: 'ショップの買い方を見やすくしました。' } as const;

function BrandContent() {
  return <><img src={logoUrl} alt="Gカード" /><span className="brand-identity__details"><small>ver{studentRelease.version} · 最終更新 {studentRelease.date}</small><span>{studentRelease.note}</span></span></>;
}

export function BrandIdentity({ onClick, href = '#/home' }: { onClick?: () => void; href?: string }) {
  return onClick ? <button type="button" className="brand-identity" onClick={onClick}><BrandContent /></button>
    : <a className="brand-identity" href={href}><BrandContent /></a>;
}
