const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
// Add student-facing changes to this day's list; admin-only changes do not affect it.
const studentRelease = {
  version: '2.0',
  date: '11/20',
  changes: ['ゲスト同士も自分のカードと育成した強さでオンライン対戦できるようになりました。部屋の作成も安定させました。'],
} as const;

function BrandContent() {
  return <><img src={logoUrl} alt="Gカード" /><span className="brand-identity__details"><small>ver{studentRelease.version} · 最終更新 {studentRelease.date}</small><span>{studentRelease.changes.join(' ')}</span></span></>;
}

export function BrandIdentity({ onClick, href = '#/home' }: { onClick?: () => void; href?: string }) {
  return onClick ? <button type="button" className="brand-identity" onClick={onClick}><BrandContent /></button>
    : <a className="brand-identity" href={href}><BrandContent /></a>;
}
