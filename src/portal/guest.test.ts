import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyGuestShopConfig, clearGuestShopConfig, guestAction, installGuestShopConfig } from './guest';
import { callApi, guestSession, type BootstrapData, type EconomyState, type PublicShopConfig } from './api';
import { availableCards } from '../data/cards';

const defaultShopConfig: PublicShopConfig = {
  cards: availableCards.map((card) => ({ cardId: card.cardId, shopPrice: card.shopPrice, active: true, inPack: card.inPack })),
  packs: [{ packId: 'all-cards', name: '全カードパック', price: 200, cardsPerPack: 3, rarityRates: { N: 60, R: 30, SR: 8.5, SSR: 1.5 }, cardPool: availableCards.map((card) => card.cardId), pityCount: 10 }],
  packDailyLimit: 10,
  sellPrices: { N: 10, R: 30, SR: 100, SSR: 300 },
};
const restrictedShopConfig: PublicShopConfig = {
  ...defaultShopConfig,
  cards: defaultShopConfig.cards.map((card) => card.cardId === 'P003' ? { ...card, shopPrice: null, active: false, inPack: false } : card.cardId === 'G001' ? { ...card, shopPrice: 25 } : card),
  packs: [{ packId: 'restricted', name: '限定パック', price: 80, cardsPerPack: 1, rarityRates: { N: 100 }, cardPool: ['G001'], pityCount: 0 }],
  packDailyLimit: 1,
};

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  clearGuestShopConfig();
  installGuestShopConfig(defaultShopConfig);
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

  it('単品販売が停止したレアカードもパックから排出できる', () => {
    guestAction('setNickname', { nickname: 'ゲスト' }, crypto.randomUUID());
    const raw = JSON.parse(storage.get('g-card-guest-v1')!) as { gPoint: number };
    raw.gPoint = 500;
    storage.set('g-card-guest-v1', JSON.stringify(raw));
    installGuestShopConfig({ ...defaultShopConfig, cards: defaultShopConfig.cards.map((setting) => ({ ...setting, active: availableCards.find((card) => card.cardId === setting.cardId)?.rarity === 'N' })) });
    const opened = guestAction('openPack', { packId: 'all-cards' }, crypto.randomUUID()) as EconomyState;
    expect(opened.acquired).toHaveLength(3);
  });

  it('管理者が販売停止したカードとパックを表示せず、ゲストの購入も拒否する', () => {
    guestAction('setNickname', { nickname: 'ゲスト' }, crypto.randomUUID());
    installGuestShopConfig(restrictedShopConfig);
    const data = applyGuestShopConfig(guestAction('bootstrap', {}, crypto.randomUUID()) as BootstrapData, restrictedShopConfig);
    expect(data.cardMaster.find((card) => card.cardId === 'P003')).toMatchObject({ active: false, shopPrice: null });
    expect(data.packs.map((pack) => pack.packId)).toEqual(['restricted']);
    expect(() => guestAction('buyCard', { cardId: 'P003' }, crypto.randomUUID())).toThrow('購入できません');
    expect(() => guestAction('openPack', { packId: 'all-cards' }, crypto.randomUUID())).toThrow('パックを購入できません');
    const bought = guestAction('buyCard', { cardId: 'G001' }, crypto.randomUUID()) as EconomyState;
    expect(bought.gPoint).toBe(85);
    const opened = guestAction('openPack', { packId: 'restricted' }, crypto.randomUUID()) as EconomyState;
    expect(opened.acquired?.map((card) => card.cardId)).toEqual(['G001']);
    expect(opened.gPoint).toBe(5);
    expect(() => guestAction('openPack', { packId: 'restricted' }, crypto.randomUUID())).toThrow('パックを購入できません');
  });
});
