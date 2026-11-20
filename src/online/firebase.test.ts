import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCodeRoom, joinCodeRoom } from './firebase';
import type { Database } from 'firebase/database';

const mock = vi.hoisted(() => ({
  get: vi.fn(), set: vi.fn(), update: vi.fn(), transaction: vi.fn(),
  disconnect: vi.fn(() => ({ update: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => path,
  get: mock.get, set: mock.set, update: mock.update, runTransaction: mock.transaction,
  onDisconnect: mock.disconnect, remove: vi.fn(), goOffline: vi.fn(), goOnline: vi.fn(),
  onValue: (_ref: unknown, callback: (snapshot: { val: () => number }) => void) => callback({ val: () => -1500 }),
  serverTimestamp: () => 123, getDatabase: vi.fn(),
}));
const db = {} as Database;
afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
  mock.transaction.mockImplementation(async (_ref, change) => ({ committed: true, snapshot: { val: () => change(null) } }));
  mock.set.mockResolvedValue(undefined);
  mock.update.mockResolvedValue(undefined);
});

describe('ゲストの部屋コード対戦', () => {
  it('自分のライフを持つゲスト用の部屋とコードを作成する', async () => {
    const room = await createCodeRoom(db, 'host', 'テスト', 135, 'owned', false, true);
    expect(mock.set).toHaveBeenCalledWith('rooms/' + room.roomId, expect.objectContaining({
      meta: expect.objectContaining({ guestBattle: true, deckMode: 'owned' }),
      players: { host: expect.objectContaining({ maxLife: 135, nickname: 'テスト' }) },
    }));
    const reservation = mock.transaction.mock.calls[0][1](null);
    expect(reservation.guestBattle).toBe(true);
    expect(reservation.deckMode).toBe('owned');
    expect(reservation.expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 60_000 - 6500);
  });

  it('ゲストはゲスト部屋に参加でき、学校用のコードでは席を確保しない', async () => {
    const mapping = { roomId: 'test', deckMode: 'owned', expiresAt: Date.now() + 100000, guestBattle: true };
    mock.get.mockResolvedValue({ val: () => mapping });
    await expect(joinCodeRoom(db, 'joiner', '1234', 'owned', true)).resolves.toBe('test');
    mock.transaction.mockClear();
    await expect(joinCodeRoom(db, 'student', '1234', 'owned')).rejects.toThrow('ゲスト用');
    expect(mock.transaction).not.toHaveBeenCalled();
    mock.get.mockResolvedValue({ val: () => ({ ...mapping, guestBattle: undefined }) });
    await expect(joinCodeRoom(db, 'joiner', '1234', 'owned', true)).rejects.toThrow('学校アカウント用');
    expect(mock.transaction).not.toHaveBeenCalled();
    await expect(joinCodeRoom(db, 'student', '1234', 'owned')).resolves.toBe('test');
  });
});
