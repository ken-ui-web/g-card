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
      decks: { host: { types: a.map((entry) => getCard(entry.cardId).type), commit: await deckCommit(a, 'saltA') }, guest: { types: b.map((entry) => getCard(entry.cardId).type), commit: await deckCommit(b, 'saltB') } },
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
      decks: { host: { types: ['rock', 'rock', 'scissors', 'paper'], commit: 'a'.repeat(64) }, guest: { types: ['scissors', 'rock', 'paper', 'rock'], commit: 'b'.repeat(64) } },
      rounds: { '1': { commit: { host: await pickCommit('tamper', 1, 0, 'secret'), guest: await pickCommit('tamper', 1, 0, 'other') }, reveal: { host: { index: 1, salt: 'secret', card: { cardId: 'G002', trainLevel: 0 } }, guest: { index: 0, salt: 'other', card: { cardId: 'C008', trainLevel: 0 } } } } },
    };
    expect((await deriveView(room)).phase).toBe('invalid');
  });
});
