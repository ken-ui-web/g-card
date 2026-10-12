import { describe, expect, it } from 'vitest';
import { addCpuMatch, cpuStats, emptyCpuRecent } from './cpuRecent';

describe('CPU対戦の直近記録', () => {
  it('レベルごとに直近10試合を残し、引き分けも含めた勝率を示す', () => {
    let recent = emptyCpuRecent();
    for (let index = 0; index < 12; index++) recent = addCpuMatch(recent, 1, { battleId: String(index), result: index < 7 ? 'win' : index < 9 ? 'loss' : 'draw' });
    recent = addCpuMatch(recent, 2, { battleId: 'other', result: 'win' });
    expect(recent[1]).toHaveLength(10);
    expect(recent[1][0].battleId).toBe('11');
    expect(recent[2]).toHaveLength(1);
    expect(cpuStats(recent[1])).toEqual({ wins: 5, losses: 2, draws: 3, rate: 50 });
    expect(cpuStats(recent[3]).rate).toBeNull();
    recent = addCpuMatch(recent, 1, { battleId: '11', result: 'draw' });
    expect(recent[1]).toHaveLength(10);
  });
});
