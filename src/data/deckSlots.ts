export type DeckSlots = [string | null, string | null, string | null, string | null];

export function toDeckSlots(ids: string[]): DeckSlots {
  const unique = [...new Set(ids)].slice(0, 4);
  return Array.from({ length: 4 }, (_, index) => unique[index] ?? null) as DeckSlots;
}

export function selectedFromSlots(slots: DeckSlots): string[] {
  return slots.filter((id): id is string => id !== null);
}

export function validDeckSlots(slots: DeckSlots, validIds: string[]): DeckSlots {
  const allowed = new Set(validIds);
  return slots.map((id) => id && allowed.has(id) ? id : null) as DeckSlots;
}

export function toggleDeckSlot(slots: DeckSlots, id: string, canAdd: boolean): DeckSlots {
  const selectedIndex = slots.indexOf(id);
  if (selectedIndex !== -1) return slots.map((value, index) => index === selectedIndex ? null : value) as DeckSlots;
  const emptyIndex = slots.indexOf(null);
  if (!canAdd || emptyIndex === -1) return slots;
  return slots.map((value, index) => index === emptyIndex ? id : value) as DeckSlots;
}
