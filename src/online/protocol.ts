import { compareTypes } from '../game/battle';
import { cardById, getCard, type CardType } from '../data/cards';

export type DeckMode = 'sample' | 'owned';
export type OnlineResult = 'win' | 'draw' | 'loss';
export interface OnlineEntry { cardId: string; ownedId?: string; trainLevel: number }
export interface PublicDeck { types: CardType[]; commit: string }
export interface RoundPick { index: number; salt: string; card: { cardId: string; trainLevel: number } }
export interface OnlineRound {
  commit?: Record<string, string>;
  reveal?: Record<string, RoundPick>;
  choices?: Record<string, number>;
  stateHash?: Record<string, string>;
}
export interface OnlineRoom {
  meta: { battleId: string; deckMode: DeckMode; hostUid: string; guestUid?: string; seed: number; code?: string; createdAt: number; expiresAt: number };
  players?: Record<string, { nickname: string; maxLife: number; connected: boolean; lastSeen: number }>;
  decks?: Record<string, PublicDeck>;
  rounds?: Record<string, OnlineRound>;
  final?: Record<string, { entries: OnlineEntry[]; salt: string }>;
  receipts?: Record<string, boolean>;
}
export interface OnlineView {
  phase: 'deck' | 'select' | 'reveal' | 'target' | 'verify' | 'final' | 'finished' | 'invalid';
  round: number;
  life: [number, number];
  maxLife: [number, number];
  types: [CardType[], CardType[]];
  used: [number[], number[]];
  reveal?: [RoundPick, RoundPick];
  winner?: 0 | 1 | null;
  targetOwner?: 0 | 1;
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
  return JSON.stringify({ round: view.round, life: view.life, types: view.types, used: view.used, outcome: view.outcome });
}
export const stateDigest = (view: OnlineView) => sha256(stateKey(view));

// 両端末が同じ公開情報から状態を再計算する。相手の未公開カード名は使用しない。
export async function deriveView(room: OnlineRoom): Promise<OnlineView> {
  const uids = [room.meta.hostUid, room.meta.guestUid || ''];
  const players = uids.map((uid) => room.players?.[uid]);
  const maxLife: [number, number] = [Number(players[0]?.maxLife || 100), Number(players[1]?.maxLife || 100)];
  const decks = uids.map((uid) => room.decks?.[uid]);
  const types: [CardType[], CardType[]] = [decks[0]?.types ? [...decks[0].types] : [], decks[1]?.types ? [...decks[1].types] : []];
  let view: OnlineView = { phase: 'deck', round: 1, life: [...maxLife], maxLife, types, used: [[], []], events: [], outcome: null };
  if (!uids[1] || !decks[0] || !decks[1]) return view;
  if (types.some((list) => list.length !== 4 || list.some((type) => !['rock', 'scissors', 'paper'].includes(type)))) return invalid(view, 'カードの種類が正しくありません');
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
          !Number.isInteger(pick.card.trainLevel) || pick.card.trainLevel < 0 || pick.card.trainLevel > 99 ||
          await pickCommit(room.meta.battleId, round, pick.index, pick.salt) !== record.commit[uids[side]]) return invalid(view, 'カードの公開情報が一致しません');
    }
    const comparison = compareTypes(types[0][reveal[0].index], types[1][reveal[1].index]);
    const winner = comparison === 0 ? null : comparison > 0 ? 0 : 1;
    view.reveal = reveal; view.winner = winner;
    const used: [number[], number[]] = [[...view.used[0], reveal[0].index], [...view.used[1], reveal[1].index]];
    const life: [number, number] = [...view.life];
    const nextTypes: [CardType[], CardType[]] = [[...types[0]], [...types[1]]];
    if (winner === null) view.events.push('あいこ。効果は発動しません。');
    else {
      const loser = winner === 0 ? 1 : 0;
      for (const effect of getCard(reveal[winner].card.cardId).effects) {
        if (effect.type === 'damage') {
          const definition = getCard(reveal[winner].card.cardId);
          const amount = effect.amount + (definition.type === 'rock' ? reveal[winner].card.trainLevel * definition.trainingMultiplier : 0);
          life[loser] = Math.max(0, life[loser] - amount);
          view.events.push(`${amount}ダメージ`);
        } else if (effect.type === 'heal') {
          const amount = Math.min(effect.amount, maxLife[winner] - life[winner]);
          life[winner] += amount;
          view.events.push(`${amount}回復`);
        } else if (effect.type === 'changeOpponentType') {
          const candidates = [0, 1, 2, 3].filter((index) => !used[loser].includes(index));
          if (candidates.length) {
            const target = record.choices?.[uids[winner]];
            if (target === undefined) return { ...view, phase: 'target', targetOwner: winner };
            if (!candidates.includes(target)) return invalid(view, '手品の対象が正しくありません');
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
            final.entries.some((entry, index) => !cardById[entry.cardId] || cardById[entry.cardId].type !== decks[side]!.types[index] || !Number.isInteger(entry.trainLevel) || entry.trainLevel < 0 || entry.trainLevel > 99)) return invalid(view, 'デッキの公開情報が一致しません');
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
