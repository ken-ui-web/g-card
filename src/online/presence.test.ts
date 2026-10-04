import { describe, expect, it } from 'vitest';
import { opponentTimedOut, phaseSeconds, type PhaseClock } from './presence';

describe('オンライン対戦の切断時間', () => {
  it('Firebaseの切断通知が遅れても、最後の通信から30秒で判定する', () => {
    expect(opponentTimedOut(1_000, 30_999)).toBe(false);
    expect(opponentTimedOut(1_000, 31_000)).toBe(true);
    expect(opponentTimedOut(undefined, 60_000)).toBe(false);
  });

  it('切断中にカードの自動選択タイマーを進めない', () => {
    const clock: PhaseClock = { key: '', since: 0, pausedAt: null };
    expect(phaseSeconds(clock, 'round-1', 1_000, false)).toBe(0);
    expect(phaseSeconds(clock, 'round-1', 11_000, true)).toBe(0);
    expect(phaseSeconds(clock, 'round-1', 51_000, true)).toBe(0);
    expect(phaseSeconds(clock, 'round-1', 51_000, false)).toBe(10);
    expect(phaseSeconds(clock, 'round-1', 71_000, false)).toBe(30);
  });
});
