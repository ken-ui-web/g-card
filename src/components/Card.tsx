import { typeLabels, type CardDefinition, type CardType } from '../data/cards';

export type CardSide = 'front' | 'back';

type CardProps = {
  card: CardDefinition;
  side?: CardSide;
  backType?: CardType;
  damage?: number | null;
  width?: number;
  className?: string;
};

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function Card({ card, side = 'front', backType, damage, width, className = '' }: CardProps) {
  const type = backType ?? card.type;
  const image = side === 'back'
    ? `images/card-parts/back-${type}.webp`
    : `images/cards/${card.frontImage}`;
  const label = side === 'back'
    ? `${typeLabels[type]}のカードの裏面。${card.rarity === 'SSR' ? 'SSR。' : ''}カード名と効果は未公開`
    : `${card.name}。${typeLabels[type]}。${card.text}${damage !== null && damage !== undefined ? `。最終ダメージ${damage}` : ''}`;

  return (
    <div className={`card card--${side} ${card.rarity === 'SSR' ? 'card--ssr' : ''} ${className}`} style={width ? { width: `min(${width}px, 100%)` } : undefined} role="img" aria-label={label}>
      <img src={asset(image)} alt="" draggable={false} />
      {side === 'back' && card.rarity === 'SSR' && <><img className="card__ssr-border" src={asset('images/card-parts/back-ssr-overlay.png')} alt="" draggable={false} /><span className="card__ssr-badge" aria-hidden="true">SSR</span></>}
      {side === 'front' && damage !== null && damage !== undefined && <span className="card__damage" aria-hidden="true">{damage}</span>}
    </div>
  );
}
