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
  runCount: number;
  pityCounter: number;
}

export interface OwnedCard { ownedId: string; cardId: string; trainLevel: number; source?: string }
export interface CardMaster { cardId: string; name: string; type: string; rarity: string; image: string; text: string; effects: { type: string; amount?: number }[]; trainingMultiplier: number; shopPrice: number | null; inPack: boolean; active: boolean }
export interface PackMaster { packId: string; name: string; price: number; cardsPerPack: number; rarityRates: Record<string, number>; cardPool: string[]; pityCount: number }
export interface BattleDeckConfig { deckId: string; name: string; cardIds: string[]; maxLife: number; rockTrainLevel: number }
export interface MissionState { missionId: string; period: string; condition: string; targetCount: number; reward: number; label: string; progress: number; completed: boolean }
export interface EconomyState {
  gPoint: number;
  runCount: number;
  pityCounter: number;
  maxLife: number;
  ownedCards: OwnedCard[];
  lastDeck: string[];
  missions: MissionState[];
  daily: { cpuRewards: number; onlineRewards?: number; packsBought: number };
  acquired?: OwnedCard[];
  trained?: number;
  awarded?: number;
  pityRemaining?: number | null;
  completedMissions?: { label: string; reward: number }[];
}

export interface BootstrapData {
  profile: Profile;
  needsNickname: boolean;
  loginBonus: { awarded: boolean; amount: number; streak: number };
  ownedCards: OwnedCard[];
  cardMaster: CardMaster[];
  lastDeck: string[];
  packs: PackMaster[];
  battleConfig: BattleDeckConfig[];
  missions: MissionState[];
  daily: EconomyState['daily'];
  economy: { enabled: boolean; muscleCostBase: number; muscleCostStep: number; runCostBase: number; runCostStep: number; lifePerRun: number; cpuRewardDailyCap: number; packDailyLimit: number; sellPrices: Record<string, number> };
  learning?: { enabled: boolean };
  unreadTests: number;
  pendingReflections: number;
  online?: { enabled: boolean; rankingEnabled: boolean; rewardDailyCap: number };
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

export async function callApi<T>(action: string, session: string | null, payload: object = {}, requestId: string = crypto.randomUUID()): Promise<T> {
  if (!gasUrl) throw new Error('サーバーの接続先が未設定です');
  const body = JSON.stringify({ action, session, requestId, payload });
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(gasUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, signal: controller.signal,
      });
      if (!response.ok) throw new TypeError(`通信エラー ${response.status}`);
      let result: ApiResponse<T>;
      try { result = await response.json() as ApiResponse<T>; }
      catch { throw new TypeError('サーバーの応答形式が正しくありません'); }
      if (!result?.ok || result.data === undefined) {
        const error = new Error(result?.error?.message ?? '処理できませんでした') as Error & { code?: string };
        error.code = result?.error?.code;
        throw error;
      }
      return result.data;
    } catch (failure) {
      const busy = (failure as Error & { code?: string })?.code === 'BUSY';
      const transient = busy || failure instanceof TypeError || (failure instanceof DOMException && failure.name === 'AbortError');
      if (!transient) throw failure;
      if (attempt === 2) throw busy ? new Error('利用が集中しています。少し待ってからもう一度試してください') : new Error('サーバーと通信できません。接続を確認してもう一度試してください');
      await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1) + Math.random() * 350));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error('サーバーと通信できません');
}
