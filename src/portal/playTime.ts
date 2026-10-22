export interface PlayLimit {
  dateKey: string;
  expiresAt: string;
  serverNow: string;
  firstLoginToday: boolean;
}

export interface SavedPlayLimit {
  sessionTag: string;
  dateKey: string;
  localExpiresAt: number;
  noticePending: boolean;
}

const storageKey = 'g-card-play-limit-v1';
const checkedKey = 'g-card-play-limit-checked-v1';
export const playLimitEvent = 'g-card-play-limit-changed';
let memoryLimit: SavedPlayLimit | null = null;
let memoryChecked: { sessionTag: string; dateKey: string } | null = null;

function sessionTag(session: string): string {
  let hash = 2166136261;
  for (let index = 0; index < session.length; index++) hash = Math.imul(hash ^ session.charCodeAt(index), 16777619);
  return `${session.length}:${(hash >>> 0).toString(16)}`;
}

export function japanDay(time = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function publish(state: SavedPlayLimit | null): void {
  memoryLimit = state;
  try {
    if (state) localStorage.setItem(storageKey, JSON.stringify(state));
    else localStorage.removeItem(storageKey);
  } catch { /* Server checks still enforce the limit when storage is unavailable. */ }
  window.dispatchEvent(new Event(playLimitEvent));
}

export function hasPlayTimeCheck(session: string | null): boolean {
  if (!session || session === 'guest:local') return true;
  if (memoryChecked?.sessionTag === sessionTag(session) && memoryChecked.dateKey === japanDay()) return true;
  try {
    const checked = JSON.parse(localStorage.getItem(checkedKey) || 'null') as { sessionTag: string; dateKey: string } | null;
    return checked?.sessionTag === sessionTag(session) && checked.dateKey === japanDay();
  } catch { return false; }
}

export function readPlayLimit(session: string | null): SavedPlayLimit | null {
  if (!session || session === 'guest:local') return null;
  if (memoryLimit?.sessionTag === sessionTag(session) && memoryLimit.dateKey === japanDay()) return memoryLimit;
  try {
    const state = JSON.parse(localStorage.getItem(storageKey) || 'null') as SavedPlayLimit | null;
    return state?.sessionTag === sessionTag(session) && state.dateKey === japanDay() && Number.isFinite(state.localExpiresAt) ? state : null;
  } catch { return null; }
}

export function updatePlayLimit(session: string, limit: PlayLimit | null): void {
  memoryChecked = { sessionTag: sessionTag(session), dateKey: limit?.dateKey ?? japanDay() };
  try { localStorage.setItem(checkedKey, JSON.stringify(memoryChecked)); }
  catch { /* The server remains authoritative. */ }
  if (!limit) { publish(null); return; }
  const previous = readPlayLimit(session);
  const duration = Math.max(0, Date.parse(limit.expiresAt) - Date.parse(limit.serverNow));
  const localExpiresAt = Date.now() + duration;
  publish({
    sessionTag: sessionTag(session), dateKey: limit.dateKey, localExpiresAt,
    noticePending: Boolean(previous?.noticePending || limit.firstLoginToday),
  });
}

export function markPlayLimitExpired(session: string): void {
  const previous = readPlayLimit(session);
  memoryChecked = { sessionTag: sessionTag(session), dateKey: japanDay() };
  try { localStorage.setItem(checkedKey, JSON.stringify(memoryChecked)); }
  catch { /* The server remains authoritative. */ }
  publish({ ...previous, sessionTag: sessionTag(session), dateKey: japanDay(), localExpiresAt: Date.now() - 1, noticePending: false });
}

export function acknowledgePlayLimit(session: string): void {
  const state = readPlayLimit(session);
  if (state) publish({ ...state, noticePending: false });
}

export function clearPlayLimit(): void {
  memoryChecked = null;
  try { localStorage.removeItem(checkedKey); } catch { /* No persistent state to remove. */ }
  publish(null);
}
