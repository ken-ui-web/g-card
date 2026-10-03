import { getCard, initialCards, type CardType } from '../data/cards';

export type PlayerIndex = 0 | 1;
export type BattleMode = 'cpu' | 'local';

export interface BattleCard {
  instanceId: string;
  cardId: string;
  originalType: CardType;
  currentType: CardType;
  trainLevel: number;
  nullified: boolean;
}

export interface PlayerState {
  life: number;
  maxLife: number;
  hand: BattleCard[];
  used: BattleCard[];
}

export interface BattleConfig {
  initialLife: number;
  cpuMaxLife: number;
  cpuTraining: number;
  damages: Record<string, number>;
  heals?: Record<string, number>;
}

export type RoundWinner = PlayerIndex | null;
export type BattleOutcome = PlayerIndex | 'draw';

export interface RoundReveal {
  cards: [BattleCard, BattleCard];
  winner: RoundWinner;
}

export type BattleEvent =
  | { kind: 'damage'; actor: PlayerIndex; target: PlayerIndex; amount: number }
  | { kind: 'heal'; actor: PlayerIndex; amount: number }
  | { kind: 'change'; actor: PlayerIndex; target: PlayerIndex; targetId: string; to: CardType }
  | { kind: 'noTarget'; actor: PlayerIndex }
  | { kind: 'tie' };

export interface RoundLog {
  round: number;
  cards: [BattleCard, BattleCard];
  winner: RoundWinner;
  events: BattleEvent[];
  lifeAfter: [number, number];
}

export interface BattleState {
  mode: BattleMode;
  config: BattleConfig;
  players: [PlayerState, PlayerState];
  round: number;
  phase: 'select' | 'reveal' | 'finished';
  reveal: RoundReveal | null;
  history: RoundLog[];
  outcome: BattleOutcome | null;
}

const beats: Record<CardType, CardType> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export function compareTypes(a: CardType, b: CardType): -1 | 0 | 1 {
  if (a === b) return 0;
  return beats[a] === b ? 1 : -1;
}

export function finalDamage(card: BattleCard, config: BattleConfig): number | null {
  const definition = getCard(card.cardId);
  const effect = definition.effects.find((item) => item.type === 'damage');
  if (!effect || effect.type !== 'damage') return null;
  const base = config.damages[card.cardId] ?? effect.amount;
  const training = card.originalType === 'rock' ? card.trainLevel * definition.trainingMultiplier : 0;
  return Math.max(0, base + training);
}

function createDeck(player: PlayerIndex, training: number, seed: number, cardIds: string[]): BattleCard[] {
  if (cardIds.length !== 4 || new Set(cardIds).size !== 4) throw new Error('異なるカードを4枚選んでください');
  const deck = cardIds.map((id) => getCard(id)).map((card) => ({
    instanceId: `${player}-${card.cardId}`,
    cardId: card.cardId,
    originalType: card.type,
    currentType: card.type,
    trainLevel: card.type === 'rock' ? training : 0,
    nullified: false,
  }));
  let current = seed >>> 0;
  for (let index = deck.length - 1; index > 0; index--) {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
    const other = current % (index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

export function createBattle(mode: BattleMode, config: BattleConfig, seed = 1, decks?: [string[], string[]]): BattleState {
  const cardIds = decks ?? [initialCards.map((card) => card.cardId), initialCards.map((card) => card.cardId)];
  const max0 = Math.max(1, config.initialLife);
  const max1 = Math.max(1, mode === 'cpu' ? config.cpuMaxLife : config.initialLife);
  return {
    mode, config,
    players: [
      { life: max0, maxLife: max0, hand: createDeck(0, 0, seed ^ 0x6d2b79f5, cardIds[0]), used: [] },
      { life: max1, maxLife: max1, hand: createDeck(1, mode === 'cpu' ? config.cpuTraining : 0, seed ^ 0x9e3779b9, cardIds[1]), used: [] },
    ],
    round: 1, phase: 'select', reveal: null, history: [], outcome: null,
  };
}

export function beginRound(state: BattleState, picks: [string, string]): BattleState {
  if (state.phase !== 'select') throw new Error('カードを選ぶ段階ではありません');
  const selected = state.players.map((player, index) => player.hand.find((card) => card.instanceId === picks[index]));
  if (!selected[0] || !selected[1]) throw new Error('残っているカードを選んでください');
  const cards = selected as [BattleCard, BattleCard];
  const comparison = compareTypes(cards[0].currentType, cards[1].currentType);
  const winner: RoundWinner = comparison === 0 ? null : comparison === 1 ? 0 : 1;
  const players = state.players.map((player, index) => ({
    ...player,
    hand: player.hand.filter((card) => card.instanceId !== picks[index]),
    used: [...player.used, cards[index]],
  })) as [PlayerState, PlayerState];
  return { ...state, players, phase: 'reveal', reveal: { cards, winner } };
}

export function targetOptions(state: BattleState): BattleCard[] {
  if (state.phase !== 'reveal' || !state.reveal || state.reveal.winner === null) return [];
  const actor = state.reveal.winner;
  const card = getCard(state.reveal.cards[actor].cardId);
  return card.effects.some((effect) => effect.type === 'changeOpponentType')
    ? state.players[actor === 0 ? 1 : 0].hand
    : [];
}

export function finishRound(state: BattleState, targetId?: string): BattleState {
  if (state.phase !== 'reveal' || !state.reveal) throw new Error('公開中のラウンドがありません');
  const { cards, winner } = state.reveal;
  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], hand: [...state.players[0].hand] },
    { ...state.players[1], hand: [...state.players[1].hand] },
  ];
  const events: BattleEvent[] = [];

  if (winner === null) {
    events.push({ kind: 'tie' });
  } else {
    const loser: PlayerIndex = winner === 0 ? 1 : 0;
    const played = cards[winner];
    if (!played.nullified) {
      for (const effect of getCard(played.cardId).effects) {
        if (effect.type === 'damage') {
          const amount = finalDamage(played, state.config) ?? 0;
          players[loser].life = Math.max(0, players[loser].life - amount);
          events.push({ kind: 'damage', actor: winner, target: loser, amount });
        } else if (effect.type === 'heal') {
          const before = players[winner].life;
          const amount = Math.max(0, state.config.heals?.[played.cardId] ?? effect.amount);
          players[winner].life = Math.min(players[winner].maxLife, before + amount);
          events.push({ kind: 'heal', actor: winner, amount: players[winner].life - before });
        } else if (effect.type === 'changeOpponentType') {
          if (players[loser].hand.length === 0) {
            events.push({ kind: 'noTarget', actor: winner });
          } else {
            if (!targetId || !players[loser].hand.some((card) => card.instanceId === targetId)) {
              throw new Error('相手の残りカードから対象を選んでください');
            }
            players[loser].hand = players[loser].hand.map((card) =>
              card.instanceId === targetId ? { ...card, currentType: effect.to } : card,
            );
            events.push({ kind: 'change', actor: winner, target: loser, targetId, to: effect.to });
          }
        }
      }
    }
  }

  const log: RoundLog = { round: state.round, cards, winner, events, lifeAfter: [players[0].life, players[1].life] };
  const knockedOut = players.some((player) => player.life <= 0);
  const exhausted = players.every((player) => player.hand.length === 0);
  let outcome: BattleOutcome | null = null;
  if (knockedOut || exhausted) {
    if (players[0].life === players[1].life) outcome = 'draw';
    else outcome = players[0].life > players[1].life ? 0 : 1;
  }
  return {
    ...state, players,
    round: outcome === null ? state.round + 1 : state.round,
    phase: outcome === null ? 'select' : 'finished',
    reveal: null, history: [...state.history, log], outcome,
  };
}
