import { describe, expect, it } from 'vitest';
import { collectEconomyChanges, markEconomyChangeSaved, validateEconomyChanges, type AdminData } from './adminEconomyChanges';

const saved = {
  settings: [{ key: 'muscleCostBase', value: '20', description: '筋トレ基本価格' }],
  cards: [{ cardId: 'G001', name: 'パンチ', shopPrice: 50, inPack: true, active: true }],
  packs: [{ packId: 'starter', name: 'スタート', price: 200, cardsPerPack: 3, rarityRates: { N: 70, R: 30 }, cardPool: ['G001'], pityCount: 0, active: true }],
  missions: [{ missionId: 'train', period: 'daily', condition: 'train', targetCount: 1, reward: 10, label: '筋トレ', active: true }],
  decks: [{ deckId: 'sample', name: 'サンプル', cardIds: ['G001'], maxLife: 100, rockTrainLevel: 0 }],
} as unknown as AdminData;

describe('管理者の一括保存', () => {
  it('変更した項目だけを抽出し、カードをパックより先に保存する', () => {
    const draft = structuredClone(saved);
    draft.settings[0].value = '25';
    draft.cards[0].shopPrice = 60;
    draft.packs[0].price = 250;
    draft.missions[0].reward = 20;
    draft.decks[0].maxLife = 120;
    const changes = collectEconomyChanges(saved, draft);
    expect(changes.map((item) => item.action)).toEqual(['adminSaveSettings', 'adminSaveCard', 'adminSavePack', 'adminSaveMission', 'adminSaveDeck']);
    expect(changes[2].payload).toMatchObject({ price: 250, rarityRates: { N: 70, R: 30 } });
  });

  it('途中で失敗しても成功済みだけを保存済みにできる', () => {
    const draft = structuredClone(saved);
    draft.settings[0].value = '25';
    draft.cards[0].shopPrice = 60;
    const changes = collectEconomyChanges(saved, draft);
    const afterFirst = markEconomyChangeSaved(saved, draft, changes[0]);
    expect(collectEconomyChanges(afterFirst, draft).map((item) => item.action)).toEqual(['adminSaveCard']);
  });

  it('不正な入力は送信前に止める', () => {
    const draft = structuredClone(saved);
    draft.settings[0].value = '-1';
    expect(validateEconomyChanges(draft, collectEconomyChanges(saved, draft))).toContain('筋トレ基本価格');
  });

  it('販売停止中のカードもサンプル・CPU候補に保存できる', () => {
    const draft = structuredClone(saved);
    draft.cards[0].active = false;
    for (const cardId of ['G002', 'C008', 'P001']) draft.cards.push({ ...draft.cards[0], cardId });
    draft.decks[0].cardIds = ['G001', 'G002', 'C008', 'P001'];
    const changes = collectEconomyChanges(saved, draft).filter((change) => change.group === 'decks');
    expect(validateEconomyChanges(draft, changes)).toBeNull();
  });
  it('単品販売停止中のカードをパックに収録できる', () => {
    const draft = structuredClone(saved);
    draft.cards[0].active = false;
    draft.cards[0].rarity = 'N';
    draft.packs[0].rarityRates = { N: 100 };
    const changes = collectEconomyChanges(saved, draft).filter((change) => change.group === 'packs');
    expect(validateEconomyChanges(draft, changes)).toBeNull();
  });
});
