import { beginRound, choiceRequests, createBattle, finishRound, type BattleState } from '../game/battle';

export const tutorialOwnCards = ['G001', 'C002', 'P003', 'P008'] as const;
export const tutorialCpuCards = ['C003', 'P005', 'G002', 'G018'] as const;
const cpuOrder = ['C003', 'P005', 'G002', 'G018'] as const;

export const tutorialGuide = [
  '最初の相手はチョキ。グーなら勝てます。',
  '次の相手はパー。チョキなら勝てます。',
  '次の相手はグー。パーなら勝てます。',
  '最後は自分で考えて選ぼう。相手はグーです。',
] as const;

export function createTutorialBattle(): BattleState {
  return createBattle('cpu', { initialLife: 100, cpuMaxLife: 100, cpuTraining: 0, damages: {}, heals: {} }, 2026, [[...tutorialOwnCards], [...tutorialCpuCards]]);
}

export function playTutorialRound(state: BattleState, ownInstanceId: string): BattleState {
  if (state.phase !== 'select') throw new Error('練習対戦は終了しています');
  const cpu = state.players[1].hand.find((card) => card.cardId === cpuOrder[state.round - 1]);
  if (!cpu) throw new Error('相手のカードが見つかりません');
  const opened = beginRound(state, [ownInstanceId, cpu.instanceId]);
  if (choiceRequests(opened).length) throw new Error('練習用カードの効果を確認してください');
  return finishRound(opened);
}
