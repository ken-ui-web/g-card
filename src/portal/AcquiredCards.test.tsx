import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { availableCards } from '../data/cards';
import type { CardMaster } from './api';
import { AcquiredCards } from './EconomyPages';

describe('パック開封結果', () => {
  it('SR以上確定パックでも取得したカードの表面画像を直接表示する', () => {
    const cards = ['rock', 'scissors', 'paper'].map((type) => {
      const card = availableCards.find((entry) => entry.type === type && ['SR', 'SSR'].includes(entry.rarity));
      expect(card).toBeDefined();
      return { ...card!, image: card!.frontImage, active: true };
    }) satisfies CardMaster[];
    const html = renderToStaticMarkup(<AcquiredCards cards={cards} />);
    expect((html.match(/class="economy-feedback__card-front"/g) ?? []).length).toBe(3);
    expect(html).not.toContain('economy-feedback__card-back');
    for (const card of cards) expect(html).toContain(`images/cards/${card.image}`);
  });
});
