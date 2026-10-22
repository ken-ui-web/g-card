import { describe, expect, it } from 'vitest';
import { createTutorialBattle, playTutorialRound, tutorialOwnCards } from './tutorialBattle';

function permutations(cards: readonly string[]): string[][] {
  return cards.length ? cards.flatMap((card) => permutations(cards.filter((item) => item !== card)).map((rest) => [card, ...rest])) : [[]];
}

describe('チュートリアルの練習対戦', () => {
  it('どの順番で4枚を選んでも、対象選択やサーバー保存なしで最後まで遊べる', () => {
    for (const order of permutations(tutorialOwnCards)) {
      let state = createTutorialBattle();
      for (const cardId of order) {
        const instance = state.players[0].hand.find((card) => card.cardId === cardId);
        expect(instance).toBeDefined();
        state = playTutorialRound(state, instance!.instanceId);
      }
      expect(state.phase).toBe('finished');
      expect(state.history).toHaveLength(4);
      expect(state.players[0].hand).toHaveLength(0);
      expect(state.players[1].hand).toHaveLength(0);
    }
  });
});
