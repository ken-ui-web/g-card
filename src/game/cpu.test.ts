import { describe, expect, it } from 'vitest';
import { beginRound, createBattle, type BattleConfig } from './battle';
import { availableCards, getCard } from '../data/cards';
import { chooseCpuCard, chooseCpuDeck, chooseCpuTarget, nextRandom, toCpuView } from './cpu';

const config: BattleConfig = { initialLife: 100, cpuMaxLife: 100, cpuTraining: 0, damages: { G001: 20, G002: 20, C008: 50 } };

describe('CPUの思考', () => {
  it('CPUは各プレイヤーデッキと異なる4枚・異なる種類構成を自分で選ぶ', () => {
    const pool = availableCards.map((card) => card.cardId);
    const types = (ids: string[]) => ids.map((id) => getCard(id).type).sort().join(',');
    for (const excluded of pool) {
      const player = pool.filter((id) => id !== excluded);
      for (const level of [1, 2, 3] as const) {
        const first = chooseCpuDeck(player, level, 12345);
        expect(first).toEqual(chooseCpuDeck(player, level, 12345));
        expect(first.ids).toHaveLength(4);
        expect(new Set(first.ids).size).toBe(4);
        expect(types(first.ids)).not.toBe(types(player));
      }
    }
    const initial = ['G001', 'C008', 'P001', 'P003'];
    expect(chooseCpuDeck(initial, 2, 1).ids).not.toEqual(chooseCpuDeck(initial, 3, 1).ids);
  });
  it('同じシードなら乱数とLv1の選択が再現できる', () => {
    const view = toCpuView(createBattle('cpu', config));
    expect(nextRandom(1234)).toEqual(nextRandom(1234));
    expect(chooseCpuCard(view, 1, 1234)).toEqual(chooseCpuCard(view, 1, 1234));
  });

  it('相手の裏面情報だけを渡し、未公開のカード名を読まない', () => {
    const state = createBattle('cpu', config);
    const view = toCpuView(state);
    expect(view.opponentBacks.map((back) => back.instanceId).sort()).toEqual(['0-C008', '0-G001', '0-G002', '0-P001']);
    expect('cardId' in view.opponentBacks[0]).toBe(false);
    const swapped = {
      ...state,
      players: [{ ...state.players[0], hand: state.players[0].hand.map((card, index) => ({ ...card, cardId: index === 0 ? 'G002' : index === 1 ? 'G001' : card.cardId })) }, state.players[1]] as typeof state.players,
    };
    expect(chooseCpuCard(toCpuView(state), 3, 44)).toEqual(chooseCpuCard(toCpuView(swapped), 3, 44));
  });

  it('Lv2は勝てる種類が多いカードを優先できる', () => {
    const view = toCpuView(createBattle('cpu', config));
    view.opponentBacks = view.opponentBacks.map((back) => ({ ...back, currentType: 'paper' }));
    const choices = Array.from({ length: 30 }, (_, seed) => chooseCpuCard(view, 2, seed * 7919).id);
    expect(choices.filter((id) => id === '1-C008').length).toBeGreaterThan(20);
  });

  it('Lv3は残りの全組み合わせを評価して合法なカードと対象を選ぶ', () => {
    const state = createBattle('cpu', config);
    const view = toCpuView(state);
    const chosen = chooseCpuCard(view, 3, 100).id;
    expect(view.ownCards.map((card) => card.instanceId)).toContain(chosen);
    const revealed = beginRound(state, ['0-G001', '1-P001']);
    const target = chooseCpuTarget(toCpuView(revealed), 3, 100).id;
    expect(revealed.players[0].hand.map((card) => card.instanceId)).toContain(target);
  });

  it('Lv3はライフが減っているとき救急箱の回復を評価できる', () => {
    const cards = ['G001', 'C008', 'P001', 'P003'];
    const view = toCpuView(createBattle('cpu', { ...config, heals: { P003: 30 } }, 1, [cards, cards]));
    view.ownLife = 50;
    view.ownCards = view.ownCards.filter((card) => ['G001', 'P003'].includes(card.cardId));
    view.opponentBacks = view.opponentBacks.filter((back) => back.originalType === 'rock');
    expect(chooseCpuCard(view, 3, 100).id).toBe('1-P003');
  });
});
