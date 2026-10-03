export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

export interface Profile {
  nickname: string;
  role: 'student' | 'admin';
  gPoint: number;
  maxLife: number;
}

export interface BootstrapData {
  profile: Profile;
  needsNickname: boolean;
  loginBonus: { awarded: boolean; amount: number; streak: number };
  ownedCards: { ownedId: string; cardId: string; trainLevel: number }[];
  cardMaster: { cardId: string; name: string; type: string; rarity: string; image: string }[];
  lastDeck: string[];
  missions: unknown[];
  unreadTests: number;
  pendingReflections: number;
}

const sessionKey = 'g-card-session-v1';
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const gasUrl = import.meta.env.VITE_GAS_URL?.trim() ?? '';
export const portalConfigured = Boolean(googleClientId && gasUrl);

export function savedSession(): string | null {
  try { return localStorage.getItem(sessionKey); } catch { return null; }
}

export function saveSession(session: string | null): void {
  try {
    if (session) localStorage.setItem(sessionKey, session);
    else localStorage.removeItem(sessionKey);
  } catch { /* Private browsing may deny storage; current login still works. */ }
}

export async function callApi<T>(action: string, session: string | null, payload: Record<string, unknown> = {}): Promise<T> {
  if (!gasUrl) throw new Error('サーバーの接続先が未設定です');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, session, requestId: crypto.randomUUID(), payload }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`サーバーの応答を確認できません（${response.status}）`);
    let result: ApiResponse<T>;
    try { result = await response.json() as ApiResponse<T>; }
    catch { throw new Error('サーバーの応答形式が正しくありません'); }
    if (!result?.ok || result.data === undefined) {
      const error = new Error(result?.error?.message ?? '処理できませんでした') as Error & { code?: string };
      error.code = result?.error?.code;
      throw error;
    }
    return result.data;
  } catch (failure) {
    if (failure instanceof TypeError || (failure instanceof DOMException && failure.name === 'AbortError')) {
      throw new Error('サーバーと通信できません。接続を確認してもう一度試してください');
    }
    throw failure;
  } finally {
    window.clearTimeout(timeout);
  }
}
