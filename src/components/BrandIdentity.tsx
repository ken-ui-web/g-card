const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
// Add student-facing changes to this day's list; admin-only changes do not affect it.
const studentRelease = {
  version: '1.6',
  date: '10/11',
  changes: ['対戦のカード選択', '選択中カードの固定表示', 'トレーニングの固定表示'],
} as const;

function BrandContent() {
  return <><img src={logoUrl} alt="Gカード" /><span className="brand-identity__details"><small>ver{studentRelease.version} · 最終更新 {studentRelease.date}</small><span>{studentRelease.changes.join('・')}を更新しました。</span></span></>;
}

export function BrandIdentity({ onClick, href = '#/home' }: { onClick?: () => void; href?: string }) {
  return onClick ? <button type="button" className="brand-identity" onClick={onClick}><BrandContent /></button>
    : <a className="brand-identity" href={href}><BrandContent /></a>;
}
