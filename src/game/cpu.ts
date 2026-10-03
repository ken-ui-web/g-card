import { availableCards, getCard, type CardType } from '../data/cards';
import { compareTypes, finalDamage, type BattleCard, type BattleConfig, type BattleState } from './battle';

export type CpuLevel = 1 | 2 | 3;

export interface PublicBack {
  instanceId: string;
  originalType: CardType;
  currentType: CardType;
}

export interface CpuView {
  ownLife: number;
  opponentLife: number;
  ownCards: BattleCard[];
  opponentBacks: PublicBack[];
  config: BattleConfig;
}

// CPUへ渡す情報に、相手のカード名・効果・筋トレ値は含めない。
export function toCpuView(state: BattleState): CpuView {
  return {
    ownLife: state.players[1].life,
    opponentLife: state.players[0].life,
    ownCards: state.players[1].hand,
    opponentBacks: state.players[0].hand.map(({ instanceId, originalType, currentType }) => ({ instanceId, originalType, currentType })),
    config: state.config,
  };
}

export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { value: next / 4294967296, seed: next };
}

function typeCounts(ids: string[]): string {
  const counts = { rock: 0, scissors: 0, paper: 0 };
  for (const id of ids) counts[getCard(id).type]++;
  return `${counts.rock}:${counts.scissors}:${counts.paper}`;
}

// 候補から4枚を選ぶ。選ばれたカードと裏面の種類構成はプレイヤーと変える。
export function chooseCpuDeck(playerCardIds: string[], level: CpuLevel, seed: number, candidateIds = availableCards.map((card) => card.cardId)): { ids: string[]; seed: number } {
  const pool = candidateIds.filter((id, index) => candidateIds.indexOf(id) === index);
  const combinations: string[][] = [];
  for (let a = 0; a < pool.length - 3; a++) {
    for (let b = a + 1; b < pool.length - 2; b++) {
      for (let c = b + 1; c < pool.length - 1; c++) {
        for (let d = c + 1; d < pool.length; d++) combinations.push([pool[a], pool[b], pool[c], pool[d]]);
      }
    }
  }
  const playerSet = new Set(playerCardIds);
  const different = combinations.filter((ids) =>
    !ids.every((id) => playerSet.has(id)) && typeCounts(ids) !== typeCounts(playerCardIds),
  );
  if (combinations.length === 0) throw new Error('CPUが選べるカードが足りません');
  const eligible = different.length ? different : combinations;
  if (level === 1) {
    const draw = nextRandom(seed);
    return { ids: eligible[Math.floor(draw.value * eligible.length)], seed: draw.seed };
  }
  const score = (ids: string[]) => ids.reduce((total, id) => {
    const effect = getCard(id).effects[0];
    if (effect.type === 'damage') return total + effect.amount;
    if (effect.type === 'heal') return total + (level === 3 ? 23 : 15);
    return total + (level === 3 ? 17 : 20);
  }, 0) + (typeCounts(ids).split(':').every((count) => Number(count) > 0) ? 20 : 0);
  const ranked = [...eligible].sort((a, b) => score(b) - score(a) || a.join(',').localeCompare(b.join(',')));
  return { ids: ranked[0], seed };
}

function randomItem<T>(items: T[], seed: number): { item: T; seed: number } {
  if (items.length === 0) throw new Error('選べるカードがありません');
  const draw = nextRandom(seed);
  return { item: items[Math.floor(draw.value * items.length)], seed: draw.seed };
}

interface Forecast {
  ownLife: number;
  opponentLife: number;
  ownCards: BattleCard[];
  opponentBacks: PublicBack[];
}

function opponentDamage(card: PublicBack, config: BattleConfig): number {
  // 初期4枚の公開情報から種類ごとの期待値を置く。隠れている cardId は読まない。
  if (card.originalType === 'rock') return (config.damages.G001 + config.damages.G002) / 2;
  if (card.originalType === 'scissors') return config.damages.C008;
  return 0;
}

function forecastKey(state: Forecast): string {
  const own = state.ownCards.map((card) => `${card.instanceId}:${card.currentType}`).join(',');
  const backs = state.opponentBacks.map((card) => `${card.instanceId}:${card.currentType}`).join(',');
  return `${state.ownLife}|${state.opponentLife}|${own}|${backs}`;
}

function forecastValue(state: Forecast, config: BattleConfig, memo: Map<string, number>): number {
  if (state.ownLife <= 0 || state.opponentLife <= 0 || state.ownCards.length === 0 || state.opponentBacks.length === 0) {
    return state.ownLife - state.opponentLife;
  }
  const key = forecastKey(state);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const best = Math.max(...state.ownCards.map((card) => actionValue(state, card, config, memo)));
  memo.set(key, best);
  return best;
}

function actionValue(state: Forecast, own: BattleCard, config: BattleConfig, memo: Map<string, number>): number {
  const sum = state.opponentBacks.reduce((total, back) => {
    const ownCards = state.ownCards.filter((card) => card.instanceId !== own.instanceId);
    const opponentBacks = state.opponentBacks.filter((card) => card.instanceId !== back.instanceId);
    const next: Forecast = { ownLife: state.ownLife, opponentLife: state.opponentLife, ownCards, opponentBacks };
    const comparison = compareTypes(own.currentType, back.currentType);
    if (comparison > 0) {
      const definition = getCard(own.cardId);
      const healing = definition.effects.find((effect) => effect.type === 'heal');
      if (definition.effects.some((effect) => effect.type === 'damage')) {
        next.opponentLife = Math.max(0, next.opponentLife - (finalDamage(own, config) ?? 0));
      } else if (healing?.type === 'heal') {
        next.ownLife = Math.min(config.cpuMaxLife, next.ownLife + (config.heals?.[own.cardId] ?? healing.amount));
      } else if (opponentBacks.length > 0) {
        return total + Math.max(...opponentBacks.map((target) => forecastValue({
          ...next,
          opponentBacks: opponentBacks.map((candidate) => candidate.instanceId === target.instanceId ? { ...candidate, currentType: 'rock' } : candidate),
        }, config, memo)));
      }
    } else if (comparison < 0) {
      if (back.originalType === 'paper' && ownCards.length > 0) {
        return total + Math.min(...ownCards.map((target) => forecastValue({
          ...next,
          ownCards: ownCards.map((candidate) => candidate.instanceId === target.instanceId ? { ...candidate, currentType: 'rock' } : candidate),
        }, config, memo)));
      }
      next.ownLife = Math.max(0, next.ownLife - opponentDamage(back, config));
    }
    return total + forecastValue(next, config, memo);
  }, 0);
  return sum / state.opponentBacks.length;
}

export function chooseCpuCard(view: CpuView, level: CpuLevel, seed: number): { id: string; seed: number } {
  const cards = view.ownCards;
  if (cards.length === 0) throw new Error('CPUの手札がありません');
  if (cards.length === 1) return { id: cards[0].instanceId, seed };
  if (level === 1) {
    const picked = randomItem(cards, seed);
    return { id: picked.item.instanceId, seed: picked.seed };
  }
  if (level === 2) {
    const decision = nextRandom(seed);
    if (decision.value < 0.3) {
      const picked = randomItem(cards, decision.seed);
      return { id: picked.item.instanceId, seed: picked.seed };
    }
    const score = (card: BattleCard) => view.opponentBacks.filter((back) => compareTypes(card.currentType, back.currentType) > 0).length;
    const best = Math.max(...cards.map(score));
    const picked = randomItem(cards.filter((card) => score(card) === best), decision.seed);
    return { id: picked.item.instanceId, seed: picked.seed };
  }
  const state: Forecast = { ownLife: view.ownLife, opponentLife: view.opponentLife, ownCards: cards, opponentBacks: view.opponentBacks };
  const memo = new Map<string, number>();
  const scored = cards.map((card) => ({ card, value: actionValue(state, card, view.config, memo) }));
  scored.sort((a, b) => b.value - a.value || a.card.instanceId.localeCompare(b.card.instanceId));
  return { id: scored[0].card.instanceId, seed };
}

export function chooseCpuTarget(view: CpuView, level: CpuLevel, seed: number): { id: string; seed: number } {
  const targets = view.opponentBacks;
  if (targets.length === 0) throw new Error('対象カードがありません');
  if (level === 1) {
    const picked = randomItem(targets, seed);
    return { id: picked.item.instanceId, seed: picked.seed };
  }
  if (level === 2) {
    const score = (back: PublicBack) => view.ownCards.reduce((sum, card) =>
      sum + Number(compareTypes(card.currentType, 'rock') > 0) - Number(compareTypes(card.currentType, back.currentType) > 0), 0);
    const best = Math.max(...targets.map(score));
    const picked = randomItem(targets.filter((target) => score(target) === best), seed);
    return { id: picked.item.instanceId, seed: picked.seed };
  }
  const memo = new Map<string, number>();
  const scored = targets.map((target) => ({
    target,
    value: forecastValue({
      ownLife: view.ownLife, opponentLife: view.opponentLife, ownCards: view.ownCards,
      opponentBacks: targets.map((back) => back.instanceId === target.instanceId ? { ...back, currentType: 'rock' } : back),
    }, view.config, memo),
  }));
  scored.sort((a, b) => b.value - a.value || a.target.instanceId.localeCompare(b.target.instanceId));
  return { id: scored[0].target.instanceId, seed };
}
