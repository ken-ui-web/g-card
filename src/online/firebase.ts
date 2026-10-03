import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, goOffline, goOnline, get, onDisconnect, ref, remove, runTransaction, serverTimestamp, set, update, type Database } from 'firebase/database';
import type { DeckMode, OnlineRoom } from './protocol';

const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || '';
export const firebaseConfigured = Boolean(rawConfig.trim());
let database: Database | null = null;

export async function connectFirebase(): Promise<{ db: Database; uid: string }> {
  if (!firebaseConfigured) throw new Error('先生によるオンライン対戦の設定を待っています。');
  let options: FirebaseOptions;
  try { options = JSON.parse(rawConfig) as FirebaseOptions; }
  catch { throw new Error('Firebaseの公開設定を確認してください。'); }
  if (!options.apiKey || !options.authDomain || !options.projectId || !options.databaseURL) throw new Error('Firebaseの公開設定が不足しています。');
  const app = getApps().length ? getApp() : initializeApp(options);
  database = getDatabase(app);
  goOnline(database);
  const credentials = await signInAnonymously(getAuth(app));
  await cleanupHostedRooms(database, credentials.user.uid);
  return { db: database, uid: credentials.user.uid };
}

export function disconnectFirebase(): void {
  if (database) goOffline(database);
}

export function roomPath(roomId: string): string { return `rooms/${roomId}`; }

const hostedKey = 'g-card-hosted-rooms-v1';
function hostedRooms(): string[] {
  try { const value = JSON.parse(localStorage.getItem(hostedKey) || '[]'); return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []; }
  catch { return []; }
}

function rememberHosted(roomId: string): void {
  try { localStorage.setItem(hostedKey, JSON.stringify([...new Set([...hostedRooms(), roomId])].slice(-30))); }
  catch { /* 保存できない端末では期限切れ判定だけを行う */ }
}

async function cleanupHostedRooms(db: Database, uid: string): Promise<void> {
  const remaining: string[] = [];
  for (const roomId of hostedRooms()) {
    try {
      const room = (await get(ref(db, roomPath(roomId)))).val() as OnlineRoom | null;
      if (!room) continue;
      if (room.meta.hostUid !== uid || room.meta.expiresAt > Date.now()) { remaining.push(roomId); continue; }
      if (room.meta.code) await remove(ref(db, `codes/${room.meta.code}`)).catch(() => {});
      await remove(ref(db, roomPath(roomId)));
    } catch { remaining.push(roomId); }
  }
  try { localStorage.setItem(hostedKey, JSON.stringify(remaining)); } catch { /* 保存できない端末 */ }
}

export async function createRoom(db: Database, uid: string, nickname: string, maxLife: number, deckMode: DeckMode, code = '', guestUid = '', teacherTest = false): Promise<string> {
  const battleId = crypto.randomUUID();
  const createdAt = Date.now();
  const room: OnlineRoom = {
    meta: { battleId, deckMode, hostUid: uid, ...(guestUid ? { guestUid } : {}), ...(teacherTest ? { teacherTest: true } : {}), seed: crypto.getRandomValues(new Uint32Array(1))[0], code, createdAt, expiresAt: createdAt + 30 * 60_000 },
    players: { [uid]: { nickname, maxLife, connected: true, lastSeen: createdAt } },
  };
  await set(ref(db, roomPath(battleId)), room);
  rememberHosted(battleId);
  await onDisconnect(ref(db, `${roomPath(battleId)}/players/${uid}`)).update({ connected: false, lastSeen: serverTimestamp() });
  return battleId;
}

export async function createCodeRoom(db: Database, uid: string, nickname: string, maxLife: number, deckMode: DeckMode, teacherTest = false): Promise<{ roomId: string; code: string }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = String(1000 + crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
    const reservation = ref(db, `codes/${code}`);
    const current = await runTransaction(reservation, (value) => value && value.expiresAt > Date.now() ? undefined : { hostUid: uid, deckMode, expiresAt: Date.now() + 30 * 60_000 }, { applyLocally: false });
    if (!current.committed) continue;
    try {
      const roomId = await createRoom(db, uid, nickname, maxLife, deckMode, code, '', teacherTest);
      await update(reservation, { roomId });
      return { roomId, code };
    } catch (error) { await remove(reservation).catch(() => {}); throw error; }
  }
  throw new Error('空いているルームコードを作れませんでした。もう一度試してください。');
}

export async function joinCodeRoom(db: Database, uid: string, code: string, deckMode: DeckMode): Promise<string> {
  if (!/^\d{4}$/.test(code)) throw new Error('4桁のルームコードを入力してください。');
  const mapping = (await get(ref(db, `codes/${code}`))).val() as { roomId?: string; deckMode?: DeckMode; expiresAt?: number } | null;
  if (!mapping?.roomId || !mapping.expiresAt || mapping.expiresAt < Date.now()) throw new Error('このルームコードは利用できません。');
  const roomId = mapping.roomId;
  if (mapping.deckMode !== deckMode) throw new Error('カードセットの部門が異なります。');
  const transaction = await runTransaction(ref(db, `${roomPath(roomId)}/meta/guestUid`), (current) => current || uid, { applyLocally: false });
  if (!transaction.committed || transaction.snapshot.val() !== uid) throw new Error('この部屋は満員です。');
  return roomId;
}

export async function setPresence(db: Database, roomId: string, uid: string, nickname: string, maxLife: number): Promise<void> {
  const target = ref(db, `${roomPath(roomId)}/players/${uid}`);
  await onDisconnect(target).update({ connected: false, lastSeen: serverTimestamp() });
  await set(target, { nickname, maxLife, connected: true, lastSeen: serverTimestamp() });
}
