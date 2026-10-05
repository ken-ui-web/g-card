import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBattleConfig } from './battleConfig';
import { callApi } from './api';
import { patchBootstrapCache } from './bootstrapCache';

vi.mock('./api', () => ({ callApi: vi.fn(), isGuest: (session: string) => session === 'guest:local' }));
vi.mock('./bootstrapCache', () => ({ patchBootstrapCache: vi.fn() }));

const oldCards = Array.from({ length: 40 }, (_, index) => `old-${index}`);
const fresh = [
  { deckId: 'sample', name: 'サンプル', cardIds: ['G001', 'G002', 'C008', 'P001'], maxLife: 100, rockTrainLevel: 0 },
  ...[1, 2, 3].map((level) => ({ deckId: `cpu-${level}`, name: `CPU Lv${level}`, cardIds: ['G001', 'G002', 'C008', 'P001'], maxLife: 100, rockTrainLevel: 0 })),
];

beforeEach(() => vi.clearAllMocks());

describe('対戦設定の取得', () => {
  it('古い40枚のホーム情報があっても、対戦に入るたびに4枚の最新設定を取得する', async () => {
    vi.mocked(callApi).mockResolvedValue(fresh);
    const result = await loadBattleConfig('school-session');
    expect(callApi).toHaveBeenCalledWith('getBattleConfig', 'school-session');
    expect(result.find((deck) => deck.deckId === 'sample')?.cardIds).toHaveLength(4);
    const update = vi.mocked(patchBootstrapCache).mock.calls[0][1];
    expect(update({ battleConfig: [{ ...fresh[0], cardIds: oldCards }] } as never).battleConfig[0].cardIds).toHaveLength(4);
  });

  it('候補設定が欠けた応答を対戦に使わない', async () => {
    vi.mocked(callApi).mockResolvedValue([]);
    await expect(loadBattleConfig('school-session')).rejects.toThrow('対戦設定');
  });

  it('ゲストも管理者が保存した公開対戦設定を取得する', async () => {
    vi.mocked(callApi).mockResolvedValue(fresh);
    const result = await loadBattleConfig('guest:local');
    expect(callApi).toHaveBeenCalledWith('getPublicBattleConfig', null);
    expect(result.find((deck) => deck.deckId === 'sample')?.cardIds).toHaveLength(4);
    expect(patchBootstrapCache).not.toHaveBeenCalled();
  });
});
