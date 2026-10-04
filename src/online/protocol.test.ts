import { describe, expect, it } from 'vitest';
import { getCard } from '../data/cards';
import { deckCommit, deriveView, myResult, pickCommit, stateDigest, type OnlineEntry, type OnlineRoom } from './protocol';

describe('オンライン対戦の公開情報', () => {
  it('4ラウンドを両端末で再計算し、デッキ公開後に結果を確定する', async () => {
    const a: OnlineEntry[] = ['G001', 'G002', 'C008', 'P003'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const b: OnlineEntry[] = ['C008', 'G001', 'P003', 'G002'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const room: OnlineRoom = {
      meta: { battleId: 'test-battle', deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 1, createdAt: 1, expiresAt: 100000 },
      players: { host: { nickname: 'A', maxLife: 100, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife: 100, connected: true, lastSeen: 1 } },
      decks: { host: { types: a.map((entry) => getCard(entry.cardId).type), ssr: a.map((entry) => getCard(entry.cardId).rarity === 'SSR'), commit: await deckCommit(a, 'saltA') }, guest: { types: b.map((entry) => getCard(entry.cardId).type), ssr: b.map((entry) => getCard(entry.cardId).rarity === 'SSR'), commit: await deckCommit(b, 'saltB') } },
      rounds: {},
    };
    expect((await deriveView(room)).phase).toBe('select');
    for (let round = 1; round <= 4; round++) {
      const index = round - 1;
      const hostSalt = `host${round}`;
      const guestSalt = `guest${round}`;
      room.rounds![String(round)] = {
        commit: { host: await pickCommit(room.meta.battleId, round, index, hostSalt), guest: await pickCommit(room.meta.battleId, round, index, guestSalt) },
        reveal: { host: { index, salt: hostSalt, card: a[index] }, guest: { index, salt: guestSalt, card: b[index] } },
      };
      const pending = await deriveView(room);
      expect(pending.phase).toBe('verify');
      const digest = await stateDigest(pending);
      room.rounds![String(round)].stateHash = { host: digest, guest: digest };
    }
    const beforeFinal = await deriveView(room);
    expect(beforeFinal.phase).toBe('final');
    room.final = { host: { entries: a, salt: 'saltA' }, guest: { entries: b, salt: 'saltB' } };
    const completed = await deriveView(room);
    expect(completed.phase).toBe('finished');
    expect(completed.life).toEqual([100, 30]);
    expect(myResult(completed, 0)).toBe('win');
    expect(myResult(completed, 1)).toBe('loss');
    room.final.guest.entries[0] = { cardId: 'G001', trainLevel: 0 };
    expect((await deriveView(room)).phase).toBe('invalid');
  });

  it('カード決定後の公開を改ざんすると無効試合にする', async () => {
    const room: OnlineRoom = {
      meta: { battleId: 'tamper', deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 1, createdAt: 1, expiresAt: 2 },
      players: { host: { nickname: 'A', maxLife: 100, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife: 100, connected: true, lastSeen: 1 } },
      decks: { host: { types: ['rock', 'rock', 'scissors', 'paper'], ssr: [false, false, false, false], commit: 'a'.repeat(64) }, guest: { types: ['scissors', 'rock', 'paper', 'rock'], ssr: [false, false, false, false], commit: 'b'.repeat(64) } },
      rounds: { '1': { commit: { host: await pickCommit('tamper', 1, 0, 'secret'), guest: await pickCommit('tamper', 1, 0, 'other') }, reveal: { host: { index: 1, salt: 'secret', card: { cardId: 'G002', trainLevel: 0 } }, guest: { index: 0, salt: 'other', card: { cardId: 'C008', trainLevel: 0 } } } } },
    };
    expect((await deriveView(room)).phase).toBe('invalid');
  });

  it('手品の対象選択では今出した相手カードを候補から外す', async () => {
    const host: OnlineEntry[] = ['P001', 'G001', 'C008', 'P003'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const guest: OnlineEntry[] = ['G001', 'C008', 'P003', 'G002'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const room: OnlineRoom = {
      meta: { battleId: 'magic-target', deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 1, createdAt: 1, expiresAt: 2 },
      players: { host: { nickname: 'A', maxLife: 100, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife: 100, connected: true, lastSeen: 1 } },
      decks: { host: { types: host.map((entry) => getCard(entry.cardId).type), ssr: host.map((entry) => getCard(entry.cardId).rarity === 'SSR'), commit: await deckCommit(host, 'a') }, guest: { types: guest.map((entry) => getCard(entry.cardId).type), ssr: guest.map((entry) => getCard(entry.cardId).rarity === 'SSR'), commit: await deckCommit(guest, 'b') } },
      rounds: { '1': {
        commit: { host: await pickCommit('magic-target', 1, 0, 'h'), guest: await pickCommit('magic-target', 1, 0, 'g') },
        reveal: { host: { index: 0, salt: 'h', card: host[0] }, guest: { index: 0, salt: 'g', card: guest[0] } },
      } },
    };
    const targeting = await deriveView(room);
    expect(targeting.phase).toBe('target');
    expect(targeting.targetOwner).toBe(0);
    expect(targeting.used[1]).toContain(0);
    room.rounds!['1'].choices = { host: 1 };
    expect((await deriveView(room)).phase).toBe('verify');
  });

  it('公開されたSSRはあいこで発動し、偽装や2枚の申告は無効にする', async () => {
    const host: OnlineEntry[] = ['C014', 'G001', 'P001', 'P003'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const guest: OnlineEntry[] = ['C002', 'G002', 'P002', 'P017'].map((cardId) => ({ cardId, trainLevel: 0 }));
    const room: OnlineRoom = {
      meta: { battleId: 'ssr-tie', deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 4, createdAt: 1, expiresAt: 2 },
      players: { host: { nickname: 'A', maxLife: 100, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife: 100, connected: true, lastSeen: 1 } },
      decks: { host: { types: host.map((entry) => getCard(entry.cardId).type), ssr: [true, false, false, false], commit: await deckCommit(host, 'h') }, guest: { types: guest.map((entry) => getCard(entry.cardId).type), ssr: [false, false, false, false], commit: await deckCommit(guest, 'g') } },
      rounds: { '1': { commit: { host: await pickCommit('ssr-tie', 1, 0, 'a'), guest: await pickCommit('ssr-tie', 1, 0, 'b') }, reveal: { host: { index: 0, salt: 'a', card: host[0] }, guest: { index: 0, salt: 'b', card: guest[0] } } } },
    };
    const tied = await deriveView(room);
    expect(tied.phase).toBe('verify');
    expect(tied.life).toEqual([100, 40]);
    expect(tied.events).toContain('SSR発動！');
    room.decks!.host.ssr[0] = false;
    expect((await deriveView(room)).phase).toBe('invalid');
    room.decks!.host.ssr = [true, true, false, false];
    expect((await deriveView(room)).phase).toBe('invalid');
  });

  it('30秒後の不戦勝は切断者が戻っても終了したままになる', async () => {
    const room: OnlineRoom = {
      meta: { battleId: 'forfeit', deckMode: 'sample', hostUid: 'host', guestUid: 'guest', seed: 1, code: '1234', createdAt: 1, expiresAt: 2 },
      players: { host: { nickname: 'A', maxLife: 100, connected: true, lastSeen: 1 }, guest: { nickname: 'B', maxLife: 100, connected: false, lastSeen: 10 } },
      forfeit: { winnerUid: 'host', loserUid: 'guest', at: 30_010 },
    };
    const result = await deriveView(room);
    expect(result.phase).toBe('forfeit');
    expect(myResult(result, 0)).toBe('win');
    expect(myResult(result, 1)).toBe('loss');
    room.players!.guest.connected = true;
    expect((await deriveView(room)).phase).toBe('forfeit');
  });
});
