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

export function initialOnlineSelection(pool: OnlinePoolItem[], savedDeck: string[] = []): string[] {
  return [...savedDeck, ...pool.map((card) => card.id)].reduce<string[]>((selected, id) => {
    const card = pool.find((item) => item.id === id);
    if (!card || selected.includes(id) || selected.length >= 4 || getCard(card.cardId).rarity === 'SSR' && ssrCount(selected.map((selectedId) => pool.find((item) => item.id === selectedId)!.cardId)) >= 1) return selected;
    return [...selected, id];
  }, []);
}
