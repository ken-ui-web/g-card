import { describe, expect, it } from 'vitest';
import { selectedFromSlots, toDeckSlots, toggleDeckSlot, validDeckSlots } from './deckSlots';

describe('対戦用の4枠', () => {
  it('途中のカードを外しても枠を詰めず、次に選んだカードでその枠を埋める', () => {
    const selected = toDeckSlots(['a', 'b', 'c', 'd']);
    const removed = toggleDeckSlot(selected, 'b', true);
    expect(removed).toEqual(['a', null, 'c', 'd']);
    expect(toggleDeckSlot(removed, 'e', true)).toEqual(['a', 'e', 'c', 'd']);
  });

  it('候補から消えたカードだけを空欄にし、選択できないカードは加えない', () => {
    const valid = validDeckSlots(toDeckSlots(['a', 'b', 'c', 'd']), ['a', 'c', 'd', 'e']);
    expect(valid).toEqual(['a', null, 'c', 'd']);
    expect(selectedFromSlots(toggleDeckSlot(valid, 'e', false))).toEqual(['a', 'c', 'd']);
  });
});
