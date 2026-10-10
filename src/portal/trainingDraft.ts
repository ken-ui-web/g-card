import { isGuest, type BootstrapData } from './api';

export interface TrainingDraft {
  requestId: string;
  status: 'staged' | 'submitting';
  items: { kind: 'muscle'; ownedId: string; count: number }[];
}

const maxTrainingCount = 100;
const maxTrainingCards = 20;

function ownerKey(session: string): string {
  if (isGuest(session)) return 'guest';
  let identity = session;
  try {
    const body = session.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(body)) as { email?: unknown };
    if (typeof claims.email === 'string') identity = claims.email.toLowerCase();
  } catch { /* Keep the session as a fallback. */ }
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < identity.length; index++) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second + code, 2246822519);
  }
  return `${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}

function storageKey(session: string): string { return `g-card-training-draft-v1:${ownerKey(session)}`; }

export function trainingCount(draft: TrainingDraft | null): number {
  return draft?.items.reduce((sum, item) => sum + item.count, 0) ?? 0;
}

export function trainingCost(data: BootstrapData, draft: TrainingDraft | null): number {
  if (!draft) return 0;
  return draft.items.reduce((sum, item) => {
    const owned = data.ownedCards.find((card) => card.ownedId === item.ownedId);
    if (!owned || data.cardMaster.find((card) => card.cardId === owned.cardId)?.type !== 'rock') return Infinity;
    return sum + item.count * (data.economy.muscleCostBase + data.economy.muscleCostStep * owned.trainLevel)
      + data.economy.muscleCostStep * item.count * (item.count - 1) / 2;
  }, 0);
}

export function stageMuscle(draft: TrainingDraft | null, ownedId: string, requestId: string): TrainingDraft {
  if (draft?.status === 'submitting') throw new Error('保存結果を確認してから続けてください');
  if (trainingCount(draft) >= maxTrainingCount) throw new Error('一度に筋トレできるのは100回までです');
  const items = draft?.items.map((item) => ({ ...item })) ?? [];
  const existing = items.find((item) => item.ownedId === ownedId);
  if (existing) existing.count++;
  else {
    if (items.length >= maxTrainingCards) throw new Error('一度に筋トレできるカードは20枚までです');
    items.push({ kind: 'muscle', ownedId, count: 1 });
  }
  return { requestId: draft?.requestId ?? requestId, status: 'staged', items };
}

export function readTrainingDraft(session: string): TrainingDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(session));
    if (!raw) return null;
    const draft = JSON.parse(raw) as TrainingDraft;
    if (!draft || !/^[a-f0-9-]{20,64}$/i.test(draft.requestId) || !['staged', 'submitting'].includes(draft.status) ||
      !Array.isArray(draft.items) || draft.items.length < 1 || draft.items.length > maxTrainingCards ||
      !draft.items.every((item) => item.kind === 'muscle' && typeof item.ownedId === 'string' && item.ownedId.length > 0 && Number.isInteger(item.count) && item.count >= 1 && item.count <= maxTrainingCount) ||
      new Set(draft.items.map((item) => item.ownedId)).size !== draft.items.length || trainingCount(draft) > maxTrainingCount) return null;
    return draft;
  } catch { return null; }
}

export function writeTrainingDraft(session: string, draft: TrainingDraft | null): void {
  if (draft) localStorage.setItem(storageKey(session), JSON.stringify(draft));
  else localStorage.removeItem(storageKey(session));
}
