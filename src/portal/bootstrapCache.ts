import { callApi, type BootstrapData, type EconomyState } from './api';

const storageKey = 'g-card-bootstrap-v1';
const buildVersion = import.meta.env.VITE_BUILD_VERSION || 'development';
const maxAgeMs = 2 * 60 * 1000;

export interface BootstrapSnapshot {
  sessionTag: string;
  buildVersion: string;
  fetchedAt: number;
  revision: number;
  data: BootstrapData;
}

let memory: BootstrapSnapshot | null = null;
const pending = new Map<string, Promise<BootstrapData>>();

// The session is already saved by api.ts. Store only a fingerprint beside the snapshot.
function sessionTag(session: string): string {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < session.length; index++) {
    const code = session.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second + code, 2246822519);
  }
  return `${session.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

export function requestBootstrap(session: string): Promise<BootstrapData> {
  const tag = sessionTag(session);
  const existing = pending.get(tag);
  if (existing) return existing;
  const request = callApi<BootstrapData>('bootstrap', session).finally(() => { if (pending.get(tag) === request) pending.delete(tag); });
  pending.set(tag, request);
  return request;
}

function persist(snapshot: BootstrapSnapshot): void {
  memory = snapshot;
  try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Memory still works when storage is full or disabled. */ }
}

export function readBootstrapCache(session: string): BootstrapSnapshot | null {
  const tag = sessionTag(session);
  if (memory?.sessionTag === tag && memory.buildVersion === buildVersion) return memory;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootstrapSnapshot;
    if (parsed.sessionTag !== tag || parsed.buildVersion !== buildVersion || !parsed.data?.profile || !Number.isFinite(parsed.fetchedAt)) return null;
    memory = parsed;
    return parsed;
  } catch { return null; }
}

function japanDay(time: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}

export function isBootstrapFresh(snapshot: BootstrapSnapshot | null, now = Date.now()): boolean {
  return Boolean(snapshot && snapshot.fetchedAt > 0 && now >= snapshot.fetchedAt && now - snapshot.fetchedAt < maxAgeMs && isBootstrapFromToday(snapshot, now));
}

export function isBootstrapFromToday(snapshot: BootstrapSnapshot | null, now = Date.now()): boolean {
  return Boolean(snapshot && snapshot.fetchedAt > 0 && japanDay(now) === japanDay(snapshot.fetchedAt));
}

export function writeBootstrapCache(session: string, data: BootstrapData, fetchedAt = Date.now(), expectedRevision?: number): boolean {
  const current = readBootstrapCache(session);
  if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) return false;
  persist({ sessionTag: sessionTag(session), buildVersion, fetchedAt, revision: (current?.revision ?? 0) + 1, data });
  return true;
}

export function patchBootstrapCache(session: string, update: (data: BootstrapData) => BootstrapData, stale = false): BootstrapData | null {
  const current = readBootstrapCache(session);
  if (!current) return null;
  const data = update(current.data);
  persist({ ...current, data, fetchedAt: stale ? 0 : current.fetchedAt, revision: current.revision + 1 });
  return data;
}

export function clearBootstrapCache(): void {
  memory = null;
  try { localStorage.removeItem(storageKey); } catch { /* No persistent cache to remove. */ }
}

export function mergeEconomy(data: BootstrapData, state: EconomyState): BootstrapData {
  return {
    ...data,
    profile: { ...data.profile, gPoint: state.gPoint, maxLife: state.maxLife, runCount: state.runCount, pityCounter: state.pityCounter },
    ownedCards: state.ownedCards, lastDeck: state.lastDeck, missions: state.missions, daily: state.daily,
  };
}
