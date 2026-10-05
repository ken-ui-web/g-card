import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { availableCards } from '../data/cards';
import { DeckEditor } from './AdminEconomy';
import type { CardMaster } from './api';

describe('サンプル・CPUデッキ候補', () => {
  it('販売停止中を含む40枚とレア度・効果を表示する', () => {
    const cards = availableCards.map((card) => ({ ...card, image: card.frontImage, active: card.cardId === 'G001' })) as CardMaster[];
    const html = renderToStaticMarkup(<DeckEditor deck={{ deckId: 'sample', name: 'サンプルカードセット', cardIds: ['G001', 'G002', 'C008', 'P001'], maxLife: 100, rockTrainLevel: 0 }} cards={cards} onChange={() => {}} />);
    expect((html.match(/class="admin-deck-card"/g) ?? []).length).toBe(40);
    expect(html).toContain('プログラミング');
    expect(html).toContain('相手の次のカードを指定する');
    expect(html).toContain('SSR');
    expect(html).toContain('グー');
    expect(html).toContain('チョキ');
    expect(html).toContain('パー');
  });
});
