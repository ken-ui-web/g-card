import caps from '../../seed/trainingCaps.json';

export const TRAINING_POLICY_VERSION = '2026-11-10-v1';
export const TRAINING_POLICY_BONUS = 100;

export function trainingCap(cardId: string): number {
  return (caps.exceptions as Record<string, number>)[cardId] ?? caps.default;
}

export function trainingCostBetween(fromLevel: number, toLevel: number, base = 20, step = 2): number {
  const count = Math.max(0, fromLevel - toLevel);
  return count * base + step * (fromLevel + toLevel - 1) * count / 2;
}
