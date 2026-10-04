import type { BattleConfig } from './battle';
import { availableCards } from '../data/cards';

export interface TuningSettings extends BattleConfig {
  heals: Record<string, number>;
  animationSpeed: number;
}

export const defaultSettings: TuningSettings = {
  initialLife: 100,
  cpuMaxLife: 100,
  cpuTraining: 0,
  damages: Object.fromEntries(availableCards.flatMap((card) => card.effects.filter((effect) => effect.type === 'damage').map((effect) => [card.cardId, effect.amount]))),
  heals: Object.fromEntries(availableCards.flatMap((card) => card.effects.filter((effect) => effect.type === 'heal').map((effect) => [card.cardId, effect.amount]))),
  animationSpeed: 1,
};

const key = 'g-card-stage3-tuning';
const numberInRange = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export function loadSettings(): TuningSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<TuningSettings>;
    return {
      initialLife: numberInRange(raw.initialLife, 100, 1, 999),
      cpuMaxLife: numberInRange(raw.cpuMaxLife, 100, 1, 999),
      cpuTraining: numberInRange(raw.cpuTraining, 0, 0, 99),
      damages: Object.fromEntries(Object.entries(defaultSettings.damages).map(([id, amount]) => [id, numberInRange(raw.damages?.[id], amount, 0, 999)])),
      heals: Object.fromEntries(Object.entries(defaultSettings.heals).map(([id, amount]) => [id, numberInRange(raw.heals?.[id], amount, 0, 999)])),
      animationSpeed: [0.5, 1, 2].includes(raw.animationSpeed ?? 1) ? raw.animationSpeed! : 1,
    };
  } catch {
    return { ...defaultSettings, damages: { ...defaultSettings.damages }, heals: { ...defaultSettings.heals } };
  }
}

export function saveSettings(settings: TuningSettings): void {
  localStorage.setItem(key, JSON.stringify(settings));
}
