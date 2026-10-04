import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guestAction } from './guest';
import { callApi, guestSession, type BootstrapData, type EconomyState } from './api';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('ゲストの端末内保存', () => {
  it('ニックネーム、購入、筋トレ、売却、デッキを再読込後も保持する', () => {
    const first = guestAction('bootstrap', {}, crypto.randomUUID()) as BootstrapData;
    expect(first.needsNickname).toBe(true);
    guestAction('setNickname', { nickname: 'ゲストA' }, crypto.randomUUID());
    const loggedIn = guestAction('bootstrap', {}, crypto.randomUUID()) as BootstrapData;
    expect(loggedIn.profile.gPoint).toBe(110);
    const bought = guestAction('buyCard', { cardId: 'P003' }, crypto.randomUUID()) as EconomyState;
    expect(bought.ownedCards).toHaveLength(5);
    const saved = guestAction('saveDeck', { ownedIds: bought.ownedCards.slice(1).map((item) => item.ownedId) }, crypto.randomUUID()) as EconomyState;
    expect(saved.lastDeck).toHaveLength(4);
    const rock = bought.ownedCards.find((item) => item.cardId === 'G001')!;
    const trained = guestAction('train', { items: [{ kind: 'muscle', ownedId: rock.ownedId, count: 2 }] }, crypto.randomUUID()) as EconomyState;
    expect(trained.ownedCards.find((item) => item.ownedId === rock.ownedId)?.trainingSpent).toBe(42);
    const sale = guestAction('sellCard', { ownedId: rock.ownedId }, crypto.randomUUID()) as EconomyState;
    expect(sale.gPoint).toBe(trained.gPoint + 52);
    expect((guestAction('bootstrap', {}, crypto.randomUUID()) as BootstrapData).profile.gPoint).toBe(sale.gPoint);
  });

  it('同じ対戦結果を再送してもGを二重に渡さない', () => {
    guestAction('setNickname', { nickname: 'プレイヤー' }, crypto.randomUUID());
    guestAction('bootstrap', {}, crypto.randomUUID());
    const battleId = crypto.randomUUID();
    const first = guestAction('reportBattle', { battleId, cpuLevel: 2, result: 'win' }, crypto.randomUUID()) as EconomyState;
    const repeated = guestAction('reportBattle', { battleId, cpuLevel: 2, result: 'win' }, crypto.randomUUID()) as EconomyState;
    expect(first.awarded).toBe(30);
    expect(first.completedMissions?.[0]?.reward).toBe(20);
    expect(repeated.gPoint).toBe(first.gPoint);
    expect((guestAction('bootstrap', {}, crypto.randomUUID()) as BootstrapData).profile.gPoint).toBe(first.gPoint);
  });

  it('パックも端末内で開封し、GASへの通信をしない', async () => {
    guestAction('setNickname', { nickname: 'ゲスト' }, crypto.randomUUID());
    const raw = JSON.parse(storage.get('g-card-guest-v1')!) as { gPoint: number };
    raw.gPoint = 500;
    storage.set('g-card-guest-v1', JSON.stringify(raw));
    const fetch = vi.fn(() => { throw new Error('ネットワークは呼ばれない'); });
    vi.stubGlobal('fetch', fetch);
    const opened = await callApi<EconomyState>('openPack', guestSession, { packId: 'all-cards' });
    expect(opened.acquired).toHaveLength(3);
    expect(opened.gPoint).toBe(300);
    expect(fetch).not.toHaveBeenCalled();
  });
});
