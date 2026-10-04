import { getCard, initialCards, ssrCount, type CardEffect, type CardType, type Rarity } from '../data/cards';

export type PlayerIndex = 0 | 1;
export type BattleMode = 'cpu' | 'local';
export type DeckEntry = string | { cardId: string; ownedId: string; trainLevel: number };
export interface BattleCard {
  instanceId: string;
  cardId: string;
  rarity?: Rarity;
  originalType: CardType;
  currentType: CardType;
  trainLevel: number;
  nullified: boolean;
  revealedTo?: PlayerIndex[];
  publicType?: boolean;
}
export interface Shield { mode: 'half' | 'reduce' | 'reflect'; amount?: number }
export interface PlayerState {
  life: number;
  maxLife: number;
  hand: BattleCard[];
  used: BattleCard[];
  shields: Shield[];
  poison: number;
  delayed: { dueRound: number; amount: number }[];
  nextDamage: number;
  encrypted: boolean;
  blind: boolean;
  forcedCardId: string | null;
  startingCardIds: string[];
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
export interface RoundReveal { cards: [BattleCard, BattleCard]; winner: RoundWinner }
export type BattleEvent =
  | { kind: 'damage'; actor: PlayerIndex; target: PlayerIndex; amount: number }
  | { kind: 'heal'; actor: PlayerIndex; amount: number }
  | { kind: 'change'; actor: PlayerIndex; target: PlayerIndex; targetId: string; to: CardType }
  | { kind: 'status'; actor: PlayerIndex; text: string }
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
  seed: number;
  players: [PlayerState, PlayerState];
  round: number;
  phase: 'select' | 'reveal' | 'finished';
  reveal: RoundReveal | null;
  history: RoundLog[];
  outcome: BattleOutcome | null;
}
export type ChoiceKind = 'opponent' | 'own' | 'swapOwn' | 'swapOpponent' | 'encrypt';
export interface ChoiceRequest { actor: PlayerIndex; kind: ChoiceKind; options: BattleCard[]; effect: CardEffect; optional?: boolean }
export interface RoundChoice { targetId?: string; to?: CardType }
const beats: Record<CardType, CardType> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const other = (side: PlayerIndex): PlayerIndex => side === 0 ? 1 : 0;

export function compareTypes(a: CardType, b: CardType): -1 | 0 | 1 {
  return a === b ? 0 : beats[a] === b ? 1 : -1;
}
export function effectOrder(winner: RoundWinner, cards: readonly { cardId: string; nullified?: boolean }[], life: readonly number[], seed: number, round: number): PlayerIndex[] {
  if (winner !== null) return cards[winner].nullified ? [] : [winner];
  const actors = ([0, 1] as PlayerIndex[]).filter((side) => !cards[side].nullified && getCard(cards[side].cardId).rarity === 'SSR');
  if (actors.length < 2) return actors;
  if (life[0] !== life[1]) return life[0] < life[1] ? [0, 1] : [1, 0];
  const draw = (Math.imul((seed ^ round) >>> 0, 1664525) + 1013904223) >>> 0;
  return draw % 2 === 0 ? [0, 1] : [1, 0];
}
export function finalDamage(card: BattleCard, config: BattleConfig): number | null {
  const definition = getCard(card.cardId);
  const effect = definition.effects.find((item) => item.type === 'damage');
  if (!effect || effect.type !== 'damage') return null;
  const base = config.damages[card.cardId] ?? effect.amount;
  const training = definition.type === 'rock' ? (card.trainLevel + definition.trainingBonus) * definition.trainingMultiplier : 0;
  return Math.max(0, base + training);
}
export function shownDamage(state: BattleState, side: PlayerIndex, card: BattleCard): number | null {
  const definition = getCard(card.cardId);
  const damage = definition.effects.find((effect) => effect.type === 'damage');
  const enemy = state.players[other(side)];
  if (damage?.type === 'damage') {
    let amount = finalDamage(card, state.config) ?? 0;
    if (damage.condition === 'selfLifeLower' && state.players[side].life < enemy.life) amount *= damage.multiplierIfCondition ?? 1;
    if (damage.comboBonus && state.players[side].startingCardIds.includes(damage.comboBonus.requiresCardInDeck)) amount += damage.comboBonus.add;
    return amount + state.players[side].nextDamage;
  }
  const delayed = definition.effects.find((effect) => effect.type === 'delayedDamage');
  if (delayed?.type === 'delayedDamage') return delayed.amount;
  const remaining = definition.effects.find((effect) => effect.type === 'damagePerOpponentRemaining');
  if (remaining?.type === 'damagePerOpponentRemaining') return remaining.per * Math.max(0, enemy.hand.length - (state.phase === 'select' ? 1 : 0));
  const drain = definition.effects.find((effect) => effect.type === 'drain');
  return drain?.type === 'drain' ? drain.amount : null;
}
function createDeck(player: PlayerIndex, training: number, seed: number, entries: DeckEntry[]): BattleCard[] {
  if (entries.length !== 4 || new Set(entries.map((entry) => typeof entry === 'string' ? entry : entry.ownedId)).size !== 4) throw new Error('異なる所持カードを4枚選んでください');
  if (ssrCount(entries.map((entry) => typeof entry === 'string' ? entry : entry.cardId)) > 1) throw new Error('SSRはデッキに1枚までです');
  const deck = entries.map((entry) => {
    const card = getCard(typeof entry === 'string' ? entry : entry.cardId);
    return {
      instanceId: `${player}-${typeof entry === 'string' ? entry : entry.ownedId}`,
      cardId: card.cardId, rarity: card.rarity, originalType: card.type, currentType: card.type,
      trainLevel: card.type === 'rock' ? typeof entry === 'string' ? training : entry.trainLevel : 0,
      nullified: false,
    };
  });
  let current = seed >>> 0;
  for (let index = deck.length - 1; index > 0; index--) {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
    const target = current % (index + 1);
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}
export function createBattle(mode: BattleMode, config: BattleConfig, seed = 1, decks?: [DeckEntry[], DeckEntry[]]): BattleState {
  const entries = decks ?? [initialCards.map((card) => card.cardId), initialCards.map((card) => card.cardId)];
  const max0 = Math.max(1, config.initialLife);
  const max1 = Math.max(1, mode === 'cpu' ? config.cpuMaxLife : config.initialLife);
  const hand0 = createDeck(0, 0, seed ^ 0x6d2b79f5, entries[0]);
  const hand1 = createDeck(1, mode === 'cpu' ? config.cpuTraining : 0, seed ^ 0x9e3779b9, entries[1]);
  const player = (life: number, hand: BattleCard[]): PlayerState => ({
    life, maxLife: life, hand, used: [], shields: [], poison: 0, delayed: [],
    nextDamage: 0, encrypted: false, blind: false, forcedCardId: null,
    startingCardIds: hand.map((card) => card.cardId),
  });
  return { mode, config, seed, players: [player(max0, hand0), player(max1, hand1)], round: 1, phase: 'select', reveal: null, history: [], outcome: null };
}
export function requiredPick(state: BattleState, side: PlayerIndex): string | null {
  const player = state.players[side];
  if (player.forcedCardId && player.hand.some((card) => card.instanceId === player.forcedCardId)) return player.forcedCardId;
  if (!player.blind || player.hand.length === 0) return null;
  const draw = (Math.imul((state.seed ^ (state.round * 17 + side)) >>> 0, 1664525) + 1013904223) >>> 0;
  return player.hand[draw % player.hand.length].instanceId;
}
export function beginRound(state: BattleState, picks: [string, string]): BattleState {
  if (state.phase !== 'select') throw new Error('カードを選ぶ段階ではありません');
  const selected = state.players.map((player, side) => {
    const required = requiredPick(state, side as PlayerIndex);
    if (required && picks[side] !== required) throw new Error('指定されたカードを出してください');
    return player.hand.find((card) => card.instanceId === picks[side]);
  });
  if (!selected[0] || !selected[1]) throw new Error('残っているカードを選んでください');
  const cards = selected as [BattleCard, BattleCard];
  const comparison = compareTypes(cards[0].currentType, cards[1].currentType);
  const winner: RoundWinner = comparison === 0 ? null : comparison === 1 ? 0 : 1;
  const players = state.players.map((player, side) => ({
    ...player, forcedCardId: null,
    hand: player.hand.filter((card) => card.instanceId !== picks[side]),
    used: [...player.used, cards[side]],
  })) as [PlayerState, PlayerState];
  return { ...state, players, phase: 'reveal', reveal: { cards, winner } };
}
export function choiceRequests(state: BattleState): ChoiceRequest[] {
  if (state.phase !== 'reveal' || !state.reveal) return [];
  const requests: ChoiceRequest[] = [];
  const actors = effectOrder(state.reveal.winner, state.reveal.cards, state.players.map((player) => player.life), state.seed, state.round);
  for (const actor of actors) {
    const enemy = other(actor);
    for (const effect of getCard(state.reveal.cards[actor].cardId).effects) {
      if (['changeOpponentType', 'nullifyOpponentCard', 'revealOpponent', 'forceOpponentNext'].includes(effect.type) && state.players[enemy].hand.length)
        requests.push({ actor, kind: 'opponent', options: state.players[enemy].hand, effect });
      if (effect.type === 'changeOwnType' && state.players[actor].hand.length)
        requests.push({ actor, kind: 'own', options: state.players[actor].hand, effect });
      if (effect.type === 'encrypt' && state.players[actor].hand.length)
        requests.push({ actor, kind: 'encrypt', options: state.players[actor].hand, effect, optional: true });
      if (effect.type === 'swapCards' && state.players[actor].hand.length && state.players[enemy].hand.length) {
        requests.push({ actor, kind: 'swapOwn', options: state.players[actor].hand, effect });
        requests.push({ actor, kind: 'swapOpponent', options: state.players[enemy].hand, effect });
      }
    }
  }
  return requests;
}
export function targetOptions(state: BattleState): BattleCard[] { return choiceRequests(state)[0]?.options ?? []; }
function clonePlayer(player: PlayerState): PlayerState {
  return { ...player, hand: player.hand.map((card) => ({ ...card, revealedTo: [...(card.revealedTo ?? [])] })),
    used: [...player.used], shields: player.shields.map((shield) => ({ ...shield })), delayed: player.delayed.map((item) => ({ ...item })) };
}
export function finishRound(state: BattleState, selection?: string | RoundChoice[]): BattleState {
  if (state.phase !== 'reveal' || !state.reveal) throw new Error('公開中のラウンドがありません');
  const { cards, winner } = state.reveal;
  const players: [PlayerState, PlayerState] = [clonePlayer(state.players[0]), clonePlayer(state.players[1])];
  const activeModifier: [number, number] = [players[0].nextDamage, players[1].nextDamage];
  const events: BattleEvent[] = [];
  const requests = choiceRequests(state);
  const choices = typeof selection === 'string' ? [{ targetId: selection }] : selection ?? [];
  requests.forEach((request, index) => {
    const choice = choices[index];
    if (!choice?.targetId && request.optional) return;
    if (!choice?.targetId || !request.options.some((card) => card.instanceId === choice.targetId)) throw new Error('残りカードから対象を選んでください');
    if (request.kind === 'own' || request.kind === 'encrypt') {
      if (!choice.to || !['rock', 'scissors', 'paper'].includes(choice.to)) throw new Error('変更後の種類を選んでください');
    }
  });
  let requestIndex = 0;
  const take = (effect: CardEffect): RoundChoice | undefined => requests[requestIndex]?.effect === effect ? choices[requestIndex++] : undefined;
  const applyDamage = (actor: PlayerIndex, target: PlayerIndex, raw: number, pierce = false): number => {
    let amount = Math.max(0, Math.floor(raw));
    if (!pierce && players[target].shields.length && amount > 0) {
      const shield = players[target].shields.shift()!;
      if (shield.mode === 'half') amount = Math.floor(amount / 2);
      if (shield.mode === 'reduce') amount = Math.max(0, amount - (shield.amount ?? 0));
      if (shield.mode === 'reflect') {
        players[actor].life = Math.max(0, players[actor].life - amount);
        events.push({ kind: 'damage', actor: target, target: actor, amount });
        return 0;
      }
      events.push({ kind: 'status', actor: target, text: 'シールドが発動' });
    }
    const dealt = Math.min(players[target].life, amount);
    players[target].life = Math.max(0, players[target].life - amount);
    events.push({ kind: 'damage', actor, target, amount: dealt });
    return dealt;
  };
  const actors = effectOrder(winner, cards, players.map((player) => player.life), state.seed, state.round);
  if (winner === null) events.push({ kind: 'tie' });
  for (const actor of actors) {
    const enemy = other(actor);
    const played = cards[actor];
    for (const effect of getCard(played.cardId).effects) {
      if (effect.type === 'damage') {
        let amount = finalDamage(played, state.config) ?? 0;
        if (effect.condition === 'selfLifeLower' && players[actor].life < players[enemy].life) amount *= effect.multiplierIfCondition ?? 1;
        if (effect.comboBonus && players[actor].startingCardIds.includes(effect.comboBonus.requiresCardInDeck)) amount += effect.comboBonus.add;
        amount += activeModifier[actor];
        for (let hit = 0; hit < (effect.hits ?? 1); hit++) applyDamage(actor, enemy, amount, effect.pierce);
      } else if (effect.type === 'damagePerOpponentRemaining') {
        applyDamage(actor, enemy, effect.per * players[enemy].hand.length);
      } else if (effect.type === 'drain') {
        const dealt = applyDamage(actor, enemy, effect.amount);
        const before = players[actor].life;
        players[actor].life = Math.min(players[actor].maxLife, before + dealt);
        events.push({ kind: 'heal', actor, amount: players[actor].life - before });
      } else if (effect.type === 'heal') {
        const before = players[actor].life;
        players[actor].life = Math.min(players[actor].maxLife, before + Math.max(0, state.config.heals?.[played.cardId] ?? effect.amount));
        events.push({ kind: 'heal', actor, amount: players[actor].life - before });
      } else if (effect.type === 'selfDamage') {
        players[actor].life = Math.max(0, players[actor].life - effect.amount);
        events.push({ kind: 'damage', actor, target: actor, amount: effect.amount });
      } else if (effect.type === 'shield') {
        players[actor].shields.push({ mode: effect.mode, amount: effect.amount });
        events.push({ kind: 'status', actor, text: 'シールドを張った' });
      } else if (effect.type === 'nextRoundModifier') {
        players[actor].nextDamage += effect.add;
        events.push({ kind: 'status', actor, text: `次のラウンドのダメージ＋${effect.add}` });
      } else if (effect.type === 'poison') {
        players[enemy].poison += effect.amount;
        events.push({ kind: 'status', actor, text: `毒を付与（毎ラウンド${effect.amount}）` });
      } else if (effect.type === 'delayedDamage') {
        players[enemy].delayed.push({ dueRound: state.round + effect.afterRounds, amount: effect.amount });
        events.push({ kind: 'status', actor, text: `次のラウンド終了時に${effect.amount}ダメージ` });
      } else if (effect.type === 'blindOpponent') {
        players[enemy].blind = true;
        events.push({ kind: 'status', actor, text: '相手は残りカードをランダムに出す' });
      } else if (effect.type === 'changeAllOpponentType') {
        players[enemy].hand = players[enemy].hand.map((card) => ({ ...card, currentType: effect.to, publicType: true }));
        events.push({ kind: 'status', actor, text: '相手の残りカードをすべてパーに変更' });
      } else if (effect.type === 'encrypt') {
        players[actor].encrypted = true;
        const choice = take(effect);
        if (choice?.targetId && choice.to) {
          players[actor].hand = players[actor].hand.map((card) => card.instanceId === choice.targetId ? { ...card, currentType: choice.to!, publicType: false } : card);
        }
        events.push({ kind: 'status', actor, text: '残りカードの種類を暗号化した' });
      } else if (effect.type === 'swapCards') {
        const own = take(effect)?.targetId;
        const opposite = take(effect)?.targetId;
        if (own && opposite) {
          const ownCard = players[actor].hand.find((card) => card.instanceId === own)!;
          const otherCard = players[enemy].hand.find((card) => card.instanceId === opposite)!;
          players[actor].hand = players[actor].hand.map((card) => card.instanceId === own ? { ...otherCard, instanceId: own } : card);
          players[enemy].hand = players[enemy].hand.map((card) => card.instanceId === opposite ? { ...ownCard, instanceId: opposite } : card);
          events.push({ kind: 'status', actor, text: '残りカードを1枚ずつ交換した' });
        } else events.push({ kind: 'noTarget', actor });
      } else if (['changeOpponentType', 'changeOwnType', 'nullifyOpponentCard', 'revealOpponent', 'forceOpponentNext'].includes(effect.type)) {
        const choice = take(effect);
        const target = choice?.targetId;
        const side = effect.type === 'changeOwnType' ? actor : enemy;
        if (!target) { events.push({ kind: 'noTarget', actor }); continue; }
        players[side].hand = players[side].hand.map((card) => {
          if (card.instanceId !== target) return card;
          if (effect.type === 'changeOpponentType') return { ...card, currentType: effect.to, publicType: true };
          if (effect.type === 'changeOwnType') return { ...card, currentType: choice!.to!, publicType: true };
          if (effect.type === 'nullifyOpponentCard') return { ...card, nullified: true };
          if (effect.type === 'revealOpponent') return { ...card, revealedTo: [...new Set([...(card.revealedTo ?? []), actor])] };
          return card;
        });
        if (effect.type === 'forceOpponentNext') players[enemy].forcedCardId = target;
        if (effect.type === 'changeOpponentType' || effect.type === 'changeOwnType') events.push({ kind: 'change', actor, target: side, targetId: target, to: effect.type === 'changeOwnType' ? choice!.to! : effect.to });
        else events.push({ kind: 'status', actor, text: effect.type === 'nullifyOpponentCard' ? '相手のカード1枚を効果なしにした' : effect.type === 'revealOpponent' ? '相手のカード1枚の中身を見た' : '相手の次のカードを指定した' });
      }
    }
  }
  for (const side of [0, 1] as PlayerIndex[]) {
    if (players[side].poison > 0) applyDamage(other(side), side, players[side].poison);
    for (const delayed of players[side].delayed.filter((item) => item.dueRound === state.round)) {
      applyDamage(other(side), side, delayed.amount);
    }
    players[side].delayed = players[side].delayed.filter((item) => item.dueRound > state.round);
    players[side].nextDamage -= activeModifier[side];
  }
  const log: RoundLog = { round: state.round, cards, winner, events, lifeAfter: [players[0].life, players[1].life] };
  const exhausted = players.every((player) => player.hand.length === 0);
  let outcome: BattleOutcome | null = null;
  if (players.some((player) => player.life <= 0) || exhausted) outcome = players[0].life === players[1].life ? 'draw' : players[0].life > players[1].life ? 0 : 1;
  return { ...state, players, round: outcome === null ? state.round + 1 : state.round, phase: outcome === null ? 'select' : 'finished', reveal: null, history: [...state.history, log], outcome };
}
