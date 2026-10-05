import { callApi, isGuest, type BattleDeckConfig } from './api';
import { cardById } from '../data/cards';
import { patchBootstrapCache } from './bootstrapCache';

const requiredDecks = ['sample', 'cpu-1', 'cpu-2', 'cpu-3'];

export async function loadBattleConfig(session: string): Promise<BattleDeckConfig[]> {
  const guest = isGuest(session);
  const decks = await callApi<BattleDeckConfig[]>(guest ? 'getPublicBattleConfig' : 'getBattleConfig', guest ? null : session);
  if (!Array.isArray(decks) || requiredDecks.some((id) => {
    const cardIds = decks.find((deck) => deck.deckId === id)?.cardIds;
    return !Array.isArray(cardIds) || cardIds.length < 4 || cardIds.length > 40 || cardIds.some((cardId) => !cardById[cardId]);
  })) throw new Error('対戦設定を確認できません。もう一度読み込んでください。');
  if (!guest) patchBootstrapCache(session, (current) => ({ ...current, battleConfig: decks }));
  return decks;
}
