import seeds from '../../seed/cards.json';

export type CardType = 'rock' | 'scissors' | 'paper';
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export type CardEffect =
  | { type: 'damage'; amount: number; hits?: number; pierce?: boolean; condition?: 'selfLifeLower'; multiplierIfCondition?: number; comboBonus?: { requiresCardInDeck: string; add: number } }
  | { type: 'heal'; amount: number }
  | { type: 'changeOpponentType'; to: CardType }
  | { type: 'changeOwnType'; count: number }
  | { type: 'changeAllOpponentType'; to: CardType }
  | { type: 'shield'; mode: 'half' | 'reduce' | 'reflect'; amount?: number }
  | { type: 'nextRoundModifier'; target: 'self'; add: number }
  | { type: 'selfDamage'; amount: number }
  | { type: 'nullifyOpponentCard'; count: number }
  | { type: 'blindOpponent' }
  | { type: 'poison'; amount: number }
  | { type: 'delayedDamage'; amount: number; afterRounds: number }
  | { type: 'revealOpponent'; count: number }
  | { type: 'drain'; amount: number }
  | { type: 'damagePerOpponentRemaining'; per: number }
  | { type: 'swapCards' }
  | { type: 'encrypt'; secretTypeChange: number }
  | { type: 'forceOpponentNext' };

export interface CardDefinition {
  cardId: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  text: string;
  effects: CardEffect[];
  trainingMultiplier: number;
  trainingBonus: number;
  frontImage: string;
  shopPrice: number | null;
  inPack: boolean;
}

export const typeLabels: Record<CardType, string> = { rock: 'グー', scissors: 'チョキ', paper: 'パー' };
const descriptions: Record<string, string> = {
  G001: '20ダメージ', G002: '20ダメージ', G018: '15ダメージ＋10回復',
  G019: '10ダメージ＋次のラウンドの自分のダメージ＋10', G006: '30ダメージ',
  G007: '10ダメージ×3回', G020: '15ダメージ。自分のライフが少なければ2倍',
  G017: '15ダメージ＋次の被ダメージを10減らす', G021: '15ダメージ。筋トレ効果2倍',
  G009: '40ダメージ', G010: '60ダメージ。自分も25ダメージ',
  G012: '25ダメージ＋相手の残りカード1枚を効果なしにする',
  G022: '30ダメージ。筋トレ値を＋20して計算',
  G015: '30ダメージ＋相手は残りカードをランダムに出す',
  C002: '30ダメージ', C003: '25ダメージ', C016: '15ダメージ。デッキにげんのうがあれば＋15',
  C004: '15ダメージ×2回', C008: '50ダメージ', C006: '40ダメージ',
  C007: '10ダメージ＋毎ラウンド終了時に毒10ダメージ',
  C017: '20ダメージ＋相手の残りカード1枚を見る',
  C010: '40ダメージ。シールド貫通', C011: '55ダメージ',
  C013: '次のラウンド終了時に60ダメージ', C014: '60ダメージ',
  C015: '相手の残りカードの枚数×20ダメージ',
  P001: '相手の残りカード1枚をグーに変える',
  P002: '相手の残りカード1枚をチョキに変える',
  P017: '相手の残りカード1枚をパーに変える',
  P003: '30回復', P005: '次に受けるダメージを半分にする',
  P007: '相手の残りカード1枚を効果なしにする',
  P004: '自分の残りカード1枚を好きな種類に変える',
  P008: '20ダメージを与え、与えた分だけ回復',
  P010: '次に受けるダメージを相手に返す',
  P009: '自分と相手の残りカードを1枚ずつ交換',
  P018: '残りカードの種類を隠し、1枚をこっそり変えられる',
  P015: '相手の残りカードをすべてパーに変える',
  P014: '相手の次のカードを指定する',
};

export const availableCards: CardDefinition[] = seeds.map((seed) => ({
  ...seed,
  type: seed.type as CardType,
  rarity: seed.rarity as Rarity,
  effects: seed.effects as CardEffect[],
  text: descriptions[seed.cardId],
  frontImage: `${seed.cardId}-front.webp`,
}));
export const initialCards = ['G001', 'G002', 'C008', 'P001'].map((id) => availableCards.find((card) => card.cardId === id)!);
export const addedCards = availableCards.filter((card) => !initialCards.includes(card));
export const defaultDeckIds = ['G001', 'C008', 'P001', 'P003'];
export const cardById = Object.fromEntries(availableCards.map((card) => [card.cardId, card])) as Record<string, CardDefinition>;
export const ssrCount = (cardIds: string[]) => cardIds.filter((id) => cardById[id]?.rarity === 'SSR').length;

export function getCard(cardId: string): CardDefinition {
  const card = cardById[cardId];
  if (!card) throw new Error(`不明なカード: ${cardId}`);
  return card;
}
