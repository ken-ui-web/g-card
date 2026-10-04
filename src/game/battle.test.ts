import { describe, expect, it } from 'vitest';
import { beginRound, compareTypes, createBattle, effectOrder, finalDamage, finishRound, targetOptions, type BattleConfig } from './battle';

const config: BattleConfig = { initialLife: 100, cpuMaxLife: 100, cpuTraining: 0, damages: { G001: 20, G002: 20, C008: 50 } };
const play = (state: ReturnType<typeof createBattle>, left: string, right: string, target?: string) =>
  finishRound(beginRound(state, [`0-${left}`, `1-${right}`]), target);

describe('初期4枚のバトル', () => {
  it('同じシードなら手札の並びが再現できる', () => {
    const first = createBattle('local', config, 12345);
    const again = createBattle('local', config, 12345);
    expect(first.players.map((player) => player.hand.map((card) => card.cardId))).toEqual(again.players.map((player) => player.hand.map((card) => card.cardId)));
  });

  it('三すくみを現在の種類で判定する', () => {
    expect(compareTypes('rock', 'scissors')).toBe(1);
    expect(compareTypes('scissors', 'paper')).toBe(1);
    expect(compareTypes('paper', 'rock')).toBe(1);
    expect(compareTypes('rock', 'rock')).toBe(0);
  });

  it('あいこでは双方の効果を発動せず、カードだけを消費する', () => {
    const next = play(createBattle('local', config), 'G001', 'G002');
    expect(next.players.map((player) => player.life)).toEqual([100, 100]);
    expect(next.players.map((player) => player.hand.length)).toEqual([3, 3]);
    expect(next.history[0].events).toEqual([{ kind: 'tie' }]);
  });

  it('勝った側の効果だけを発動し、KOで即終了する', () => {
    const next = play(createBattle('local', { ...config, damages: { ...config.damages, G001: 110 } }), 'G001', 'C008');
    expect(next.players.map((player) => player.life)).toEqual([100, 0]);
    expect(next.outcome).toBe(0);
    expect(next.phase).toBe('finished');
  });

  it('手品は相手の未使用カードだけをグーに変える', () => {
    const revealed = beginRound(createBattle('local', config), ['0-P001', '1-G001']);
    expect(targetOptions(revealed).map((card) => card.cardId).sort()).toEqual(['C008', 'G002', 'P001']);
    expect(() => finishRound(revealed, '1-G001')).toThrow();
    const next = finishRound(revealed, '1-C008');
    expect(next.players[1].hand.find((card) => card.cardId === 'C008')?.currentType).toBe('rock');
    expect(next.players.map((player) => player.life)).toEqual([100, 100]);
    const round2 = beginRound(next, ['0-C008', '1-C008']);
    expect(round2.reveal?.winner).toBe(1);
  });

  it('最終ラウンドの手品に対象がなくても終了し、ライフで勝敗を決める', () => {
    let state = createBattle('local', config);
    state = play(state, 'G001', 'G002');
    state = play(state, 'G002', 'C008');
    state = play(state, 'C008', 'P001');
    state = play(state, 'P001', 'G001');
    expect(state.history[3].events).toEqual([{ kind: 'noTarget', actor: 0 }]);
    expect(state.outcome).toBe(0);
    expect(state.players.map((player) => player.life)).toEqual([100, 30]);
  });

  it('同時KO相当の同ライフでは引き分けになる', () => {
    const initial = createBattle('local', config);
    const exhausted = {
      ...initial,
      players: [{ ...initial.players[0], life: 0 }, { ...initial.players[1], life: 0 }] as typeof initial.players,
    };
    expect(play(exhausted, 'G001', 'G002').outcome).toBe('draw');
  });

  it('調整値と筋トレ値を最終ダメージに反映し、元画像の数値には依存しない', () => {
    const battle = createBattle('cpu', { ...config, cpuTraining: 5, damages: { ...config.damages, G001: 25 } });
    expect(finalDamage(battle.players[1].hand.find((card) => card.cardId === 'G001')!, battle.config)).toBe(30);
    expect(finalDamage(battle.players[1].hand.find((card) => card.cardId === 'P001')!, battle.config)).toBeNull();
  });
});

describe('救急箱を含む4枚デッキ', () => {
  const cards = ['G001', 'C008', 'P001', 'P003'];
  const newBattle = () => createBattle('local', { ...config, heals: { P003: 30 } }, 1, [cards, cards]);

  it('5枚の候補から選んだ4枚だけを使い、無効なデッキは拒否する', () => {
    expect(newBattle().players[0].hand.map((card) => card.cardId).sort()).toEqual([...cards].sort());
    expect(() => createBattle('local', config, 1, [[...cards, 'G002'], cards])).toThrow('4枚');
  });

  it('勝ったときだけ回復し、最大ライフを超えない', () => {
    const damaged = play(newBattle(), 'P001', 'C008');
    expect(damaged.players[0].life).toBe(50);
    const healed = play(damaged, 'P003', 'G001');
    expect(healed.players.map((player) => player.life)).toEqual([80, 100]);
    expect(healed.history[1].events).toEqual([{ kind: 'heal', actor: 0, amount: 30 }]);

    const battle = newBattle();
    const almostFull = { ...battle, players: [{ ...battle.players[0], life: 90 }, battle.players[1]] as typeof battle.players };
    const capped = play(almostFull, 'P003', 'G001');
    expect(capped.players[0].life).toBe(100);
    expect(capped.history[0].events).toEqual([{ kind: 'heal', actor: 0, amount: 10 }]);
  });

  it('あいこと敗北では救急箱の回復が発動しない', () => {
    const tied = play(newBattle(), 'P003', 'P001');
    expect(tied.history[0].events).toEqual([{ kind: 'tie' }]);
    expect(tied.players[0].life).toBe(100);
    const lost = play(newBattle(), 'P003', 'C008');
    expect(lost.players[0].life).toBe(50);
    expect(lost.history[0].events).toEqual([{ kind: 'damage', actor: 1, target: 0, amount: 50 }]);
  });
});

describe('所持カードのデッキ', () => {
  it('同じ名前の所持カードを別々に扱い、それぞれの筋トレ値を使う', () => {
    const owned = [
      { cardId: 'G001', ownedId: 'owned-a', trainLevel: 5 },
      { cardId: 'G001', ownedId: 'owned-b', trainLevel: 0 },
      { cardId: 'C008', ownedId: 'owned-c', trainLevel: 0 },
      { cardId: 'P001', ownedId: 'owned-d', trainLevel: 0 },
    ];
    const state = createBattle('cpu', { ...config, initialLife: 115 }, 1, [owned, ['G001', 'G002', 'C008', 'P001']]);
    expect(state.players[0].maxLife).toBe(115);
    expect(finalDamage(state.players[0].hand.find((card) => card.instanceId === '0-owned-a')!, config)).toBe(25);
    expect(finalDamage(state.players[0].hand.find((card) => card.instanceId === '0-owned-b')!, config)).toBe(20);
    expect(() => createBattle('cpu', config, 1, [[owned[0], owned[0], owned[2], owned[3]], ['G001', 'G002', 'C008', 'P001']])).toThrow('異なる所持カード');
  });
});

describe('第1弾とSSR', () => {
  const host = ['C014', 'G001', 'P002', 'P017'];
  const guest = ['C014', 'G002', 'P001', 'C002'];
  const battle = () => createBattle('local', { ...config, damages: { ...config.damages, C014: 60 } }, 7, [host, guest]);

  it('レーザーカッターは勝ちとあいこで発動し、負けでは発動しない', () => {
    expect(play(battle(), 'C014', 'P001').players[1].life).toBe(40);
    expect(play(battle(), 'C014', 'G002').players[1].life).toBe(100);
    expect(play(battle(), 'C014', 'C002').players[1].life).toBe(40);
  });

  it('双方SSRのあいこはライフが少ない順に両方発動し、同時KOは引き分け', () => {
    expect(effectOrder(null, [{ cardId: 'C014' }, { cardId: 'C014' }], [80, 40], 7, 1)).toEqual([1, 0]);
    expect(effectOrder(null, [{ cardId: 'C014' }, { cardId: 'C014' }], [100, 100], 7, 1)).toEqual(effectOrder(null, [{ cardId: 'C014' }, { cardId: 'C014' }], [100, 100], 7, 1));
    const state = battle();
    state.players[0].life = 60;
    state.players[1].life = 60;
    const finished = play(state, 'C014', 'C014');
    expect(finished.history[0].events.filter((event) => event.kind === 'damage')).toHaveLength(2);
    expect(finished.outcome).toBe('draw');
  });

  it('効果なしSSRは発動せず、SSR2枚のデッキは拒否する', () => {
    const state = battle();
    state.players[0].hand.find((card) => card.cardId === 'C014')!.nullified = true;
    expect(play(state, 'C014', 'C002').players[1].life).toBe(100);
    const duplicate = [{ cardId: 'C014', ownedId: 'one', trainLevel: 0 }, { cardId: 'C014', ownedId: 'two', trainLevel: 0 }, { cardId: 'G001', ownedId: 'three', trainLevel: 0 }, { cardId: 'P001', ownedId: 'four', trainLevel: 0 }];
    expect(() => createBattle('local', config, 1, [duplicate, guest])).toThrow('SSRはデッキに1枚まで');
  });

  it('催眠術とおりがみは選んだ残りカードの種類を変える', () => {
    const hypnotized = play(battle(), 'P002', 'G002', '1-P001');
    expect(hypnotized.players[1].hand.find((card) => card.cardId === 'P001')?.currentType).toBe('scissors');
    const folded = play(battle(), 'P017', 'G002', '1-P001');
    expect(folded.players[1].hand.find((card) => card.cardId === 'P001')?.currentType).toBe('paper');
  });
});
