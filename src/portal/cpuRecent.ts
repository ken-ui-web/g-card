import { callApi } from './api';
import type { CpuLevel } from '../game/cpu';

export type CpuResult = 'win' | 'loss' | 'draw';
export type CpuMatch = { battleId: string; result: CpuResult };
export type CpuRecent = Record<CpuLevel, CpuMatch[]>;

export const emptyCpuRecent = (): CpuRecent => ({ 1: [], 2: [], 3: [] });

export async function loadCpuRecent(session: string): Promise<CpuRecent> {
  return callApi<CpuRecent>('getCpuRecent', session);
}

export function addCpuMatch(history: CpuRecent, level: CpuLevel, match: CpuMatch): CpuRecent {
  return { ...history, [level]: [match, ...history[level].filter((item) => item.battleId !== match.battleId)].slice(0, 10) };
}

export function cpuStats(matches: CpuMatch[]) {
  const wins = matches.filter((item) => item.result === 'win').length;
  const losses = matches.filter((item) => item.result === 'loss').length;
  const draws = matches.filter((item) => item.result === 'draw').length;
  return { wins, losses, draws, rate: matches.length ? Math.round(wins / matches.length * 100) : null };
}
