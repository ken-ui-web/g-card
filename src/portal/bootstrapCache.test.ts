import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearBootstrapCache, isBootstrapFresh, patchBootstrapCache, readBootstrapCache, writeBootstrapCache } from './bootstrapCache';
import type { BootstrapData } from './api';

const session = 'school-session-a';
const data = { profile: { nickname: 'A', role: 'student', gPoint: 100, maxLife: 100, runCount: 0, pityCounter: 0 }, ownedCards: [], lastDeck: [], missions: [], daily: { cpuRewards: 0, packsBought: 0 }, loginBonus: { awarded: true, amount: 10, streak: 1 } } as unknown as BootstrapData;

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } });
  clearBootstrapCache();
});

describe('bootstrap cache', () => {
  it('keeps school accounts separate', () => {
    writeBootstrapCache(session, data, Date.parse('2026-10-04T00:00:00Z'));
    expect(readBootstrapCache(session)?.data.profile.nickname).toBe('A');
    expect(readBootstrapCache('school-session-b')).toBeNull();
  });

  it('refreshes after the short TTL and at the next Japan day', () => {
    const fetchedAt = Date.parse('2026-10-04T14:59:00Z');
    writeBootstrapCache(session, data, fetchedAt);
    const snapshot = readBootstrapCache(session)!;
    expect(isBootstrapFresh(snapshot, fetchedAt + 30_000)).toBe(true);
    expect(isBootstrapFresh(snapshot, fetchedAt + 121_000)).toBe(false);
    expect(isBootstrapFresh(snapshot, Date.parse('2026-10-04T15:00:01Z'))).toBe(false);
  });

  it('applies a server-confirmed update and rejects an older background response', () => {
    writeBootstrapCache(session, data);
    const oldRevision = readBootstrapCache(session)!.revision;
    patchBootstrapCache(session, (current) => ({ ...current, profile: { ...current.profile, gPoint: 80 } }));
    expect(writeBootstrapCache(session, data, Date.now(), oldRevision)).toBe(false);
    expect(readBootstrapCache(session)?.data.profile.gPoint).toBe(80);
  });
});
