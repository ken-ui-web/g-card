import { describe, expect, it } from 'vitest';
import { availableCards, getCard } from '../data/cards';
import { deckCommit, deriveView, pickCommit, sha256, stateDigest, type OnlineEntry, type OnlineRoom, type RoundPick } from './protocol';

async function room(left: string[], right: string[], maxLife = 100): Promise<OnlineRoom> {
  const entries = (ids: string[]): OnlineEntry[] => ids.map((cardId) => ({ cardId, trainLevel: 0 }));
  const a = entries(left), b = entries(right);
  return {
    meta: { battleId: 'advanced', protocolVersion: 2, deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 7, createdAt: 1, expiresAt: 100000 },
    players: { host: { nickname: 'A', maxLife, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife, connected: true, lastSeen: 1 } },
    decks: {
      host: { types: a.map((item) => getCard(item.cardId).type), ssr: a.map((item) => getCard(item.cardId).rarity === 'SSR'), commit: await deckCommit(a, 'saltA') },
      guest: { types: b.map((item) => getCard(item.cardId).type), ssr: b.map((item) => getCard(item.cardId).rarity === 'SSR'), commit: await deckCommit(b, 'saltB') },
    },
    rounds: {},
  };
}
async function revealRound(battle: OnlineRoom, round: number, a: RoundPick, b: RoundPick): Promise<void> {
  battle.rounds![String(round)] = {
    commit: { host: await pickCommit(battle.meta.battleId, round, a.index, a.salt), guest: await pickCommit(battle.meta.battleId, round, b.index, b.salt) },
    reveal: { host: a, guest: b },
  };
}
const pick = (index: number, cardId: string, salt: string, extra: Partial<RoundPick> = {}): RoundPick => ({ index, salt, card: { cardId, trainLevel: 0 }, ...extra });
async function verify(battle: OnlineRoom, round: number): Promise<void> {
  const view = await deriveView(battle);
  expect(view.phase).toBe('verify');
  const digest = await stateDigest(view);
  battle.rounds![String(round)].stateHash = { host: digest, guest: digest };
}

describe('オンライン対戦の40枚ルール', () => {
  it('新しい通信手順でも基本カード4ラウンドを最後まで照合する', async () => {
    const left = ['G001', 'G002', 'C008', 'P003'];
    const right = ['C008', 'G001', 'P003', 'G002'];
    const battle = await room(left, right);
    for (let number = 1; number <= 4; number++) {
      const index = number - 1;
      await revealRound(battle, number, pick(index, left[index], `a${number}`), pick(index, right[index], `b${number}`));
      await verify(battle, number);
    }
    expect((await deriveView(battle)).phase).toBe('final');
    battle.final = {
      host: { entries: left.map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltA' },
      guest: { entries: right.map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltB' },
    };
    expect((await deriveView(battle)).phase).toBe('finished');
  });
  it('40枚すべての勝利時効果が対象選択と公開を経て解決できる', async () => {
    for (const definition of availableCards) {
      const loser = definition.type === 'rock' ? 'C002' : definition.type === 'scissors' ? 'P003' : 'G001';
      const fillers = ['G001', 'G002', 'C002', 'C008', 'P001', 'P003', 'P005'];
      const left = [definition.cardId, ...fillers.filter((id) => id !== definition.cardId).slice(0, 3)];
      const right = [loser, ...fillers.filter((id) => id !== loser).slice(0, 3)];
      const battle = await room(left, right, 200);
      await revealRound(battle, 1, pick(0, definition.cardId, 'a'), pick(0, loser, 'b'));
      let view = await deriveView(battle);
      if (view.phase === 'target') {
        const requests = view.targetRequests!;
        const selected = requests.map((request) => request.kind === 'encrypt'
          ? { commit: 'a'.repeat(64) }
          : { index: request.options[0], ...(request.kind === 'own' ? { to: 'rock' } : {}) });
        battle.rounds!['1'].choices = { host: JSON.stringify(selected) };
        view = await deriveView(battle);
      }
      if (view.phase === 'swapReveal') {
        battle.rounds!['1'].swapReveal = {
          host: { cardId: left[view.swapTargets![0]], trainLevel: 0 },
          guest: { cardId: right[view.swapTargets![1]], trainLevel: 0 },
        };
        view = await deriveView(battle);
      }
      if (view.phase === 'intelReveal') {
        battle.rounds!['1'].intelReveal = { guest: { cardId: right[view.intelTarget!], trainLevel: 0 } };
        view = await deriveView(battle);
      }
      expect(view.phase, definition.cardId).toBe('verify');
    }
  });
  it('シールドと複数ヒットを両端末で同じ状態へ再計算する', async () => {
    const battle = await room(['G001', 'G007', 'C008', 'P001'], ['P005', 'C008', 'G001', 'P001']);
    await revealRound(battle, 1, pick(0, 'G001', 'a'), pick(0, 'P005', 'b'));
    await verify(battle, 1);
    expect((await deriveView(battle)).status?.shields[0]).toHaveLength(0);
    await revealRound(battle, 2, pick(1, 'G007', 'c'), pick(1, 'C008', 'd'));
    const result = await deriveView(battle);
    expect(result.phase).toBe('verify');
    expect(result.life).toEqual([100, 75]);
    expect(result.status?.shields[1]).toHaveLength(0);
  });
  it('プログラミングの指定と入れ替え後のカード情報を同期する', async () => {
    const force = await room(['P014', 'G001', 'C008', 'P003'], ['G001', 'C008', 'P003', 'P001']);
    await revealRound(force, 1, pick(0, 'P014', 'a'), pick(0, 'G001', 'b'));
    expect((await deriveView(force)).targetRequests?.[0].effectType).toBe('forceOpponentNext');
    force.rounds!['1'].choices = { host: 1 };
    await verify(force, 1);
    expect((await deriveView(force)).required?.[1]).toBe(1);
    await revealRound(force, 2, pick(1, 'G001', 'c'), pick(2, 'P003', 'd'));
    expect((await deriveView(force)).phase).toBe('invalid');

    const swap = await room(['P009', 'G001', 'C008', 'P003'], ['G001', 'C008', 'P003', 'G002']);
    await revealRound(swap, 1, pick(0, 'P009', 'a'), pick(0, 'G001', 'b'));
    expect((await deriveView(swap)).phase).toBe('target');
    swap.rounds!['1'].choices = { host: JSON.stringify([{ index: 1 }, { index: 2 }]) };
    expect((await deriveView(swap)).swapTargets).toEqual([1, 2]);
    swap.rounds!['1'].swapReveal = { host: { cardId: 'G001', trainLevel: 0 }, guest: { cardId: 'P003', trainLevel: 0 } };
    await verify(swap, 1);
    const next = await deriveView(swap);
    expect(next.known?.[0][1].cardId).toBe('P003');
    expect(next.known?.[1][2].cardId).toBe('G001');
    expect(next.types[0][1]).toBe('paper');
    await revealRound(swap, 2, pick(1, 'P003', 'c'), pick(1, 'C008', 'd'));
    await verify(swap, 2);
    await revealRound(swap, 3, pick(2, 'C008', 'e'), pick(2, 'G001', 'f'));
    await verify(swap, 3);
    await revealRound(swap, 4, pick(3, 'P003', 'g'), pick(3, 'G002', 'h'));
    await verify(swap, 4);
    swap.final = {
      host: { entries: ['P009', 'G001', 'C008', 'P003'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltA' },
      guest: { entries: ['G001', 'C008', 'P003', 'G002'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltB' },
    };
    expect((await deriveView(swap)).phase).toBe('finished');
  });
  it('暗号化の秘密変更は公開時の種類と最終証明で確認する', async () => {
    const battle = await room(['P018', 'G001', 'C008', 'P003'], ['G001', 'C008', 'P003', 'G002'], 30);
    await revealRound(battle, 1, pick(0, 'P018', 'a'), pick(0, 'G001', 'b'));
    const salt = 'a'.repeat(32);
    const commit = await sha256(`${battle.meta.battleId}:1:1:scissors:${salt}`);
    battle.rounds!['1'].choices = { host: JSON.stringify([{ commit }]) };
    await verify(battle, 1);
    expect((await deriveView(battle)).hidden?.[0][1]).toBe(true);
    await revealRound(battle, 2, pick(1, 'G001', 'c', { currentType: 'scissors' }), pick(1, 'C008', 'd'));
    const next = await deriveView(battle);
    expect(next.phase).toBe('verify');
    expect(next.winner).toBeNull();
    await verify(battle, 2);
    await revealRound(battle, 3, pick(2, 'C008', 'e'), pick(2, 'P003', 'f'));
    await verify(battle, 3);
    battle.final = {
      host: { entries: ['P018', 'G001', 'C008', 'P003'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltA', encryptProofs: [{ round: 1, index: 1, to: 'scissors', salt }] },
      guest: { entries: ['G001', 'C008', 'P003', 'G002'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltB' },
    };
    expect((await deriveView(battle)).phase).toBe('finished');
    battle.final.host.encryptProofs![0].to = 'paper';
    expect((await deriveView(battle)).phase).toBe('invalid');
  });
  it('くぎのコンボ申告と初期デッキを照合する', async () => {
    const battle = await room(['C003', 'C016', 'P001', 'G001'], ['P003', 'G001', 'G002', 'C008'], 30);
    await revealRound(battle, 1, pick(1, 'C016', 'a', { combo: true }), pick(0, 'P003', 'b'));
    const view = await deriveView(battle);
    expect(view.phase).toBe('verify');
    expect(view.life).toEqual([30, 0]);
    await verify(battle, 1);
    expect((await deriveView(battle)).phase).toBe('final');
    battle.final = {
      host: { entries: ['C003', 'C016', 'P001', 'G001'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltA' },
      guest: { entries: ['P003', 'G001', 'G002', 'C008'].map((cardId) => ({ cardId, trainLevel: 0 })), salt: 'saltB' },
    };
    expect((await deriveView(battle)).phase).toBe('finished');
    battle.rounds!['1'].reveal!.host.combo = false;
    expect((await deriveView(battle)).phase).toBe('invalid');
  });
});
