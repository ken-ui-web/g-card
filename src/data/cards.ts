export type CardType = 'rock' | 'scissors' | 'paper';
export type Rarity = 'N' | 'R' | 'SR' | 'UR';

export type CardEffect =
  | { type: 'damage'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'changeOpponentType'; to: CardType };

export interface CardDefinition {
  cardId: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  text: string;
  effects: CardEffect[];
  trainingMultiplier: number;
  frontImage: string;
}

export const typeLabels: Record<CardType, string> = {
  rock: 'グー', scissors: 'チョキ', paper: 'パー',
};

export const initialCards: CardDefinition[] = [
  { cardId: 'G001', name: 'パンチ', type: 'rock', rarity: 'N', text: '20のダメージを与える', effects: [{ type: 'damage', amount: 20 }], trainingMultiplier: 1, frontImage: 'G001-front.webp' },
  { cardId: 'G002', name: 'キック', type: 'rock', rarity: 'N', text: '20のダメージを与える', effects: [{ type: 'damage', amount: 20 }], trainingMultiplier: 1, frontImage: 'G002-front.webp' },
  { cardId: 'C008', name: '火縄銃', type: 'scissors', rarity: 'R', text: '50のダメージを与える', effects: [{ type: 'damage', amount: 50 }], trainingMultiplier: 0, frontImage: 'C008-front.webp' },
  { cardId: 'P001', name: '手品', type: 'paper', rarity: 'N', text: '相手のカードを1枚選び、種類を【グー】に変える', effects: [{ type: 'changeOpponentType', to: 'rock' }], trainingMultiplier: 0, frontImage: 'P001-front.webp' },
];

export const addedCards: CardDefinition[] = [
  { cardId: 'P003', name: '救急箱', type: 'paper', rarity: 'N', text: 'ライフを30回復', effects: [{ type: 'heal', amount: 30 }], trainingMultiplier: 0, frontImage: 'P003-front.webp' },
];

export const availableCards = [...initialCards, ...addedCards];
export const defaultDeckIds = ['G001', 'C008', 'P001', 'P003'];

export const cardById = Object.fromEntries(availableCards.map((card) => [card.cardId, card])) as Record<string, CardDefinition>;

export function getCard(cardId: string): CardDefinition {
  const card = cardById[cardId];
  if (!card) throw new Error(`不明なカード: ${cardId}`);
  return card;
}
