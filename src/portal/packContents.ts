import type { CardMaster, PackMaster } from './api';
import { compareCards } from '../data/cardOrder';

export function packContents(pack: PackMaster, cards: CardMaster[]) {
  const included = cards.filter((card) => card.inPack && pack.cardPool.includes(card.cardId));
  const counts = new Map<string, number>();
  for (const card of included) counts.set(card.rarity, (counts.get(card.rarity) ?? 0) + 1);
  return included.sort(compareCards).map((card) => ({
    card,
    chance: Number(pack.rarityRates[card.rarity] ?? 0) / (counts.get(card.rarity) ?? 1),
  }));
}

export function formatPackChance(chance: number): string {
  return `${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 }).format(chance)}%`;
}
