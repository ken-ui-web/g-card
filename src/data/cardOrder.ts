const typeOrder: Record<string, number> = { rock: 0, scissors: 1, paper: 2 };
export function compareCards(a: { type: string; cardId: string }, b: { type: string; cardId: string }) {
  return (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3) || a.cardId.localeCompare(b.cardId);
}
