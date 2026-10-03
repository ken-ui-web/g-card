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
const channel = 'g-card-bridge-v1';
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const gasUrl = import.meta.env.VITE_GAS_URL?.trim() ?? '';
export const portalConfigured = Boolean(googleClientId && gasUrl);

interface BridgeConnection { frame: HTMLIFrameElement; source: MessageEventSource; origin: string }
let bridge: Promise<BridgeConnection> | null = null;

function getBridge(): Promise<BridgeConnection> {
  if (bridge) return bridge;
  bridge = new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Gカード通信';
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    const url = new URL(gasUrl);
    const nonce = crypto.randomUUID();
    url.searchParams.set('parentOrigin', window.location.origin);
    url.searchParams.set('nonce', nonce);
    frame.src = url.toString();
    const timeout = window.setTimeout(() => fail(), 20000);
    const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener('message', onMessage); frame.removeEventListener('error', fail); };
    const fail = () => { cleanup(); frame.remove(); bridge = null; reject(new Error('サーバーに接続できません。公開設定を確認してください')); };
    const onMessage = (event: MessageEvent) => {
      if (!event.source || !/^https:\/\/(script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(event.origin) ||
          event.data?.channel !== channel || event.data?.type !== 'ready' || event.data?.nonce !== nonce) return;
      cleanup(); resolve({ frame, source: event.source, origin: event.origin });
    };
    frame.addEventListener('error', fail);
    window.addEventListener('message', onMessage);
    document.body.appendChild(frame);
  });
  return bridge;
}

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
  const connection = await getBridge();
  const id = crypto.randomUUID();
  const result = await new Promise<ApiResponse<T>>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('サーバーの応答がありません。もう一度試してください')); }, 30000);
    const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener('message', onMessage); };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== connection.source || event.origin !== connection.origin || event.data?.channel !== channel || event.data?.type !== 'response' || event.data?.id !== id) return;
      cleanup(); resolve(event.data.result as ApiResponse<T>);
    };
    window.addEventListener('message', onMessage);
    connection.source.postMessage({ channel, type: 'request', id, request: { action, session, payload } }, { targetOrigin: connection.origin });
  });
  if (!result?.ok || result.data === undefined) {
    const error = new Error(result?.error?.message ?? '処理できませんでした') as Error & { code?: string };
    error.code = result?.error?.code;
    throw error;
  }
  return result.data;
}
