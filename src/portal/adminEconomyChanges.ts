import type { BattleDeckConfig, CardMaster } from './api';

export interface AdminData {
  settings: { key: string; value: string; description: string }[];
  cards: CardMaster[];
  packs: { packId: string; name: string; price: number; cardsPerPack: number; rarityRates: Record<string, number>; cardPool: string[]; pityCount: number; active: boolean }[];
  missions: { missionId: string; period: string; condition: string; targetCount: number; reward: number; label: string; active: boolean }[];
  decks: BattleDeckConfig[];
}

type Group = keyof AdminData;
export interface EconomyChange {
  group: Group;
  id: string;
  label: string;
  action: string;
  payload: object;
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const packPayload = (pack: AdminData['packs'][number]) => ({ ...pack, rarityRates: Object.fromEntries(Object.entries(pack.rarityRates).filter(([, rate]) => Number(rate) > 0)) });

export function collectEconomyChanges(saved: AdminData, draft: AdminData): EconomyChange[] {
  const changes: EconomyChange[] = [];
  const savedSettings = new Map(saved.settings.map((item) => [item.key, item]));
  for (const item of draft.settings) if (savedSettings.has(item.key) && item.value !== savedSettings.get(item.key)!.value) {
    changes.push({ group: 'settings', id: item.key, label: item.description, action: 'adminSaveSettings', payload: { key: item.key, value: item.value } });
  }
  const savedCards = new Map(saved.cards.map((item) => [item.cardId, item]));
  for (const item of draft.cards) {
    const previous = savedCards.get(item.cardId);
    const payload = { cardId: item.cardId, shopPrice: item.shopPrice, inPack: item.inPack, active: item.active };
    if (previous && !same(payload, { cardId: previous.cardId, shopPrice: previous.shopPrice, inPack: previous.inPack, active: previous.active })) {
      changes.push({ group: 'cards', id: item.cardId, label: item.name, action: 'adminSaveCard', payload });
    }
  }
  const savedPacks = new Map(saved.packs.map((item) => [item.packId, item]));
  for (const item of draft.packs) {
    const previous = savedPacks.get(item.packId);
    if (previous && !same(packPayload(item), packPayload(previous))) {
      changes.push({ group: 'packs', id: item.packId, label: item.name, action: 'adminSavePack', payload: packPayload(item) });
    }
  }
  const savedMissions = new Map(saved.missions.map((item) => [item.missionId, item]));
  for (const item of draft.missions) {
    const previous = savedMissions.get(item.missionId);
    if (previous && !same(item, previous)) {
      changes.push({ group: 'missions', id: item.missionId, label: item.label, action: 'adminSaveMission', payload: item });
    }
  }
  const savedDecks = new Map(saved.decks.map((item) => [item.deckId, item]));
  for (const item of draft.decks) {
    const previous = savedDecks.get(item.deckId);
    if (previous && !same(item, previous)) {
      changes.push({ group: 'decks', id: item.deckId, label: item.name, action: 'adminSaveDeck', payload: item });
    }
  }
  return changes;
}

export function markEconomyChangeSaved(saved: AdminData, draft: AdminData, change: EconomyChange): AdminData {
  const field = change.group === 'settings' ? 'key' : change.group === 'cards' ? 'cardId' : change.group === 'packs' ? 'packId' : change.group === 'missions' ? 'missionId' : 'deckId';
  const current = saved[change.group] as Record<string, unknown>[];
  const updated = draft[change.group] as Record<string, unknown>[];
  const item = updated.find((entry) => entry[field] === change.id);
  return item ? { ...saved, [change.group]: current.map((entry) => entry[field] === change.id ? item : entry) } : saved;
}

const integer = (value: unknown, min: number, max: number): boolean => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;

export function validateEconomyChanges(draft: AdminData, changes: EconomyChange[]): string | null {
  const cards = new Map(draft.cards.map((card) => [card.cardId, card]));
  for (const change of changes) {
    if (change.group === 'settings') {
      const setting = draft.settings.find((item) => item.key === change.id)!;
      const value = setting.value.trim();
      if (value === '' && setting.key === 'maxLifeCap') continue;
      if (!/^\d+$/.test(value) || !integer(value, setting.key === 'lifePerRun' ? 1 : 0, 100000) || (['economyEnabled', 'learningEnabled', 'onlineEnabled', 'rankingEnabled'].includes(setting.key) && !['0', '1'].includes(value))) return `${setting.description}の数値を確認してください。`;
    }
    if (change.group === 'cards') {
      const card = cards.get(change.id)!;
      if (card.shopPrice !== null && (!integer(card.shopPrice, 0, 100000) || card.rarity === 'SSR')) return `${card.name}の単品価格を確認してください。SSRはパック限定です。`;
    }
    if (change.group === 'packs') {
      const pack = draft.packs.find((item) => item.packId === change.id)!;
      const rates = Object.entries(pack.rarityRates).filter(([, rate]) => Number(rate) > 0);
      if (!integer(pack.price, 0, 100000) || !integer(pack.cardsPerPack, 1, 10) || !integer(pack.pityCount, 0, 100) || !pack.cardPool.length || !rates.length || Object.entries(pack.rarityRates).some(([rarity, rate]) => !['N', 'R', 'SR', 'SSR'].includes(rarity) || !Number.isFinite(Number(rate)) || Number(rate) < 0) || Math.abs(rates.reduce((sum, [, rate]) => sum + Number(rate), 0) - 100) > .001 || pack.cardPool.some((id) => !cards.get(id)?.active || !cards.get(id)?.inPack) || rates.some(([rarity]) => !pack.cardPool.some((id) => cards.get(id)?.rarity === rarity)) || pack.pityCount > 0 && !rates.some(([rarity]) => rarity === 'SR' || rarity === 'SSR')) return `${pack.name}の価格・排出率・収録カードを確認してください。`;
    }
    if (change.group === 'missions') {
      const mission = draft.missions.find((item) => item.missionId === change.id)!;
      if (!mission.label.trim() || mission.label.length > 80 || !integer(mission.targetCount, 1, 1000) || !integer(mission.reward, 0, 100000)) return `${mission.missionId}の表示名・回数・報酬を確認してください。`;
    }
    if (change.group === 'decks') {
      const deck = draft.decks.find((item) => item.deckId === change.id)!;
      if (deck.cardIds.length < 4 || deck.cardIds.length > 40 || new Set(deck.cardIds).size !== deck.cardIds.length || deck.cardIds.some((id) => !cards.get(id)?.active) || !integer(deck.maxLife, 1, 9999) || !integer(deck.rockTrainLevel, 0, 99)) return `${deck.name}のカードと数値を確認してください。`;
    }
  }
  return null;
}
