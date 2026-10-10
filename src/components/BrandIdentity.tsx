const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
const updateDate = import.meta.env.VITE_BUILD_DATE || '10/10';

function BrandContent() {
  return <><img src={logoUrl} alt="Gカード" /><span className="brand-identity__details"><small>ver1.5 · 最終更新 {updateDate}</small><span>ショップの買い方を見やすくしました。</span></span></>;
}

export function BrandIdentity({ onClick, href = '#/home' }: { onClick?: () => void; href?: string }) {
  return onClick ? <button type="button" className="brand-identity" onClick={onClick}><BrandContent /></button>
    : <a className="brand-identity" href={href}><BrandContent /></a>;
}
