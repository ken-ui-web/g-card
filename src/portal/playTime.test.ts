import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgePlayLimit, clearPlayLimit, hasPlayTimeCheck, japanDay, markPlayLimitExpired, readPlayLimit, updatePlayLimit } from './playTime';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('1日10分の利用時間', () => {
  it('初回だけ注意を出し、再読み込みや再ログインで期限を延ばさない', () => {
    const cells = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => cells.get(key) ?? null,
      setItem: (key: string, value: string) => { cells.set(key, value); },
      removeItem: (key: string) => { cells.delete(key); },
    });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T01:00:00Z'));
    const session = 'school-session';
    expect(hasPlayTimeCheck(session)).toBe(false);
    const limit = { dateKey: japanDay(), serverNow: '2026-10-22T01:00:00Z', expiresAt: '2026-10-22T01:10:00Z', firstLoginToday: true };
    updatePlayLimit(session, limit);
    expect(hasPlayTimeCheck(session)).toBe(true);
    expect(readPlayLimit(session)?.noticePending).toBe(true);
    expect(readPlayLimit('different-session')).toBeNull();
    acknowledgePlayLimit(session);
    expect(readPlayLimit(session)?.noticePending).toBe(false);
    vi.advanceTimersByTime(2 * 60 * 1000);
    updatePlayLimit(session, { ...limit, serverNow: '2026-10-22T01:02:00Z', firstLoginToday: false });
    expect(readPlayLimit(session)?.localExpiresAt).toBe(Date.parse('2026-10-22T01:10:00Z'));
    expect(readPlayLimit(session)?.noticePending).toBe(false);
    vi.advanceTimersByTime(8 * 60 * 1000);
    expect(Date.now() >= readPlayLimit(session)!.localExpiresAt).toBe(true);
    markPlayLimitExpired(session);
    expect(readPlayLimit(session)!.localExpiresAt).toBeLessThan(Date.now());
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    expect(readPlayLimit(session)).toBeNull();
    expect(hasPlayTimeCheck(session)).toBe(false);
    clearPlayLimit();
    updatePlayLimit(session, null);
    expect(hasPlayTimeCheck(session)).toBe(true);
    expect(readPlayLimit(session)).toBeNull();
  });
});
