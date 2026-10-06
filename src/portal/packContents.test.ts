import { describe, expect, it } from 'vitest';
import { packContents } from './packContents';
import { availableCards } from '../data/cards';
import type { CardMaster, PackMaster } from './api';

const cards = availableCards.filter((card) => ['G001', 'G002', 'C008', 'P001'].includes(card.cardId)).map((card) => ({
  ...card, image: card.frontImage, active: card.cardId === 'G001', inPack: true,
})) as CardMaster[];
const pack: PackMaster = { packId: 'test', name: '確認用', price: 200, cardsPerPack: 3, rarityRates: { N: 70, R: 30 }, cardPool: cards.map((card) => card.cardId), pityCount: 0 };

describe('パックの収録一覧', () => {
  it('単品販売停止中のカードも表示し、レア度内の枚数で抽選確率を割る', () => {
    const contents = packContents(pack, cards);
    expect(contents.find((item) => item.card.cardId === 'C008')?.chance).toBe(30);
    expect(contents.find((item) => item.card.cardId === 'G002')?.chance).toBeCloseTo(70 / 3);
    expect(contents).toHaveLength(4);
  });
});
