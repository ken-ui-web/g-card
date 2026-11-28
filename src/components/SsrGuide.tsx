import { getCard } from '../data/cards';
import { Card } from './Card';

export function SsrGuide({ compact = false }: { compact?: boolean }) {
  return <aside className={`ssr-guide${compact ? ' ssr-guide--compact' : ''}`} aria-label="SSRカードの特徴">
    <div className="ssr-guide__cards" aria-hidden="true">
      {['G015', 'C014', 'P015'].slice(0, compact ? 1 : 3).map((id) => <div className="ssr-guide__sample" key={id}><Card card={getCard(id)} thumbnail /><span>SSR</span></div>)}
    </div>
    <div><strong>SSRは、あいこでも効果が発動！</strong><p>強い光と「SSR」の表示が目印。<br />デッキに入れられるのは1枚まで。</p></div>
  </aside>;
}
