import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapData } from './api';
import { readTrainingDraft, stageMuscle, trainingCost, trainingCount, writeTrainingDraft } from './trainingDraft';

const requestId = '12345678-1234-1234-1234-123456789abc';
const data = {
  economy: { muscleCostBase: 20, muscleCostStep: 2 },
  ownedCards: [{ ownedId: 'a', cardId: 'G001', trainLevel: 0 }, { ownedId: 'b', cardId: 'G002', trainLevel: 2 }],
  cardMaster: [{ cardId: 'G001', type: 'rock' }, { cardId: 'G002', type: 'rock' }],
} as BootstrapData;

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
});

describe('筋トレの一時保存', () => {
  it('連打と複数カードの費用を、各カードの現在の筋トレ値から計算する', () => {
    let draft = stageMuscle(null, 'a', requestId);
    draft = stageMuscle(draft, 'a', crypto.randomUUID());
    draft = stageMuscle(draft, 'b', crypto.randomUUID());
    expect(trainingCount(draft)).toBe(3);
    expect(trainingCost(data, draft)).toBe(66);
    expect(draft.requestId).toBe(requestId);
    expect(draft.items).toEqual([{ kind: 'muscle', ownedId: 'a', count: 2 }, { kind: 'muscle', ownedId: 'b', count: 1 }]);
  });

  it('再ログイン後も同じ学校アカウントの下書きを復元し、別アカウントには見せない', () => {
    const session = (email: string, exp: number) => `v1.${btoa(JSON.stringify({ email, exp }))}.signature`;
    const draft = stageMuscle(null, 'a', requestId);
    writeTrainingDraft(session('student@school.test', 1), draft);
    expect(readTrainingDraft(session('student@school.test', 2))).toEqual(draft);
    expect(readTrainingDraft(session('other@school.test', 2))).toBeNull();
    writeTrainingDraft(session('student@school.test', 2), null);
    expect(readTrainingDraft(session('student@school.test', 1))).toBeNull();
  });

  it('送信を始めた下書きは変更せず、同じ操作IDで再確認できる', () => {
    const draft = { ...stageMuscle(null, 'a', requestId), status: 'submitting' as const };
    writeTrainingDraft('guest:local', draft);
    expect(readTrainingDraft('guest:local')).toEqual(draft);
    expect(() => stageMuscle(draft, 'a', crypto.randomUUID())).toThrow('保存結果を確認してから');
  });
});
