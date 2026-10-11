import { Card } from './Card';
import type { CardDefinition } from '../data/cards';

export function BattleDeckDock({ visible, cards, busy, disabled, busyText = '準備中…', onStart, onRemove }: {
  visible: boolean;
  cards: (CardDefinition | null)[];
  busy: boolean;
  disabled: boolean;
  busyText?: string;
  onStart: () => void;
  onRemove: (index: number) => void;
}) {
  if (!visible) return null;
  const count = cards.filter(Boolean).length;
  return <div className="battle-deck-dock" role="region" aria-label="選択中のカードと対戦開始">
    <button type="button" className="button button--primary battle-deck-dock__start" disabled={disabled} onClick={onStart}>
      <strong>{busy ? busyText : '対戦を始める'}</strong><small>{count} / 4 枚</small>
    </button>
    <div className="battle-deck-dock__slots" aria-label="選択中の4枚">
      {cards.map((card, index) => card ? <button type="button" className="battle-deck-dock__slot" key={index} title={`${index + 1}枚目：${card.name}（押すと外す）`} aria-label={`${index + 1}枚目の${card.name}を外す`} onClick={() => onRemove(index)}>
        <Card card={card} width={38} /><span aria-hidden="true">×</span>
      </button> : <span className="battle-deck-dock__slot battle-deck-dock__slot--empty" key={index} aria-label={`${index + 1}枚目は空き`}>空き</span>)}
    </div>
  </div>;
}
