import type { BattleConfig } from './battle';

export interface TuningSettings extends BattleConfig {
  heals: Record<string, number>;
  animationSpeed: number;
}

export const defaultSettings: TuningSettings = {
  initialLife: 100,
  cpuMaxLife: 100,
  cpuTraining: 0,
  damages: { G001: 20, G002: 20, C008: 50, G006: 30, C002: 30, C014: 60 },
  heals: { P003: 30 },
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
      damages: {
        G001: numberInRange(raw.damages?.G001, 20, 0, 999),
        G002: numberInRange(raw.damages?.G002, 20, 0, 999),
        C008: numberInRange(raw.damages?.C008, 50, 0, 999),
        G006: numberInRange(raw.damages?.G006, 30, 0, 999),
        C002: numberInRange(raw.damages?.C002, 30, 0, 999),
        C014: numberInRange(raw.damages?.C014, 60, 0, 999),
      },
      heals: { P003: numberInRange(raw.heals?.P003, 30, 0, 999) },
      animationSpeed: [0.5, 1, 2].includes(raw.animationSpeed ?? 1) ? raw.animationSpeed! : 1,
    };
  } catch {
    return { ...defaultSettings, damages: { ...defaultSettings.damages }, heals: { ...defaultSettings.heals } };
  }
}

export function saveSettings(settings: TuningSettings): void {
  localStorage.setItem(key, JSON.stringify(settings));
}
