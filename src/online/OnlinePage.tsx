import { useEffect, useMemo, useRef, useState } from 'react';
import { onDisconnect, onValue, ref, remove, runTransaction, set, type Database } from 'firebase/database';
import { Card } from '../components/Card';
import { availableCards, defaultDeckIds, getCard, typeLabels } from '../data/cards';
import { callApi, savedSession, type BootstrapData } from '../portal/api';
import { connectFirebase, createCodeRoom, createRoom, disconnectFirebase, firebaseConfigured, joinCodeRoom, roomPath, setPresence } from './firebase';
import { deckCommit, deriveView, myResult, pickCommit, randomSalt, sha256, stateDigest, type DeckMode, type OnlineEntry, type OnlineRoom, type OnlineView } from './protocol';

type Reward = { status: string; result: string; awarded: number; gPoint: number; onlineRewards: number };
const roomFromHash = () => new URLSearchParams(window.location.hash.split('?')[1] || '').get('room') || '';

function RoundPresentation({ view, side, names, onClose }: { view: OnlineView; side: 0 | 1; names: [string, string]; onClose: () => void }) {
  const [stage, setStage] = useState<'title' | 'suspense' | 'backs' | 'fronts'>('title');
  useEffect(() => {
    if (stage === 'fronts' || stage === 'backs') return;
    const delay = stage === 'title' ? 1400 : 2200;
    const timer = window.setTimeout(() => setStage(stage === 'title' ? 'suspense' : 'backs'), delay);
    return () => window.clearTimeout(timer);
  }, [stage]);
  const cards = view.reveal!;
  return <div className="online-presentation panel">
    {stage === 'title' ? <><p className="eyebrow">ROUND START</p><h2>ラウンド {view.round}</h2><p>お互いのカードが決まりました</p></> : stage === 'suspense' ? <><div className="round-intro__versus">VS</div><p>勝負の行方は…</p></> : <><p className="eyebrow">ROUND {view.round} REVEAL</p><div className="online-reveal-grid">{cards.map((pick, index) => <div key={index}><span>{names[index]}</span><Card card={getCard(pick.card.cardId)} side={stage === 'backs' ? 'back' : 'front'} backType={view.types[index as 0 | 1][pick.index]} width={170} /></div>)}</div><h2>{view.winner === null ? 'あいこ' : view.winner === side ? 'このラウンドは勝ち' : 'このラウンドは負け'}</h2>{stage === 'backs' ? <button className="button button--primary" onClick={() => setStage('fronts')}>カードをめくる</button> : <><p>{view.events.join(' · ')}</p><button className="button button--primary" onClick={onClose}>{view.outcome !== null ? '結果を見る' : '次のラウンドへ'}</button></>}</>}
  </div>;
}

export function OnlinePage() {
  const session = savedSession();
  const [account, setAccount] = useState<BootstrapData | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [uid, setUid] = useState('');
  const [roomId, setRoomId] = useState(roomFromHash);
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [view, setView] = useState<OnlineView | null>(null);
  const [deckMode, setDeckMode] = useState<DeckMode>('sample');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<string[]>(defaultDeckIds);
  const [entries, setEntries] = useState<OnlineEntry[] | null>(null);
  const [salt, setSalt] = useState('');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reward, setReward] = useState<Reward | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [presentation, setPresentation] = useState<OnlineView | null>(null);
  const [seenRound, setSeenRound] = useState(0);
  const queueCleanup = useRef<(() => void) | null>(null);
  const actionKey = useRef(new Set<string>());
  const entered = useRef(false);
  const currentRoom = useRef(roomId);
  const phaseClock = useRef({ key: '', since: Date.now() });
  const rewardStatus = useRef('');
  rewardStatus.current = reward?.status || '';
  const mySide: 0 | 1 = room?.meta.hostUid === uid ? 0 : 1;
  const opponentUid = room ? mySide === 0 ? room.meta.guestUid || '' : room.meta.hostUid : '';
  const opponent = room?.players?.[opponentUid];
  const onlineAvailable = Boolean(account?.online?.enabled || account?.profile.role === 'admin');

  const enterRoom = (id: string) => {
    if (currentRoom.current === id) return;
    currentRoom.current = id; setRoomId(id); setRoom(null); setView(null); setEntries(null); setSalt(''); setJoined(false); setBusy(false); setReward(null); setPresentation(null); setSeenRound(0); entered.current = false; actionKey.current.clear();
    window.history.replaceState(null, '', `#/online?room=${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    if (!session || !firebaseConfigured) return;
    let active = true;
    Promise.all([callApi<BootstrapData>('bootstrap', session), connectFirebase()]).then(([profile, connection]) => {
      if (!active) return;
      setAccount(profile); setDb(connection.db); setUid(connection.uid);
      if (!roomId) return;
      const saved = sessionStorage.getItem(`g-card-online:${roomId}`);
      if (saved) try { const parsed = JSON.parse(saved) as { entries: OnlineEntry[]; salt: string; mode: DeckMode }; setEntries(parsed.entries); setSalt(parsed.salt); setDeckMode(parsed.mode); } catch { /* 再接続時に入力し直す */ }
    }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; queueCleanup.current?.(); disconnectFirebase(); };
  }, [session]);

  useEffect(() => {
    if (!db || !uid || !roomId) return;
    let active = true;
    const unsubscribe = onValue(ref(db, roomPath(roomId)), (snapshot) => {
      if (!active) return;
      const next = snapshot.val() as OnlineRoom | null;
      if (!next) { if (!['complete', 'invalid'].includes(rewardStatus.current)) { setError('部屋が終了しました。'); setRoom(null); } return; }
      setRoom(next);
      void deriveView(next).then((derived) => { if (active) setView(derived); }).catch(() => { if (active) setError('対戦データを確認できません。'); });
    }, (failure) => { if (active) setError(`部屋に接続できません：${failure.message}`); });
    return () => { active = false; unsubscribe(); };
  }, [db, uid, roomId]);

  useEffect(() => {
    if (!db || !uid || !room || !session || !account || joined || !room.meta.guestUid) return;
    if (room.meta.hostUid !== uid && room.meta.guestUid !== uid) { setError('この部屋には参加できません。'); return; }
    if (entered.current) return;
    entered.current = true;
    void (async () => {
      try {
        const maxLife = room.meta.deckMode === 'owned' ? account.profile.maxLife : account.battleConfig.find((item) => item.deckId === 'sample')?.maxLife ?? 100;
        await setPresence(db, roomId, uid, account.profile.nickname, maxLife);
        await callApi('onlineJoin', session, { battleId: roomId, uid, deckMode: room.meta.deckMode });
        setDeckMode(room.meta.deckMode); setJoined(true);
      } catch (failure) { entered.current = false; setError((failure as Error).message); }
    })();
  }, [db, uid, room, session, account, joined, roomId]);

  const takeAction = (key: string, task: () => Promise<unknown>) => {
    if (actionKey.current.has(key)) return;
    actionKey.current.add(key);
    void task().catch((failure: Error) => { actionKey.current.delete(key); setError(failure.message); });
  };

  useEffect(() => {
    if (!db || !uid || !room || !view || !entries || !salt || !joined) return;
    const path = roomPath(roomId);
    const record = room.rounds?.[String(view.round)];
    if (view.phase === 'reveal' && record?.commit?.[uid] && !record.reveal?.[uid]) {
      const stored = sessionStorage.getItem(`g-card-pick:${roomId}:${view.round}`);
      if (stored) takeAction(`reveal-${view.round}`, async () => {
        const pick = JSON.parse(stored) as { index: number; salt: string };
        await set(ref(db, `${path}/rounds/${view.round}/reveal/${uid}`), { ...pick, card: { cardId: entries[pick.index].cardId, trainLevel: entries[pick.index].trainLevel } });
      });
    }
    if (view.phase === 'verify' && !record?.stateHash?.[uid]) takeAction(`hash-${view.round}`, async () => {
      await set(ref(db, `${path}/rounds/${view.round}/stateHash/${uid}`), await stateDigest(view));
    });
    if (view.phase === 'final' && !room.final?.[uid]) takeAction('final', () => set(ref(db, `${path}/final/${uid}`), { entries, salt }));
    if ((view.phase === 'finished' || view.phase === 'invalid') && session && !reward) takeAction('report', async () => {
      const result = view.phase === 'invalid' ? 'draw' : myResult(view, mySide);
      const stateHash = view.phase === 'invalid' ? await sha256(`invalid:${roomId}:${view.error}`) : await stateDigest(view);
      const response = await callApi<Reward>('onlineReport', session, { battleId: roomId, result, stateHash, suspicious: view.phase === 'invalid', deck: entries });
      setReward(response);
    });
  }, [db, uid, room, view, entries, salt, joined, session, roomId, reward, mySide]);

  useEffect(() => {
    if (!session || !roomId || !reward || reward.status === 'complete' || reward.status === 'invalid') return;
    const timer = window.setInterval(() => { void callApi<Reward>('onlineResult', session, { battleId: roomId }).then(setReward).catch(() => {}); }, 3000);
    return () => window.clearInterval(timer);
  }, [session, roomId, reward?.status]);

  useEffect(() => {
    if (!db || !room || !uid || !reward || !['complete', 'invalid'].includes(reward.status)) return;
    if (!room.receipts?.[uid]) takeAction('receipt', () => set(ref(db, `${roomPath(roomId)}/receipts/${uid}`), true));
    if (room.meta.hostUid === uid && room.meta.guestUid && room.receipts?.[uid] && room.receipts?.[room.meta.guestUid]) {
      takeAction('cleanup', async () => {
        if (room.meta.code) await remove(ref(db, `codes/${room.meta.code}`));
        await remove(ref(db, roomPath(roomId)));
      });
    }
  }, [db, room, uid, reward, roomId]);

  useEffect(() => { const timer = window.setInterval(() => setElapsed(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (view?.phase === 'verify' && view.reveal && view.round > seenRound && !presentation) setPresentation(view);
  }, [view, seenRound, presentation]);

  const pool = useMemo(() => {
    if (!account) return [];
    return deckMode === 'owned' ? account.ownedCards.filter((item) => availableCards.some((card) => card.cardId === item.cardId)).map((item) => ({ id: item.ownedId, cardId: item.cardId, trainLevel: item.trainLevel })) :
      account.battleConfig.find((item) => item.deckId === 'sample')?.cardIds.filter((id) => availableCards.some((card) => card.cardId === id)).map((cardId) => ({ id: cardId, cardId, trainLevel: 0 })) || [];
  }, [account, deckMode]);
  const selectedValid = selected.filter((id) => pool.some((item) => item.id === id));
  const chooseMode = (next: DeckMode) => { setDeckMode(next); setSelected(next === 'sample' ? defaultDeckIds : account?.ownedCards.slice(0, 4).map((item) => item.ownedId) || []); };
  const maxLife = deckMode === 'owned' ? account?.profile.maxLife || 100 : account?.battleConfig.find((item) => item.deckId === 'sample')?.maxLife || 100;

  const startCode = async () => {
    if (!db || !uid || !account || busy) return;
    setBusy(true); setError('');
    try { const created = await createCodeRoom(db, uid, account.profile.nickname, maxLife, deckMode); enterRoom(created.roomId); setCode(created.code); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const joinCode = async () => {
    if (!db || !uid || busy) return;
    setBusy(true); setError('');
    try { enterRoom(await joinCodeRoom(db, uid, code.trim(), deckMode)); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const startRandom = async () => {
    if (!db || !uid || !account || busy) return;
    setBusy(true); setError('');
    const queueRef = ref(db, `queue/${deckMode}/${uid}`);
    const allRef = ref(db, `queue/${deckMode}`);
    let waitingFor = '';
    let creating = false;
    try {
      await onDisconnect(queueRef).remove();
      await set(queueRef, { nickname: account.profile.nickname, maxLife, joinedAt: Date.now() });
      const unsubscribe = onValue(allRef, (snapshot) => {
        const all = snapshot.val() as Record<string, { joinedAt: number; claim?: string; roomId?: string }> | null;
        if (!all || currentRoom.current) return;
        if (waitingFor) {
          if (all[waitingFor]?.roomId) enterRoom(all[waitingFor].roomId!);
          return;
        }
        if (all[uid]?.claim && !creating) {
          creating = true;
          void createRoom(db, uid, account.profile.nickname, maxLife, deckMode, '', all[uid].claim).then(async (id) => {
            await set(ref(db, `queue/${deckMode}/${uid}/roomId`), id);
            enterRoom(id);
          }).catch((failure: Error) => { creating = false; setError(failure.message); });
          return;
        }
        const ownJoinedAt = all[uid]?.joinedAt || Date.now();
        const candidate = Object.entries(all).filter(([otherUid, item]) => otherUid !== uid && !item.claim && item.joinedAt > Date.now() - 90_000 && (item.joinedAt < ownJoinedAt || item.joinedAt === ownJoinedAt && otherUid < uid)).sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0];
        if (candidate) void runTransaction(ref(db, `queue/${deckMode}/${candidate[0]}/claim`), (value) => value || uid, { applyLocally: false }).then((claim) => {
          if (claim.committed && claim.snapshot.val() === uid) waitingFor = candidate[0];
        }).catch((failure: Error) => setError(failure.message));
      }, (failure) => setError(failure.message));
      queueCleanup.current = () => { unsubscribe(); void remove(queueRef).catch(() => {}); };
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  };

  const submitDeck = async () => {
    if (!db || !uid || !room || selectedValid.length !== 4 || !joined || busy) return;
    setBusy(true); setError('');
    try {
      const deck = selectedValid.map((id) => { const item = pool.find((candidate) => candidate.id === id)!; return { cardId: item.cardId, ...(deckMode === 'owned' ? { ownedId: id } : {}), trainLevel: item.trainLevel }; });
      const nextSalt = randomSalt();
      sessionStorage.setItem(`g-card-online:${roomId}`, JSON.stringify({ entries: deck, salt: nextSalt, mode: deckMode }));
      await set(ref(db, `${roomPath(roomId)}/decks/${uid}`), { types: deck.map((item) => getCard(item.cardId).type), commit: await deckCommit(deck, nextSalt) });
      setEntries(deck); setSalt(nextSalt);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const selectPick = async (index: number) => {
    if (!db || !room || !view || !entries || busy) return;
    setBusy(true); setError('');
    try {
      const nextSalt = randomSalt();
      sessionStorage.setItem(`g-card-pick:${roomId}:${view.round}`, JSON.stringify({ index, salt: nextSalt }));
      await set(ref(db, `${roomPath(roomId)}/rounds/${view.round}/commit/${uid}`), await pickCommit(roomId, view.round, index, nextSalt));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const chooseTarget = async (index: number) => {
    if (!db || !view || busy) return;
    setBusy(true);
    try { await set(ref(db, `${roomPath(roomId)}/rounds/${view.round}/choices/${uid}`), index); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!room || !view || !joined || !entries && view.phase !== 'deck' || presentation) return;
    const key = `${roomId}:${view.round}:${view.phase}`;
    if (phaseClock.current.key !== key) phaseClock.current = { key, since: Date.now() };
    const seconds = (elapsed - phaseClock.current.since) / 1000;
    if (view.phase === 'deck' && !room.decks?.[uid] && seconds >= 90) {
      if (selectedValid.length === 4) takeAction('deck-timeout', submitDeck);
      else if (pool.length >= 4) setSelected(pool.slice(0, 4).map((item) => item.id));
    }
    if (view.phase === 'select' && !room.rounds?.[String(view.round)]?.commit?.[uid] && seconds >= 30) {
      const remaining = [0, 1, 2, 3].filter((index) => !view.used[mySide].includes(index));
      if (remaining.length) takeAction(`pick-timeout-${view.round}`, () => selectPick(remaining[(room.meta.seed + view.round + mySide) % remaining.length]));
    }
    if (view.phase === 'target' && view.targetOwner === mySide && seconds >= 20) {
      const other: 0 | 1 = mySide === 0 ? 1 : 0;
      const remaining = [0, 1, 2, 3].filter((index) => !view.used[other].includes(index));
      if (remaining.length) takeAction(`target-timeout-${view.round}`, () => chooseTarget(remaining[(room.meta.seed + view.round) % remaining.length]));
    }
  }, [elapsed, view, room, joined, entries, roomId, uid, selectedValid, pool, mySide, presentation]);

  const leave = () => {
    queueCleanup.current?.(); queueCleanup.current = null;
    currentRoom.current = ''; setRoomId(''); setRoom(null); setView(null); setReward(null); setJoined(false); setPresentation(null); setSeenRound(0); entered.current = false;
    window.history.replaceState(null, '', '#/online');
  };

  const opponentOffline = opponent?.connected === false && elapsed - Number(opponent.lastSeen || 0) >= 30_000;
  const revealReady = true;
  if (presentation) return <main className="app-shell online-shell"><header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>オンライン対戦</strong></header><section className="online-panel"><RoundPresentation key={presentation.round} view={presentation} side={mySide} names={[room?.players?.[room.meta.hostUid]?.nickname || 'プレイヤー1', opponent?.nickname || 'プレイヤー2']} onClose={() => { setSeenRound(presentation.round); setPresentation(null); }} /></section></main>;
  return <main className="app-shell online-shell"><header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>オンライン対戦</strong><a href="#/ranking" className="text-link">ランキング</a></header>
    <section className="panel online-panel"><p className="eyebrow">ONLINE BATTLE</p><h1>友達とカードで対戦</h1>
      {!session ? <p>学校アカウントでログインしてください。<a href="#/home">ホームへ戻る</a></p> : !firebaseConfigured ? <p>先生によるFirebaseの接続設定を待っています。</p> : !account || !db ? <p role="status">対戦に接続中…</p> : !onlineAvailable ? <p>オンライン対戦は先生が公開すると使えます。</p> : !roomId ? <><p>自分のカードかサンプルカードを選び、同じ部門の相手と対戦します。</p><div className="online-mode"><button className="button button--ghost" aria-pressed={deckMode === 'sample'} onClick={() => chooseMode('sample')}>サンプルカード</button><button className="button button--ghost" aria-pressed={deckMode === 'owned'} disabled={account.ownedCards.length < 4} onClick={() => chooseMode('owned')}>自分のカード</button></div><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => { void startRandom(); }}>{busy ? '相手を探しています…' : 'ランダムマッチ'}</button><button className="button button--ghost" disabled={busy} onClick={() => { void startCode(); }}>部屋を作る</button></div><label>友達の4桁コード<input inputMode="numeric" maxLength={4} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label><button className="button button--ghost" disabled={busy || code.length !== 4} onClick={() => { void joinCode(); }}>コードで参加</button></> : !room ? <p role="status">部屋を読み込み中…</p> : <><p>部門：{room.meta.deckMode === 'owned' ? '自分のカード' : 'サンプルカード'}{room.meta.code ? ` · ルームコード ${room.meta.code}` : ''}</p><p>{room.players?.[room.meta.hostUid]?.nickname || 'プレイヤー1'} VS {opponent?.nickname || '相手を待っています…'}</p>
        {!room.meta.guestUid ? <p role="status">相手を待っています。コードを友達に伝えてください。</p> : !joined ? <p role="status">学校アカウントの参加を確認中…</p> : opponentOffline && view?.phase !== 'finished' && view?.phase !== 'invalid' ? <div role="alert"><h2>相手の接続が切れました</h2><p>30秒以上戻らなかったため、この対戦は不戦勝です。報酬は両者の結果を照合できた場合に確定します。</p></div> : view?.phase === 'deck' ? <><h2>カードを4枚選ぶ</h2><p>制限時間90秒。相手には種類だけが見え、カード名はラウンドまで隠れます。</p>{room.decks?.[uid] ? <p role="status">相手の準備を待っています…</p> : <><div className="online-deck-grid">{pool.map((item) => <button key={item.id} className={selectedValid.includes(item.id) ? 'is-selected' : ''} aria-pressed={selectedValid.includes(item.id)} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 4 ? [...current, item.id] : current)}><Card card={getCard(item.cardId)} width={110} /><strong>{getCard(item.cardId).name}</strong></button>)}</div><button className="button button--primary" disabled={busy || selectedValid.length !== 4} onClick={() => { void submitDeck(); }}>この4枚で決定</button></>}</> : !view ? <p>対戦を読み込み中…</p> : view.phase === 'invalid' ? <div role="alert"><h2>無効試合</h2><p>{view.error}</p></div> : view.phase === 'finished' ? <><h2>{myResult(view, mySide) === 'win' ? '勝利！' : myResult(view, mySide) === 'draw' ? '引き分け' : '敗北'}</h2><p>ライフ {view.life[mySide]} 対 {view.life[mySide === 0 ? 1 : 0]}</p><p role="status">{reward?.status === 'complete' ? `報酬 +${reward.awarded}G · 所持 ${reward.gPoint}G` : reward?.status === 'invalid' ? '対戦結果を確認できなかったため報酬はありません。' : '両者の結果と報酬を照合中…'}</p></> : <><h2>ラウンド {view.round}</h2><div className="online-life"><strong>あなた {view.life[mySide]} / {view.maxLife[mySide]}</strong><strong>{opponent?.nickname || '相手'} {view.life[mySide === 0 ? 1 : 0]} / {view.maxLife[mySide === 0 ? 1 : 0]}</strong></div><p>相手の残りカード：{view.types[mySide === 0 ? 1 : 0].map((type, index) => view.used[mySide === 0 ? 1 : 0].includes(index) ? null : <span className="online-back" key={index}>{typeLabels[type]}</span>)}</p>
          {view.phase === 'select' ? room.rounds?.[String(view.round)]?.commit?.[uid] ? <p role="status">相手のカード決定を待っています…</p> : <><p>30秒以内にカードを選んでください。</p><div className="online-deck-grid">{entries?.map((entry, index) => view.used[mySide].includes(index) ? null : <button key={index} onClick={() => { void selectPick(index); }}><Card card={getCard(entry.cardId)} width={110} /><strong>{getCard(entry.cardId).name}</strong></button>)}</div></> : view.phase === 'reveal' ? <div className="round-intro panel"><div className="round-intro__versus">VS</div><p>お互いのカードを公開中…</p></div> : view.phase === 'target' && view.targetOwner === mySide ? <><p>手品で変える相手の残りカードを選んでください（20秒）。</p><div className="online-targets">{view.types[mySide === 0 ? 1 : 0].map((type, index) => view.used[mySide === 0 ? 1 : 0].includes(index) ? null : <button key={index} onClick={() => { void chooseTarget(index); }}>{typeLabels[type]} · {index + 1}番</button>)}</div></> : view.phase === 'target' ? <p role="status">相手が手品の対象を選んでいます…</p> : view.phase === 'verify' && view.reveal ? <>{!revealReady ? <div className="round-intro panel"><div className="round-intro__versus">VS</div><p>勝負の行方は…</p></div> : <><p>{view.winner === null ? 'あいこ' : view.winner === mySide ? 'このラウンドは勝ち！' : 'このラウンドは負け'}</p><div className="online-reveal-grid">{view.reveal.map((pick, side) => <div key={side}><span>{side === mySide ? 'あなた' : opponent?.nickname || '相手'}</span><Card card={getCard(pick.card.cardId)} width={170} /></div>)}</div><p>{view.events.join(' · ')}</p></>}<p role="status">次のラウンドを同期中…</p></> : <p role="status">デッキの最終確認中…</p>}</>}
        <div className="button-row"><button className="button button--ghost" onClick={leave}>対戦から戻る</button></div></>}
      {busy && !roomId && queueCleanup.current && <button className="button button--ghost" onClick={() => { queueCleanup.current?.(); queueCleanup.current = null; setBusy(false); }}>待機をやめる</button>}
      {error && <p role="alert" className="portal-error">{error}</p>}
    </section><footer className="app-footer">Gカード · オンライン対戦</footer></main>;
}
