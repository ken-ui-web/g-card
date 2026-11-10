import { describe, expect, it } from 'vitest';
import { initialOnlineSelection, toggleOnlineSelection, validOnlineSelection, type OnlinePoolItem } from './selection';

const fourCards: OnlinePoolItem[] = ['G001', 'G002', 'C008', 'P001'].map((cardId) => ({ id: cardId, cardId, trainLevel: 0 }));

describe('オンライン対戦の4枚選択', () => {
  it('入室前の選択が別のカードを指していても、所持4枚目を選べる', () => {
    const stale = ['G001', 'G002', 'C008', 'P003'];
    expect(validOnlineSelection(stale, fourCards)).toHaveLength(3);
    expect(toggleOnlineSelection(stale, 'P001', fourCards)).toEqual(['G001', 'G002', 'C008', 'P001']);
  });
  it('候補がちょうど4枚なら4枚とも選んだ状態にできる', () => {
    expect(initialOnlineSelection(fourCards)).toEqual(['G001', 'G002', 'C008', 'P001']);
  });
  it('保存済みの自分のデッキを同じ順番で初期選択する', () => {
    const pool = [...fourCards, { id: 'P003', cardId: 'P003', trainLevel: 0 }];
    expect(initialOnlineSelection(pool, ['P003', 'C008', 'G002', 'G001'])).toEqual(['P003', 'C008', 'G002', 'G001']);
    expect(initialOnlineSelection(pool, ['売却済み', 'P003', 'G002'])).toEqual(['P003', 'G002', 'G001', 'C008']);
  });
});
