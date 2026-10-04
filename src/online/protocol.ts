import { beginRound, choiceRequests, compareTypes, effectOrder, finishRound, requiredPick, shownDamage, type BattleCard, type BattleConfig, type BattleState, type ChoiceRequest, type PlayerIndex, type RoundChoice, type Shield } from '../game/battle';
import { cardById, getCard, ssrCount, type CardType } from '../data/cards';

export type DeckMode = 'sample' | 'owned';
export type OnlineResult = 'win' | 'draw' | 'loss';
export interface OnlineEntry { cardId: string; ownedId?: string; trainLevel: number }
export interface PublicDeck { types: CardType[]; ssr: boolean[]; commit: string }
export interface RoundPick { index: number; salt: string; card: { cardId: string; trainLevel: number }; currentType?: CardType; combo?: boolean }
export interface OnlineRound {
  commit?: Record<string, string>;
  reveal?: Record<string, RoundPick>;
  choices?: Record<string, number | string>;
  swapReveal?: Record<string, { cardId: string; trainLevel: number }>;
  intelReveal?: Record<string, { cardId: string; trainLevel: number }>;
  stateHash?: Record<string, string>;
}
export interface OnlineRoom {
  meta: { battleId: string; deckMode: DeckMode; hostUid: string; guestUid?: string; seed: number; code?: string; teacherTest?: boolean; protocolVersion?: number; createdAt: number; expiresAt: number };
  players?: Record<string, { nickname: string; maxLife: number; connected: boolean; lastSeen: number }>;
  decks?: Record<string, PublicDeck>;
  rounds?: Record<string, OnlineRound>;
  final?: Record<string, { entries: OnlineEntry[]; salt: string; encryptProofs?: { round: number; index: number; to: CardType; salt: string }[] }>;
  forfeit?: { winnerUid: string; loserUid: string; at: number };
  receipts?: Record<string, boolean>;
}
export interface OnlineView {
  phase: 'deck' | 'select' | 'reveal' | 'target' | 'swapReveal' | 'intelReveal' | 'verify' | 'final' | 'finished' | 'forfeit' | 'invalid';
  round: number;
  life: [number, number];
  maxLife: [number, number];
  types: [CardType[], CardType[]];
  ssr: [boolean[], boolean[]];
  used: [number[], number[]];
  reveal?: [RoundPick, RoundPick];
  revealDamage?: [number | null, number | null];
  winner?: 0 | 1 | null;
  targetOwner?: 0 | 1;
  targetRequests?: { kind: ChoiceRequest['kind']; actor: PlayerIndex; options: number[]; optional?: boolean; effectType: string }[];
  swapTargets?: [number, number];
  intelTarget?: number;
  hidden?: [boolean[], boolean[]];
  blind?: [boolean, boolean];
  required?: [number | null, number | null];
  known?: [Record<number, OnlineEntry>, Record<number, OnlineEntry>];
  knownTo?: [number[], number[]];
  status?: { shields: [Shield[], Shield[]]; poison: [number, number]; delayed: [{ dueRound: number; amount: number }[], { dueRound: number; amount: number }[]]; nextDamage: [number, number]; nullified: [number[], number[]] };
  events: string[];
  outcome: 0 | 1 | 'draw' | null;
  error?: string;
}

export function stableDeck(entries: OnlineEntry[]): string {
  return JSON.stringify(entries.map((entry) => [entry.cardId, entry.ownedId || '', entry.trainLevel]));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
}

export function randomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (item) => item.toString(16).padStart(2, '0')).join('');
}

export const deckCommit = (entries: OnlineEntry[], salt: string) => sha256(`${stableDeck(entries)}:${salt}`);
export const pickCommit = (battleId: string, round: number, index: number, salt: string) => sha256(`${battleId}:${round}:${index}:${salt}`);

function invalid(view: OnlineView, error: string): OnlineView { return { ...view, phase: 'invalid', error }; }
export function stateKey(view: OnlineView): string {
  return JSON.stringify({ round: view.round, life: view.life, types: view.types, used: view.used, outcome: view.outcome, hidden: view.hidden, blind: view.blind, required: view.required, known: view.known, knownTo: view.knownTo, status: view.status, ssr: view.ssr });
}
export const stateDigest = (view: OnlineView) => sha256(stateKey(view));

// 両端末が同じ公開情報から状態を再計算する。相手の未公開カード名は使用しない。
async function deriveLegacyView(room: OnlineRoom): Promise<OnlineView> {
  const uids = [room.meta.hostUid, room.meta.guestUid || ''];
  const players = uids.map((uid) => room.players?.[uid]);
  const maxLife: [number, number] = [Number(players[0]?.maxLife || 100), Number(players[1]?.maxLife || 100)];
  const decks = uids.map((uid) => room.decks?.[uid]);
  const types: [CardType[], CardType[]] = [decks[0]?.types ? [...decks[0].types] : [], decks[1]?.types ? [...decks[1].types] : []];
  const ssr: [boolean[], boolean[]] = [decks[0]?.ssr ? [...decks[0].ssr] : [], decks[1]?.ssr ? [...decks[1].ssr] : []];
  let view: OnlineView = { phase: 'deck', round: 1, life: [...maxLife], maxLife, types, ssr, used: [[], []], events: [], outcome: null };
  if (room.forfeit) {
    const winner = uids.indexOf(room.forfeit.winnerUid);
    const loser = uids.indexOf(room.forfeit.loserUid);
    if (winner < 0 || loser < 0 || winner === loser) return invalid(view, '不戦勝の情報が正しくありません');
    return { ...view, phase: 'forfeit', outcome: winner as 0 | 1 };
  }
  if (!uids[1] || !decks[0] || !decks[1]) return view;
  if (types.some((list) => list.length !== 4 || list.some((type) => !['rock', 'scissors', 'paper'].includes(type)))) return invalid(view, 'カードの種類が正しくありません');
  if (ssr.some((list) => list.length !== 4 || list.some((value) => typeof value !== 'boolean') || list.filter(Boolean).length > 1)) return invalid(view, 'SSRはデッキに1枚までです');
  for (let round = 1; round <= 4; round++) {
    view = { ...view, round, events: [], reveal: undefined, winner: undefined, targetOwner: undefined };
    const record = room.rounds?.[String(round)];
    if (!record?.commit?.[uids[0]] || !record.commit[uids[1]]) return { ...view, phase: 'select' };
    const picks = uids.map((uid) => record.reveal?.[uid]);
    if (!picks[0] || !picks[1]) return { ...view, phase: 'reveal' };
    const reveal = picks as [RoundPick, RoundPick];
    for (let side = 0; side < 2; side++) {
      const pick = reveal[side];
      if (!Number.isInteger(pick.index) || pick.index < 0 || pick.index > 3 || view.used[side].includes(pick.index) ||
          !cardById[pick.card.cardId] || cardById[pick.card.cardId].type !== room.decks![uids[side]].types[pick.index] ||
          (cardById[pick.card.cardId].rarity === 'SSR') !== ssr[side][pick.index] ||
          !Number.isInteger(pick.card.trainLevel) || pick.card.trainLevel < 0 || pick.card.trainLevel > 99 ||
          await pickCommit(room.meta.battleId, round, pick.index, pick.salt) !== record.commit[uids[side]]) return invalid(view, 'カードの公開情報が一致しません');
    }
    const comparison = compareTypes(types[0][reveal[0].index], types[1][reveal[1].index]);
    const winner = comparison === 0 ? null : comparison > 0 ? 0 : 1;
    view.reveal = reveal; view.winner = winner;
    const used: [number[], number[]] = [[...view.used[0], reveal[0].index], [...view.used[1], reveal[1].index]];
    const life: [number, number] = [...view.life];
    const nextTypes: [CardType[], CardType[]] = [[...types[0]], [...types[1]]];
    const actors = effectOrder(winner, reveal.map((pick) => pick.card), life, room.meta.seed, round);
    if (winner === null) view.events.push(actors.length === 2 ? 'SSR同時発動！' : actors.length === 1 ? 'SSR発動！' : 'あいこ。効果は発動しません。');
    for (const actor of actors) {
      const loser = actor === 0 ? 1 : 0;
      for (const effect of getCard(reveal[actor].card.cardId).effects) {
        if (effect.type === 'damage') {
          const definition = getCard(reveal[actor].card.cardId);
          const amount = effect.amount + (definition.type === 'rock' ? (reveal[actor].card.trainLevel + (definition.trainingBonus ?? 0)) * definition.trainingMultiplier : 0);
          life[loser] = Math.max(0, life[loser] - amount);
          view.events.push(`${amount}ダメージ`);
        } else if (effect.type === 'heal') {
          const amount = Math.min(effect.amount, maxLife[actor] - life[actor]);
          life[actor] += amount;
          view.events.push(`${amount}回復`);
        } else if (effect.type === 'changeOpponentType') {
          const candidates = [0, 1, 2, 3].filter((index) => !used[loser].includes(index));
          if (candidates.length) {
            const target = record.choices?.[uids[actor]];
            if (target === undefined) return { ...view, used, phase: 'target', targetOwner: actor };
            if (typeof target !== 'number' || !candidates.includes(target)) return invalid(view, '手品の対象が正しくありません');
            nextTypes[loser][target] = effect.to;
            view.events.push(`相手の残りカードの種類を変更`);
          }
        }
    }
    }
    const outcome = life[0] <= 0 || life[1] <= 0 || round === 4 ? life[0] === life[1] ? 'draw' : life[0] > life[1] ? 0 : 1 : null;
    view = { ...view, life, types: nextTypes, used, outcome };
    types[0] = nextTypes[0]; types[1] = nextTypes[1];
    const digest = await stateDigest(view);
    if (!record.stateHash?.[uids[0]] || !record.stateHash?.[uids[1]]) return { ...view, phase: 'verify' };
    if (record.stateHash[uids[0]] !== digest || record.stateHash[uids[1]] !== digest) return invalid(view, '対戦状態が一致しません');
    if (outcome !== null) {
      if (!room.final?.[uids[0]] || !room.final?.[uids[1]]) return { ...view, phase: 'final' };
      for (let side = 0; side < 2; side++) {
        const final = room.final[uids[side]];
        if (!Array.isArray(final.entries) || final.entries.length !== 4 || await deckCommit(final.entries, final.salt) !== decks[side]!.commit ||
            final.entries.some((entry, index) => !cardById[entry.cardId] || cardById[entry.cardId].type !== decks[side]!.types[index] || (cardById[entry.cardId].rarity === 'SSR') !== decks[side]!.ssr[index] || !Number.isInteger(entry.trainLevel) || entry.trainLevel < 0 || entry.trainLevel > 99) ||
            ssrCount(final.entries.map((entry) => entry.cardId)) > 1) return invalid(view, 'デッキの公開情報が一致しません');
        for (let seen = 1; seen <= round; seen++) {
          const pick = room.rounds?.[String(seen)]?.reveal?.[uids[side]];
          if (pick && (final.entries[pick.index].cardId !== pick.card.cardId || final.entries[pick.index].trainLevel !== pick.card.trainLevel)) return invalid(view, '使用カードとデッキが一致しません');
        }
      }
      return { ...view, phase: 'finished' };
    }
  }
  return invalid(view, '対戦を解決できません');
}

export function myResult(view: OnlineView, side: 0 | 1): OnlineResult {
  return view.outcome === 'draw' ? 'draw' : view.outcome === side ? 'win' : 'loss';
}

const slotIndex = (card: BattleCard): number => Number(card.instanceId.split('-').at(-1));
const placeholder = (type: CardType): string => type === 'rock' ? 'G001' : type === 'scissors' ? 'C002' : 'P001';
const opposite = (side: PlayerIndex): PlayerIndex => side === 0 ? 1 : 0;
type Source = { side: PlayerIndex; index: number };

function publicBattle(room: OnlineRoom, uids: string[]): BattleState {
  const max: [number, number] = [Number(room.players?.[uids[0]]?.maxLife || 100), Number(room.players?.[uids[1]]?.maxLife || 100)];
  const config: BattleConfig = { initialLife: max[0], cpuMaxLife: max[1], cpuTraining: 0, damages: {}, heals: {} };
  const player = (side: PlayerIndex) => {
    const deck = room.decks![uids[side]];
    return {
      life: max[side], maxLife: max[side],
      hand: deck.types.map((type, index): BattleCard => ({
        instanceId: `${side}-${index}`, cardId: placeholder(type), originalType: type,
        currentType: type, trainLevel: 0, nullified: false, rarity: deck.ssr[index] ? 'SSR' : 'N',
      })),
      used: [] as BattleCard[], shields: [] as Shield[], poison: 0,
      delayed: [] as { dueRound: number; amount: number }[], nextDamage: 0,
      encrypted: false, blind: false, forcedCardId: null,
      startingCardIds: [] as string[],
    };
  };
  return { mode: 'local', config, seed: room.meta.seed, players: [player(0), player(1)], round: 1, phase: 'select', reveal: null, history: [], outcome: null };
}
function advancedSnapshot(state: BattleState, old: OnlineView, known: [Record<number, OnlineEntry>, Record<number, OnlineEntry>], knownTo: [number[], number[]]): OnlineView {
  const types: [CardType[], CardType[]] = [[...old.types[0]], [...old.types[1]]];
  const ssr: [boolean[], boolean[]] = [[...old.ssr[0]], [...old.ssr[1]]];
  const hidden: [boolean[], boolean[]] = [Array(4).fill(false), Array(4).fill(false)];
  const used: [number[], number[]] = [[], []];
  const required: [number | null, number | null] = [null, null];
  for (const side of [0, 1] as PlayerIndex[]) {
    for (const card of state.players[side].hand) {
      const index = slotIndex(card);
      types[side][index] = card.currentType;
      ssr[side][index] = card.rarity === 'SSR';
      hidden[side][index] = state.players[side].encrypted && !card.publicType;
    }
    used[side] = state.players[side].used.map(slotIndex);
    const force = requiredPick(state, side);
    required[side] = force ? Number(force.split('-').at(-1)) : null;
  }
  return {
    ...old, round: state.round, life: [state.players[0].life, state.players[1].life],
    types, ssr, hidden, used, required,
    blind: [state.players[0].blind, state.players[1].blind],
    known: [{ ...known[0] }, { ...known[1] }],
    knownTo: [[...knownTo[0]], [...knownTo[1]]],
    status: {
      shields: [state.players[0].shields, state.players[1].shields],
      poison: [state.players[0].poison, state.players[1].poison],
      delayed: [state.players[0].delayed, state.players[1].delayed],
      nextDamage: [state.players[0].nextDamage, state.players[1].nextDamage],
      nullified: [state.players[0].hand.filter((card) => card.nullified).map(slotIndex), state.players[1].hand.filter((card) => card.nullified).map(slotIndex)],
    },
    outcome: state.outcome,
  };
}
function decodeChoices(value: number | string, requests: ChoiceRequest[]): RoundChoice[] {
  if (typeof value === 'number') return [{ targetId: `${requests[0].kind === 'own' || requests[0].kind === 'swapOwn' || requests[0].kind === 'encrypt' ? requests[0].actor : opposite(requests[0].actor)}-${value}` }];
  const data = JSON.parse(value) as { index?: number; to?: CardType }[];
  if (!Array.isArray(data) || data.length !== requests.length) throw new Error('対象選択の数が正しくありません');
  return data.map((choice, index) => ({
    targetId: choice.index === undefined ? undefined : `${requests[index].kind === 'own' || requests[index].kind === 'swapOwn' || requests[index].kind === 'encrypt' ? requests[index].actor : opposite(requests[index].actor)}-${choice.index}`,
    to: choice.to,
  }));
}
function eventText(events: BattleState['history'][number]['events']): string[] {
  return events.map((event) => {
    if (event.kind === 'tie') return 'あいこ。';
    if (event.kind === 'damage') return `${event.amount}ダメージ`;
    if (event.kind === 'heal') return `${event.amount}回復`;
    if (event.kind === 'change') return '残りカードの種類を変更';
    if (event.kind === 'status') return event.text;
    return '対象がないため効果なし';
  });
}
async function deriveAdvancedView(room: OnlineRoom): Promise<OnlineView> {
  const uids = [room.meta.hostUid, room.meta.guestUid || ''];
  const players = uids.map((uid) => room.players?.[uid]);
  const maxLife: [number, number] = [Number(players[0]?.maxLife || 100), Number(players[1]?.maxLife || 100)];
  const decks = uids.map((uid) => room.decks?.[uid]);
  const types: [CardType[], CardType[]] = [decks[0]?.types ? [...decks[0].types] : [], decks[1]?.types ? [...decks[1].types] : []];
  const ssr: [boolean[], boolean[]] = [decks[0]?.ssr ? [...decks[0].ssr] : [], decks[1]?.ssr ? [...decks[1].ssr] : []];
  let view: OnlineView = { phase: 'deck', round: 1, life: [...maxLife], maxLife, types, ssr, used: [[], []], events: [], outcome: null };
  if (room.forfeit) {
    const winner = uids.indexOf(room.forfeit.winnerUid);
    const loser = uids.indexOf(room.forfeit.loserUid);
    return winner < 0 || loser < 0 || winner === loser ? invalid(view, '不戦勝の情報が正しくありません') : { ...view, phase: 'forfeit', outcome: winner as PlayerIndex };
  }
  if (!uids[1] || !decks[0] || !decks[1]) return view;
  if (types.some((list) => list.length !== 4 || list.some((type) => !['rock', 'scissors', 'paper'].includes(type)))) return invalid(view, 'カードの種類が正しくありません');
  if (ssr.some((list) => list.length !== 4 || list.filter(Boolean).length > 1)) return invalid(view, 'SSRはデッキに1枚までです');
  let state = publicBattle(room, uids);
  const known: [Record<number, OnlineEntry>, Record<number, OnlineEntry>] = [{}, {}];
  const knownTo: [number[], number[]] = [[], []];
  const origins: [Source[], Source[]] = [
    [0, 1, 2, 3].map((index) => ({ side: 0, index })),
    [0, 1, 2, 3].map((index) => ({ side: 1, index })),
  ];
  const observations: { side: PlayerIndex; source: Source; pick: RoundPick; round: number; hidden: boolean; expectedType: CardType }[] = [];
  const swaps: { side: PlayerIndex; source: Source; entry: OnlineEntry }[] = [];
  const encryptions: { side: PlayerIndex; round: number; commit: string; options: number[]; sources: Source[] }[] = [];
  for (let round = 1; round <= 4; round++) {
    view = advancedSnapshot(state, view, known, knownTo);
    view = { ...view, round, events: [], reveal: undefined, winner: undefined, targetOwner: undefined, targetRequests: undefined, swapTargets: undefined, intelTarget: undefined };
    const record = room.rounds?.[String(round)];
    if (!record?.commit?.[uids[0]] || !record.commit[uids[1]]) return { ...view, phase: 'select' };
    const picks = uids.map((uid) => record.reveal?.[uid]);
    if (!picks[0] || !picks[1]) return { ...view, phase: 'reveal' };
    const reveal = picks as [RoundPick, RoundPick];
    for (const side of [0, 1] as PlayerIndex[]) {
      const pick = reveal[side];
      const current = state.players[side].hand.find((card) => slotIndex(card) === pick.index);
      if (!current || !Number.isInteger(pick.index) || pick.index < 0 || pick.index > 3 ||
          !cardById[pick.card.cardId] || cardById[pick.card.cardId].type !== current.originalType ||
          (cardById[pick.card.cardId].rarity === 'SSR') !== (current.rarity === 'SSR') ||
          !Number.isInteger(pick.card.trainLevel) || pick.card.trainLevel < 0 || pick.card.trainLevel > 99 ||
          await pickCommit(room.meta.battleId, round, pick.index, pick.salt) !== record.commit[uids[side]] ||
          (known[side][pick.index] && (known[side][pick.index].cardId !== pick.card.cardId || known[side][pick.index].trainLevel !== pick.card.trainLevel)) ||
          (view.required?.[side] !== null && view.required?.[side] !== pick.index))
        return invalid(view, 'カードの公開情報が一致しません');
      const playedType = pick.currentType ?? current.currentType;
      if (!['rock', 'scissors', 'paper'].includes(playedType) ||
          (!view.hidden?.[side][pick.index] && playedType !== current.currentType))
        return invalid(view, 'カードの種類が一致しません');
      state.players[side].hand = state.players[side].hand.map((card) => card.instanceId === current.instanceId
        ? { ...card, cardId: pick.card.cardId, trainLevel: pick.card.trainLevel, currentType: playedType, rarity: getCard(pick.card.cardId).rarity } : card);
      if (pick.card.cardId === 'C016') state.players[side].startingCardIds = pick.combo ? ['C003'] : [];
      observations.push({ side, source: { ...origins[side][pick.index] }, pick, round, hidden: Boolean(view.hidden?.[side][pick.index]), expectedType: current.currentType });
    }
    try { state = beginRound(state, [`0-${reveal[0].index}`, `1-${reveal[1].index}`]); }
    catch { return invalid(view, '出すカードの指定が正しくありません'); }
    view.reveal = reveal; view.winner = state.reveal!.winner;
    view.revealDamage = [shownDamage(state, 0, state.reveal!.cards[0]), shownDamage(state, 1, state.reveal!.cards[1])];
    const active = effectOrder(state.reveal!.winner, state.reveal!.cards, state.players.map((player) => player.life), state.seed, round);
    if (view.winner === null) view.events.push(active.length === 2 ? 'SSR同時発動！' : active.length === 1 ? 'SSR発動！' : 'あいこ。効果は発動しません。');
    const requests = choiceRequests(state);
    const choices: RoundChoice[] = [];
    for (const actor of active) {
      const actorRequests = requests.filter((request) => request.actor === actor);
      if (!actorRequests.length) continue;
      const encoded = record.choices?.[uids[actor]];
      if (encoded === undefined) return { ...view, used: [state.players[0].used.map(slotIndex), state.players[1].used.map(slotIndex)], phase: 'target', targetOwner: actor, targetRequests: actorRequests.map((request) => ({ actor, kind: request.kind, options: request.options.map(slotIndex), optional: request.optional, effectType: request.effect.type })) };
      try { choices.push(...decodeChoices(encoded, actorRequests)); }
      catch { return invalid(view, '対象の選択が正しくありません'); }
      const encryption = actorRequests.find((request) => request.kind === 'encrypt');
      if (encryption) {
        try {
          const posted = JSON.parse(String(encoded)) as { commit?: string }[];
          if (!Array.isArray(posted) || !/^[a-f0-9]{64}$/.test(posted[actorRequests.indexOf(encryption)]?.commit ?? '')) throw new Error('bad commit');
          encryptions.push({ side: actor, round, commit: posted[actorRequests.indexOf(encryption)].commit!, options: encryption.options.map(slotIndex), sources: origins[actor].map((source) => ({ ...source })) });
        } catch { return invalid(view, '暗号化の選択が正しくありません'); }
      }
    }
    const swapActor = active.find((actor) => getCard(reveal[actor].card.cardId).effects.some((effect) => effect.type === 'swapCards'));
    let swapIndices: [number, number] | undefined;
    if (swapActor !== undefined && state.players[swapActor].hand.length && state.players[opposite(swapActor)].hand.length) {
      const own = requests.findIndex((request) => request.actor === swapActor && request.kind === 'swapOwn');
      const enemy = requests.findIndex((request) => request.actor === swapActor && request.kind === 'swapOpponent');
      if (own >= 0 && enemy >= 0) {
        swapIndices = [Number(choices[own].targetId?.split('-').at(-1)), Number(choices[enemy].targetId?.split('-').at(-1))];
        const targets: [number, number] = swapActor === 0 ? swapIndices : [swapIndices[1], swapIndices[0]];
        if (!record.swapReveal?.[uids[0]] || !record.swapReveal?.[uids[1]]) return { ...view, phase: 'swapReveal', swapTargets: targets };
        for (const side of [0, 1] as PlayerIndex[]) {
          const entry = record.swapReveal[uids[side]];
          const card = state.players[side].hand.find((item) => slotIndex(item) === targets[side]);
          if (!card || !cardById[entry.cardId] || getCard(entry.cardId).type !== card.originalType ||
              (getCard(entry.cardId).rarity === 'SSR') !== (card.rarity === 'SSR') ||
              !Number.isInteger(entry.trainLevel) || entry.trainLevel < 0 || entry.trainLevel > 99)
            return invalid(view, '交換するカードの公開情報が一致しません');
          swaps.push({ side, source: { ...origins[side][targets[side]] }, entry });
        }
      }
    }
    const intelActor = active.find((actor) => getCard(reveal[actor].card.cardId).effects.some((effect) => effect.type === 'revealOpponent'));
    let intelIndex: number | undefined;
    if (intelActor !== undefined) {
      const target = requests.findIndex((request) => request.actor === intelActor && request.effect.type === 'revealOpponent');
      if (target >= 0) {
        intelIndex = Number(choices[target].targetId?.split('-').at(-1));
        if (!record.intelReveal?.[uids[opposite(intelActor)]]) return { ...view, phase: 'intelReveal', targetOwner: opposite(intelActor), intelTarget: intelIndex };
        const entry = record.intelReveal[uids[opposite(intelActor)]];
        const card = state.players[opposite(intelActor)].hand.find((item) => slotIndex(item) === intelIndex);
        if (!card || !cardById[entry.cardId] || getCard(entry.cardId).type !== card.originalType ||
            (getCard(entry.cardId).rarity === 'SSR') !== (card.rarity === 'SSR')) return invalid(view, '公開するカードが正しくありません');
      }
    }
    try { state = finishRound(state, choices); }
    catch { return invalid(view, 'カード効果の対象が正しくありません'); }
    if (swapActor !== undefined && swapIndices && record.swapReveal) {
      const enemy = opposite(swapActor);
      const ownIndex = swapIndices[0], enemyIndex = swapIndices[1];
      const ownEntry = record.swapReveal[uids[swapActor]], enemyEntry = record.swapReveal[uids[enemy]];
      known[swapActor][ownIndex] = enemyEntry;
      known[enemy][enemyIndex] = ownEntry;
      knownTo[swapActor] = [...new Set([...knownTo[swapActor], enemyIndex])];
      knownTo[enemy] = [...new Set([...knownTo[enemy], ownIndex])];
      [origins[swapActor][ownIndex], origins[enemy][enemyIndex]] = [origins[enemy][enemyIndex], origins[swapActor][ownIndex]];
      for (const side of [0, 1] as PlayerIndex[]) state.players[side].hand = state.players[side].hand.map((card) =>
        known[side][slotIndex(card)] ? { ...card, cardId: known[side][slotIndex(card)].cardId, trainLevel: known[side][slotIndex(card)].trainLevel } : card);
    }
    if (intelActor !== undefined && intelIndex !== undefined && record.intelReveal) {
      known[opposite(intelActor)][intelIndex] = record.intelReveal[uids[opposite(intelActor)]];
      knownTo[intelActor] = [...new Set([...knownTo[intelActor], intelIndex])];
    }
    const log = state.history.at(-1)!;
    view = advancedSnapshot(state, view, known, knownTo);
    view = { ...view, round, reveal, winner: log.winner, events: [...view.events, ...eventText(log.events)] };
    const digest = await stateDigest(view);
    if (!record.stateHash?.[uids[0]] || !record.stateHash?.[uids[1]]) return { ...view, phase: 'verify' };
    if (record.stateHash[uids[0]] !== digest || record.stateHash[uids[1]] !== digest) return invalid(view, '対戦状態が一致しません');
    if (state.outcome !== null) {
      if (!room.final?.[uids[0]] || !room.final?.[uids[1]]) return { ...view, phase: 'final' };
      for (const side of [0, 1] as PlayerIndex[]) {
        const final = room.final[uids[side]];
        if (!Array.isArray(final.entries) || final.entries.length !== 4 || await deckCommit(final.entries, final.salt) !== decks[side]!.commit ||
            final.entries.some((entry, index) => !cardById[entry.cardId] || getCard(entry.cardId).type !== decks[side]!.types[index] ||
              (getCard(entry.cardId).rarity === 'SSR') !== decks[side]!.ssr[index] || !Number.isInteger(entry.trainLevel) || entry.trainLevel < 0 || entry.trainLevel > 99) ||
            ssrCount(final.entries.map((entry) => entry.cardId)) > 1) return invalid(view, 'デッキの公開情報が一致しません');
      }
      for (const observation of observations) {
        const original = room.final[uids[observation.source.side]].entries[observation.source.index];
        if (original.cardId !== observation.pick.card.cardId || original.trainLevel !== observation.pick.card.trainLevel)
          return invalid(view, '使用カードとデッキが一致しません');
        if (observation.pick.card.cardId === 'C016' && Boolean(observation.pick.combo) !== room.final[uids[observation.side]].entries.some((entry) => entry.cardId === 'C003'))
          return invalid(view, 'くぎの組み合わせ情報が一致しません');
      }
      const secretTypes = new Map<string, CardType>();
      for (const encryption of encryptions) {
        const proof = room.final[uids[encryption.side]].encryptProofs?.find((item) => item.round === encryption.round);
        if (!proof || !/^[a-f0-9]{32}$/.test(proof.salt) ||
            proof.index !== -1 && !encryption.options.includes(proof.index) ||
            !['rock', 'scissors', 'paper'].includes(proof.to) ||
            await sha256(`${room.meta.battleId}:${encryption.round}:${proof.index}:${proof.to}:${proof.salt}`) !== encryption.commit)
          return invalid(view, '暗号化の選択が一致しません');
        if (proof.index >= 0) {
          const source = encryption.sources[proof.index];
          secretTypes.set(`${source.side}:${source.index}`, proof.to);
        }
      }
      for (const observation of observations.filter((item) => item.hidden)) {
        const changed = secretTypes.get(`${observation.source.side}:${observation.source.index}`);
        if ((observation.pick.currentType ?? observation.expectedType) !== (changed ?? observation.expectedType))
          return invalid(view, '暗号化された種類が一致しません');
      }
      for (const swap of swaps) {
        const original = room.final[uids[swap.source.side]].entries[swap.source.index];
        if (original.cardId !== swap.entry.cardId || original.trainLevel !== swap.entry.trainLevel)
          return invalid(view, '交換カードとデッキが一致しません');
      }
      return { ...view, phase: 'finished' };
    }
  }
  return invalid(view, '対戦を解決できません');
}

export async function deriveView(room: OnlineRoom): Promise<OnlineView> {
  return room.meta.protocolVersion === 2 ? deriveAdvancedView(room) : deriveLegacyView(room);
}
