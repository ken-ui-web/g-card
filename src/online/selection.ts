import { getCard, ssrCount } from '../data/cards';

export type OnlinePoolItem = { id: string; cardId: string; trainLevel: number };

export function validOnlineSelection(selected: string[], pool: OnlinePoolItem[]): string[] {
  return selected.filter((id) => pool.some((item) => item.id === id));
}

export function toggleOnlineSelection(selected: string[], id: string, pool: OnlinePoolItem[]): string[] {
  const valid = validOnlineSelection(selected, pool);
  if (valid.includes(id)) return valid.filter((item) => item !== id);
  const card = pool.find((item) => item.id === id);
  if (!card || valid.length >= 4 || getCard(card.cardId).rarity === 'SSR' && ssrCount(valid.map((item) => pool.find((entry) => entry.id === item)!.cardId)) >= 1) return valid;
  return [...valid, id];
}

export function initialOnlineSelection(pool: OnlinePoolItem[]): string[] {
  return pool.reduce<string[]>((selected, card) => {
    if (selected.length >= 4 || getCard(card.cardId).rarity === 'SSR' && ssrCount(selected.map((id) => pool.find((item) => item.id === id)!.cardId)) >= 1) return selected;
    return [...selected, card.id];
  }, []);
}
