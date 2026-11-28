import { FramedArt } from './FramedArt';
import { typeLabels, type CardDefinition, type CardType } from '../data/cards';

export type CardSide = 'front' | 'back';

type CardProps = {
  card: CardDefinition;
  side?: CardSide;
  backType?: CardType | 'unknown';
  damage?: number | null;
  width?: number;
  className?: string;
  thumbnail?: boolean;
  frameId?: string;
};

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}${path.startsWith('images/cards/') ? `?v=${import.meta.env.VITE_BUILD_VERSION || 'dev'}` : ''}`;

export function Card({ card, side = 'front', backType, damage, width, className = '', thumbnail = false, frameId }: CardProps) {
  const type = backType ?? card.type;
  const image = side === 'back'
    ? `images/card-parts/back-${type}.webp`
    : `images/${thumbnail ? 'card-tips' : 'cards'}/${card.frontImage}`;
  const label = side === 'back'
    ? `${type === 'unknown' ? '種類不明' : typeLabels[type]}のカードの裏面。${card.rarity === 'SSR' ? 'SSR。' : ''}カード名と効果は未公開`
    : `${card.name}。${typeLabels[card.type]}。${card.text}${damage !== null && damage !== undefined ? `。最終ダメージ${damage}` : ''}`;

  return (
    <div className={`card card--${side} ${card.rarity === 'SSR' ? 'card--ssr' : ''} ${className}`} style={width ? { width: `min(${width}px, 100%)` } : undefined} role="img" aria-label={label}>
      <FramedArt frameId={frameId}>{side === 'back' && type === 'unknown' ? <span className="card__unknown" aria-hidden="true">?</span> : <img src={asset(image)} alt="" draggable={false} />}</FramedArt>
      {side === 'back' && card.rarity === 'SSR' && <><img className="card__ssr-border" src={asset('images/card-parts/back-ssr-overlay.png')} alt="" draggable={false} /><span className="card__ssr-badge" aria-hidden="true">SSR</span></>}
      {side === 'front' && damage !== null && damage !== undefined && <span className="card__damage" aria-hidden="true">{damage}</span>}
    </div>
  );
}
