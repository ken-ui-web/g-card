import { describe, expect, it } from 'vitest';
import { beginRound, createBattle, finishRound, type DeckEntry } from './battle';
import { CHRISTMAS_FRAME_ID } from '../data/frames';
const config = { initialLife: 100, cpuMaxLife: 100, cpuTraining: 0, damages: {} };
function match(cardId: string, enemy = 'C008') {
  const left: DeckEntry[] = [{ cardId, ownedId: 'framed', trainLevel: 0, frameId: CHRISTMAS_FRAME_ID }, 'C011', 'P003', 'G002'];
  return createBattle('local', config, 1, [left, [enemy, ...['P003', 'G001', 'G002', 'C011'].filter((id) => id !== enemy).slice(0,3)]]);
}
function play(cardId: string, enemy?: string) {
  const state = match(cardId, enemy);
  return finishRound(beginRound(state, ['0-framed', `1-${enemy ?? 'C008'}`]));
}
describe('永続クリスマスフレーム', () => {
  it('勝った効果の後に最大HPを超えて10回復する', () => expect(play('G001').players[0].life).toBe(110));
  it('サンタアッパーは通常回復と追加回復を分け、あいこでも発動する', () => {
    const result = play('G023', 'G001');
    expect(result.players[0].life).toBe(110);
    expect(result.players[1].life).toBe(70);
  });
  it('Nカードのあいこと敗北では回復しない', () => {
    expect(play('G001', 'G001').players[0].life).toBe(100);
    expect(play('G001', 'P003').players[0].life).toBe(100);
  });
  it('通常回復でオーバーしたHPを減らさない', () => {
    const state = match('G001'); state.players[0].life = 120;
    const next = finishRound(beginRound(state, ['0-P003', '1-G001']));
    expect(next.players[0].life).toBe(120);
  });
  it('封印されて効果が発動しないときはフレームも発動しない', () => {
    const state = match('G001'); state.players[0].hand.find((card) => card.cardId === 'G001')!.nullified = true;
    expect(finishRound(beginRound(state,['0-framed','1-C008'])).players[0].life).toBe(100);
  });
  it('入れ替えた物理カードにフレームが付いていく', () => {
    const state = createBattle('local',config,1,[['P009',{cardId:'G001',ownedId:'frame',trainLevel:0,frameId:CHRISTMAS_FRAME_ID},'G002','C008'],['G002','P003','G001','C008']]);
    const next = finishRound(beginRound(state,['0-P009','1-G002']),[{targetId:'0-frame'},{targetId:'1-P003'}]);
    expect(next.players[1].hand.find((card) => card.cardId === 'G001' && card.frameId)?.frameId).toBe(CHRISTMAS_FRAME_ID);
    expect(next.players[0].hand.some((card) => card.frameId)).toBe(false);
  });
  it('同じデッキに2枚のフレームを付けられない', () => {
    expect(() => createBattle('local', config, 1, [[{cardId:'G001',ownedId:'a',trainLevel:0,frameId:CHRISTMAS_FRAME_ID},{cardId:'G002',ownedId:'b',trainLevel:0,frameId:CHRISTMAS_FRAME_ID},'P003','C008'], ['G001','G002','C008','P003']])).toThrow('フレーム');
  });
});
