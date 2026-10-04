import { describe, expect, it } from 'vitest';
import { availableCards } from '../data/cards';
import { beginRound, choiceRequests, createBattle, finishRound, requiredPick, shownDamage, type BattleConfig, type BattleState, type RoundChoice } from './battle';

const config: BattleConfig = { initialLife: 100, cpuMaxLife: 100, cpuTraining: 0, damages: {}, heals: {} };
const make = (left: string[], right: string[]) => createBattle('local', config, 7, [left, right]);
const round = (battle: BattleState, left: string, right: string, choices: RoundChoice[] = []) => finishRound(beginRound(battle, [`0-${left}`, `1-${right}`]), choices);

describe('40枚のカード', () => {
  it('全カードに画像、説明、効果がある', () => {
    expect(availableCards).toHaveLength(40);
    expect(new Set(availableCards.map((card) => card.cardId)).size).toBe(40);
    expect(availableCards.every((card) => card.text && card.effects.length && card.frontImage === `${card.cardId}-front.webp`)).toBe(true);
  });
  it('連続攻撃は筋トレを毎ヒット加算し、シールドは最初のヒットだけ防ぐ', () => {
    const battle = make(['G007', 'P001', 'C008', 'G001'], ['P005', 'C008', 'G001', 'P001']);
    battle.players[0].hand.find((card) => card.cardId === 'G007')!.trainLevel = 2;
    const guarded = round(battle, 'G001', 'P005');
    expect(guarded.players[1].shields[0].mode).toBe('half');
    const next = round(guarded, 'G007', 'C008');
    expect(next.players[1].life).toBe(70);
    expect(next.history[1].events.filter((event) => event.kind === 'damage').map((event) => event.kind === 'damage' && event.amount)).toEqual([6, 12, 12]);
  });
  it('毒と時間差ダメージは終了時に発生し、鏡は次の1ヒットを跳ね返す', () => {
    const battle = make(['C007', 'C013', 'P001', 'G001'], ['P010', 'G001', 'P003', 'C008']);
    const first = round(battle, 'C007', 'P010');
    expect(first.players[1].life).toBe(80);
    const second = round(first, 'C013', 'P003');
    expect(second.players[1].life).toBe(70);
    const third = round(second, 'G001', 'G001');
    expect(third.players[1].life).toBe(0);
    const mirror = make(['P010', 'P003', 'G001', 'C008'], ['G001', 'C008', 'P001', 'G002']);
    const protectedSide = round(mirror, 'P010', 'G001');
    const reflected = round(protectedSide, 'P003', 'C008');
    expect(reflected.players[0].life).toBe(100);
    expect(reflected.players[1].life).toBe(50);
  });
  it('くぎは初期デッキにげんのうがある場合だけ強くなり、てこはライフ差で2倍になる', () => {
    const combo = make(['C003', 'C016', 'P001', 'G001'], ['P003', 'G001', 'G002', 'C008']);
    expect(shownDamage(combo, 0, combo.players[0].hand.find((card) => card.cardId === 'C016')!)).toBe(30);
    const hit = round(combo, 'C016', 'P003');
    expect(hit.players[1].life).toBe(70);
    const lever = make(['G020', 'G001', 'C008', 'P003'], ['C008', 'P001', 'G002', 'P003']);
    lever.players[0].life = 50;
    expect(round(lever, 'G020', 'C008').players[1].life).toBe(70);
  });
  it('封印、プログラミング、暗号化、入れ替えは対象を選び、後続ラウンドへ反映する', () => {
    const battle = make(['P014', 'P007', 'P009', 'G001'], ['G002', 'G001', 'G018', 'P003']);
    const revealed = beginRound(battle, ['0-P014', '1-G002']);
    expect(choiceRequests(revealed)).toHaveLength(1);
    const forced = finishRound(revealed, [{ targetId: '1-G001' }]);
    expect(requiredPick(forced, 1)).toBe('1-G001');
    const sealed = round(forced, 'P007', 'G001', [{ targetId: '1-P003' }]);
    expect(sealed.players[1].hand.find((card) => card.cardId === 'P003')?.nullified).toBe(true);
    const swapped = round(sealed, 'P009', 'G018', [{ targetId: '0-G001' }, { targetId: '1-P003' }]);
    expect(swapped.players[0].hand[0].cardId).toBe('P003');
    expect(swapped.players[1].hand[0].cardId).toBe('G001');
  });
  it('ジャイアントスイングの後は残りカードがシードで強制される', () => {
    const battle = make(['G015', 'P001', 'C008', 'G001'], ['C008', 'P003', 'G002', 'P001']);
    const next = round(battle, 'G015', 'C008');
    const forced = requiredPick(next, 1);
    expect(forced).toBeTruthy();
    expect(() => beginRound(next, ['0-P001', next.players[1].hand.find((card) => card.instanceId !== forced)!.instanceId])).toThrow('指定');
  });
});
