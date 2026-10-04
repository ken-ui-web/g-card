import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { onValue, ref, remove, serverTimestamp, set, type Database } from 'firebase/database';
import { Card } from '../components/Card';
import { SoundToggle } from '../components/SoundToggle';
import { playSfx } from '../audio/sfx';
import { availableCards, defaultDeckIds, getCard, typeLabels } from '../data/cards';
import { callApi, savedSession, type BootstrapData } from '../portal/api';
import { connectFirebase, createCodeRoom, disconnectFirebase, firebaseConfigured, heartbeat, joinCodeRoom, roomPath, setPresence } from './firebase';
import { HEARTBEAT_INTERVAL_MS, opponentTimedOut, phaseSeconds, type PhaseClock } from './presence';
import { deckCommit, deriveView, myResult, pickCommit, randomSalt, sha256, stateDigest, type DeckMode, type OnlineEntry, type OnlineRoom, type OnlineView, type RoundPick } from './protocol';

type Reward = { status: string; result: string; awarded: number; gPoint: number; onlineRewards: number };
const roomFromHash = () => new URLSearchParams(window.location.hash.split('?')[1] || '').get('room') || '';
const battleBackgroundStyle = { '--battle-bg': `url("${import.meta.env.BASE_URL}images/bg/battle.webp")` } as CSSProperties;

function onlineCardDamage(pick: RoundPick): number | null {
  const card = getCard(pick.card.cardId);
  const damage = card.effects.find((effect) => effect.type === 'damage');
  return damage?.type === 'damage' ? damage.amount + (card.type === 'rock' ? pick.card.trainLevel * card.trainingMultiplier : 0) : null;
}

function RoundPresentation({ view, side, names, onClose }: { view: OnlineView; side: 0 | 1; names: [string, string]; onClose: () => void }) {
  const [stage, setStage] = useState<'title' | 'suspense' | 'backs' | 'flipping' | 'fronts'>('title');
  const [canFlip, setCanFlip] = useState(false);
  useEffect(() => {
    if (stage === 'fronts' || stage === 'backs' || stage === 'flipping') return;
    const delay = stage === 'title' ? 1400 : 2200;
    const timer = window.setTimeout(() => setStage(stage === 'title' ? 'suspense' : 'backs'), delay);
    return () => window.clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (stage !== 'backs') return;
    const timer = window.setTimeout(() => setCanFlip(true), 2600);
    return () => window.clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (stage !== 'flipping') return;
    const timer = window.setTimeout(() => setStage('fronts'), 850);
    return () => window.clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (stage === 'title') playSfx('round');
    if (stage === 'fronts' && view.winner !== null) playSfx(view.events.some((event) => event.includes('回復')) ? 'heal' : view.winner === side ? 'win' : 'damage');
  }, [stage, view.events, view.winner, side]);
  const cards = view.reveal!;
  return <div className="online-presentation panel">
    {stage === 'title' ? <><p className="eyebrow">ROUND START</p><h2>ラウンド {view.round}</h2><p>お互いのカードが決まりました</p></> : stage === 'suspense' ? <><div className="round-intro__versus">VS</div><p>勝負の行方は…</p></> : <>
      <p className="eyebrow">ROUND {view.round} REVEAL</p>
      {stage === 'backs' && <p className="online-reveal-types" role="status">{typeLabels[view.types[0][cards[0].index]]} <span>VS</span> {typeLabels[view.types[1][cards[1].index]]}</p>}
      <div className="online-reveal-grid">{cards.map((pick, index) => <div key={index}><span>{names[index]}</span>
        <div className={`flip-card online-flip-card${stage === 'flipping' || stage === 'fronts' ? ' is-flipped' : ''}`}><div className="flip-card__inner">
          <div className="flip-card__face flip-card__face--back" aria-hidden={stage === 'fronts'}><Card card={getCard(pick.card.cardId)} side="back" backType={view.types[index as 0 | 1][pick.index]} /></div>
          <div className="flip-card__face flip-card__face--front" aria-hidden={stage !== 'fronts'}><Card card={getCard(pick.card.cardId)} damage={onlineCardDamage(pick)} /></div>
        </div></div>
        {stage === 'backs' && <strong className="reveal-entry__type">{typeLabels[view.types[index as 0 | 1][pick.index]]}{view.winner === index ? ' · 勝ち' : view.winner === null ? ' · あいこ' : ' · 負け'}</strong>}
      </div>)}</div>
      <h2>{view.winner === null ? 'あいこ' : view.winner === side ? 'このラウンドは勝ち' : 'このラウンドは負け'}</h2>
      {stage === 'backs' ? <><p className="reveal-hint">種類と勝敗を見たら、カードをめくろう。</p><button className="button button--primary" disabled={!canFlip} onClick={() => { playSfx('flip'); setStage('flipping'); }}>{canFlip ? 'カードをめくる' : '勝敗を見てね…'}</button></> : stage === 'flipping' ? <p role="status">カードをめくっています…</p> : <><p>{view.events.join(' · ')}</p><button className="button button--primary" onClick={onClose}>{view.outcome !== null ? '結果を見る' : '次のラウンドへ'}</button></>}
    </>}
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
  const [elapsed, setElapsed] = useState(() => Date.now());
  const [localConnected, setLocalConnected] = useState(false);
  const [presentation, setPresentation] = useState<OnlineView | null>(null);
  const [seenRound, setSeenRound] = useState(0);
  const actionKey = useRef(new Set<string>());
  const entered = useRef(false);
  const currentRoom = useRef(roomId);
  const phaseClock = useRef<PhaseClock>({ key: '', since: Date.now(), pausedAt: null });
  const rewardStatus = useRef('');
  const pointSoundPlayed = useRef(false);
  const viewPhase = useRef('');
  const forfeitAttempt = useRef({ pending: false, retryAt: 0 });
  rewardStatus.current = reward?.status || '';
  viewPhase.current = view?.phase || '';
  const mySide: 0 | 1 = room?.meta.hostUid === uid ? 0 : 1;
  const opponentUid = room ? mySide === 0 ? room.meta.guestUid || '' : room.meta.hostUid : '';
  const opponent = room?.players?.[opponentUid];
  const opponentOffline = localConnected && opponentTimedOut(opponent?.lastSeen, elapsed);
  const opponentAway = opponent?.connected === false || Boolean(opponent?.lastSeen && elapsed - opponent.lastSeen >= 10_000);
  const onlineAvailable = Boolean(account?.online?.enabled || account?.profile.role === 'admin');
  const teacherTestMode = Boolean(account?.profile.role === 'admin' && !account.online?.enabled);

  const enterRoom = (id: string) => {
    if (currentRoom.current === id) return;
    currentRoom.current = id; setRoomId(id); setRoom(null); setView(null); setEntries(null); setSalt(''); setJoined(false); setBusy(false); setReward(null); setPresentation(null); setSeenRound(0); entered.current = false; actionKey.current.clear(); pointSoundPlayed.current = false; forfeitAttempt.current = { pending: false, retryAt: 0 };
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
    return () => { active = false; disconnectFirebase(); };
  }, [session]);

  useEffect(() => {
    if (!db || !uid || !roomId) return;
    let active = true;
    let revision = 0;
    const unsubscribe = onValue(ref(db, roomPath(roomId)), (snapshot) => {
      if (!active) return;
      const currentRevision = ++revision;
      const next = snapshot.val() as OnlineRoom | null;
      if (!next) { if (!['complete', 'invalid'].includes(rewardStatus.current) && viewPhase.current !== 'forfeit') { setError('部屋が終了しました。'); setRoom(null); } return; }
      setRoom(next);
      void deriveView(next).then((derived) => { if (active && revision === currentRevision) setView(derived); }).catch(() => { if (active && revision === currentRevision) setError('対戦データを確認できません。'); });
    }, (failure) => {
      if (active && !['complete', 'invalid'].includes(rewardStatus.current) && viewPhase.current !== 'forfeit') {
        setError(`部屋に接続できません：${failure.message}`);
      }
    });
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
        if (room.meta.teacherTest && account.profile.role !== 'admin') throw new Error('この部屋は管理者のテスト用です。');
        await setPresence(db, roomId, uid, room.meta.teacherTest ? uid === room.meta.hostUid ? '先生A' : '先生B' : account.profile.nickname, maxLife);
        if (!room.meta.teacherTest) await callApi('onlineJoin', session, { battleId: roomId, uid, deckMode: room.meta.deckMode });
        setDeckMode(room.meta.deckMode); setJoined(true);
      } catch (failure) { entered.current = false; setError((failure as Error).message); }
    })();
  }, [db, uid, room, session, account, joined, roomId]);

  useEffect(() => {
    if (!db || !uid || !room || !roomId || !joined || !account) return;
    let active = true;
    let seenConnection = false;
    const unsubscribe = onValue(ref(db, '.info/connected'), (snapshot) => {
      const connected = snapshot.val() === true;
      setLocalConnected(connected);
      if (!seenConnection) { seenConnection = true; return; }
      if (!connected) return;
      const maxLife = room.meta.deckMode === 'owned' ? account.profile.maxLife : account.battleConfig.find((item) => item.deckId === 'sample')?.maxLife ?? 100;
      const nickname = room.meta.teacherTest ? uid === room.meta.hostUid ? '先生A' : '先生B' : account.profile.nickname;
      void setPresence(db, roomId, uid, nickname, maxLife).catch((failure: Error) => {
        if (active) setError(`再接続できません：${failure.message}`);
      });
    });
    return () => { active = false; unsubscribe(); };
  }, [db, uid, roomId, joined, room?.meta.battleId, room?.meta.deckMode, room?.meta.hostUid, room?.meta.teacherTest, account]);

  useEffect(() => {
    if (!db || !uid || !roomId || !joined || !localConnected || ['forfeit', 'finished', 'invalid'].includes(view?.phase || '')) return;
    const timer = window.setInterval(() => {
      void heartbeat(db, roomId, uid).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [db, uid, roomId, joined, localConnected, view?.phase]);

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
      if (room.meta.teacherTest) {
        setReward({ status: view.phase === 'invalid' ? 'invalid' : 'complete', result, awarded: 0, gPoint: account?.profile.gPoint ?? 0, onlineRewards: 0 });
        return;
      }
      const stateHash = view.phase === 'invalid' ? await sha256(`invalid:${roomId}:${view.error}`) : await stateDigest(view);
      const response = await callApi<Reward>('onlineReport', session, { battleId: roomId, result, stateHash, suspicious: view.phase === 'invalid', deck: entries });
      setReward(response);
    });
  }, [db, uid, room, view, entries, salt, joined, session, roomId, reward, mySide, account]);

  useEffect(() => {
    if (!db || !uid || !roomId || !room?.meta.guestUid || !joined || !opponentUid || !opponentOffline || room.forfeit || !view || view.outcome !== null || view.phase === 'invalid') return;
    const attempt = forfeitAttempt.current;
    if (attempt.pending || elapsed < attempt.retryAt) return;
    attempt.pending = true;
    void set(ref(db, `${roomPath(roomId)}/forfeit`), { winnerUid: uid, loserUid: opponentUid, at: serverTimestamp() })
      .catch(() => { attempt.retryAt = Date.now() + 3000; })
      .finally(() => { attempt.pending = false; });
  }, [db, uid, roomId, room, joined, opponentUid, opponentOffline, view, elapsed]);

  useEffect(() => {
    if (!session || !roomId || !reward || room?.meta.teacherTest || reward.status === 'complete' || reward.status === 'invalid') return;
    const timer = window.setInterval(() => { void callApi<Reward>('onlineResult', session, { battleId: roomId }).then(setReward).catch(() => {}); }, 3000);
    return () => window.clearInterval(timer);
  }, [session, roomId, reward?.status, room?.meta.teacherTest]);

  useEffect(() => {
    if (reward?.status === 'complete' && reward.awarded > 0 && !pointSoundPlayed.current) {
      pointSoundPlayed.current = true;
      playSfx('point');
    }
  }, [reward]);

  useEffect(() => {
    if (!db || !room || !uid || (view?.phase !== 'forfeit' && (!reward || !['complete', 'invalid'].includes(reward.status)))) return;
    if (!room.receipts?.[uid]) takeAction('receipt', () => set(ref(db, `${roomPath(roomId)}/receipts/${uid}`), true));
    if (room.meta.hostUid === uid && room.meta.guestUid && room.receipts?.[uid] && room.receipts?.[room.meta.guestUid]) {
      takeAction('cleanup', async () => {
        if (room.meta.code) await remove(ref(db, `codes/${room.meta.code}`));
        await remove(ref(db, roomPath(roomId)));
      });
    }
  }, [db, room, uid, reward, roomId, view?.phase]);

  useEffect(() => { const timer = window.setInterval(() => setElapsed(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (view?.phase === 'forfeit') setPresentation(null); }, [view?.phase]);
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
    try { const created = await createCodeRoom(db, uid, teacherTestMode ? '先生A' : account.profile.nickname, maxLife, deckMode, teacherTestMode); enterRoom(created.roomId); setCode(created.code); }
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
  const submitDeck = async () => {
    if (!db || !uid || !room || selectedValid.length !== 4 || !joined || !localConnected || busy) return;
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
    if (!db || !room || !view || !entries || !localConnected || busy) return;
    playSfx('select');
    setBusy(true); setError('');
    try {
      const nextSalt = randomSalt();
      sessionStorage.setItem(`g-card-pick:${roomId}:${view.round}`, JSON.stringify({ index, salt: nextSalt }));
      await set(ref(db, `${roomPath(roomId)}/rounds/${view.round}/commit/${uid}`), await pickCommit(roomId, view.round, index, nextSalt));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const chooseTarget = async (index: number) => {
    if (!db || !view || !localConnected || busy) return;
    playSfx('select');
    setBusy(true);
    try { await set(ref(db, `${roomPath(roomId)}/rounds/${view.round}/choices/${uid}`), index); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!room || !view || !joined || !entries && view.phase !== 'deck' || presentation) return;
    const key = `${roomId}:${view.round}:${view.phase}`;
    const seconds = phaseSeconds(phaseClock.current, key, elapsed, !localConnected || opponentAway);
    if (!localConnected || opponentAway) return;
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
  }, [elapsed, view, room, joined, entries, roomId, uid, selectedValid, pool, mySide, presentation, localConnected, opponentAway]);

  const leave = () => {
    currentRoom.current = ''; setRoomId(''); setRoom(null); setView(null); setReward(null); setJoined(false); setPresentation(null); setSeenRound(0); entered.current = false; forfeitAttempt.current = { pending: false, retryAt: 0 };
    window.history.replaceState(null, '', '#/online');
  };

  const revealReady = true;
  if (presentation) return <main className="app-shell online-shell app-shell--battle" style={battleBackgroundStyle}><header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>オンライン対戦</strong><SoundToggle /></header><section className="online-panel">{room?.meta.teacherTest && <p role="status">管理者テスト対戦 · Gポイントは増減しません</p>}<RoundPresentation key={presentation.round} view={presentation} side={mySide} names={[room?.players?.[room.meta.hostUid]?.nickname || 'プレイヤー1', room?.players?.[room.meta.guestUid || '']?.nickname || 'プレイヤー2']} onClose={() => { setSeenRound(presentation.round); setPresentation(null); }} /></section></main>;
  return <main className={`app-shell online-shell${roomId ? ' app-shell--battle' : ''}`} style={roomId ? battleBackgroundStyle : undefined}><header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>オンライン対戦</strong><div className="online-header-actions"><SoundToggle /><a href="#/ranking" className="text-link">ランキング</a></div></header>
    <section className="panel online-panel"><p className="eyebrow">ONLINE BATTLE</p><h1>友達とカードで対戦</h1>
      {teacherTestMode && !roomId && <p role="status">管理者テストモードです。同じ学校アカウントを別端末でも開いて対戦できます。Gポイントは増減しません。</p>}
      {account?.profile.role === 'admin' && account.online?.enabled && !roomId && <p role="alert">オンライン対戦を生徒に公開中です。同じ学校アカウントで試す場合は、管理者設定の「オンライン対戦を受付」を0にして再読み込みしてください。</p>}
      {room?.meta.teacherTest && <p role="status">管理者テスト対戦 · Gポイントは増減しません</p>}
      {room && !room.meta.teacherTest && account?.profile.role === 'admin' && <p role="status">通常対戦の部屋です。同じ学校アカウント同士では参加できません。</p>}
      {room && joined && !localConnected && view?.outcome === null && <p role="status">通信が切れています。再接続を待っています。制限時間は一時停止中です。</p>}
      {room && joined && localConnected && opponentAway && !opponentOffline && view?.outcome === null && <p role="status">相手との通信を確認中です。制限時間は一時停止中です。</p>}
      {!session ? <p>学校アカウントでログインしてください。<a href="#/home">ホームへ戻る</a></p> : !firebaseConfigured ? <p>先生によるFirebaseの接続設定を待っています。</p> : !account || !db ? <p role="status">対戦に接続中…</p> : !onlineAvailable ? <p>オンライン対戦は先生が公開すると使えます。</p> : !roomId ? <><p>自分のカードかサンプルカードを選び、同じ部門の相手と対戦します。</p><div className="online-mode"><button className="button button--ghost" aria-pressed={deckMode === 'sample'} onClick={() => chooseMode('sample')}>サンプルカード</button><button className="button button--ghost" aria-pressed={deckMode === 'owned'} disabled={account.ownedCards.length < 4} onClick={() => chooseMode('owned')}>自分のカード</button></div><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => { void startCode(); }}>部屋を作る</button></div><label>友達の4桁コード<input inputMode="numeric" maxLength={4} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label><button className="button button--ghost" disabled={busy || code.length !== 4} onClick={() => { void joinCode(); }}>コードで参加</button></> : !room ? <p role="status">部屋を読み込み中…</p> : <><p>部門：{room.meta.deckMode === 'owned' ? '自分のカード' : 'サンプルカード'}{room.meta.code ? ` · ルームコード ${room.meta.code}` : ''}</p><p>{room.players?.[room.meta.hostUid]?.nickname || 'プレイヤー1'} VS {room.players?.[room.meta.guestUid || '']?.nickname || '相手を待っています…'}</p>
        {!room.meta.guestUid ? <p role="status">相手を待っています。コードを友達に伝えてください。</p> : !joined ? <p role="status">対戦相手の参加を確認中…</p> : view?.phase === 'forfeit' ? <div role="status"><h2>{myResult(view, mySide) === 'win' ? '不戦勝' : '不戦敗'}</h2><p>30秒以上の切断で対戦は終了しました。Gポイントは付与されません。</p></div> : opponentOffline && view?.outcome === null && view?.phase !== 'invalid' ? <div role="status"><h2>相手の接続が切れました</h2><p>30秒以上戻っていません。不戦勝を確定しています…</p></div> : view?.phase === 'deck' ? <><h2>カードを4枚選ぶ</h2><p>制限時間90秒。相手には種類だけが見え、カード名はラウンドまで隠れます。</p>{room.decks?.[uid] ? <p role="status">相手の準備を待っています…</p> : <><div className="online-deck-grid">{pool.map((item) => <button key={item.id} className={selectedValid.includes(item.id) ? 'is-selected' : ''} aria-pressed={selectedValid.includes(item.id)} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 4 ? [...current, item.id] : current)}><Card card={getCard(item.cardId)} width={110} /><strong>{getCard(item.cardId).name}</strong></button>)}</div><button className="button button--primary" disabled={busy || selectedValid.length !== 4} onClick={() => { void submitDeck(); }}>この4枚で決定</button></>}</> : !view ? <p>対戦を読み込み中…</p> : view.phase === 'invalid' ? <div role="alert"><h2>無効試合</h2><p>{view.error}</p></div> : view.phase === 'finished' ? <><h2>{myResult(view, mySide) === 'win' ? '勝利！' : myResult(view, mySide) === 'draw' ? '引き分け' : '敗北'}</h2><p>ライフ {view.life[mySide]} 対 {view.life[mySide === 0 ? 1 : 0]}</p><p role="status">{room.meta.teacherTest ? '管理者テスト対戦のためGポイントは増減しません。' : reward?.status === 'complete' ? `報酬 +${reward.awarded}G · 所持 ${reward.gPoint}G` : reward?.status === 'invalid' ? '対戦結果を確認できなかったため報酬はありません。' : '両者の結果と報酬を照合中…'}</p></> : <><h2>ラウンド {view.round}</h2><div className="online-life"><strong>あなた {view.life[mySide]} / {view.maxLife[mySide]}</strong><strong>{opponent?.nickname || '相手'} {view.life[mySide === 0 ? 1 : 0]} / {view.maxLife[mySide === 0 ? 1 : 0]}</strong></div><p>相手の残りカード：{view.types[mySide === 0 ? 1 : 0].map((type, index) => view.used[mySide === 0 ? 1 : 0].includes(index) ? null : <span className="online-back" key={index}>{typeLabels[type]}</span>)}</p>
          {view.phase === 'select' ? room.rounds?.[String(view.round)]?.commit?.[uid] ? <p role="status">相手のカード決定を待っています…</p> : <><p>30秒以内にカードを選んでください。</p><div className="online-deck-grid">{entries?.map((entry, index) => view.used[mySide].includes(index) ? null : <button key={index} onClick={() => { void selectPick(index); }}><Card card={getCard(entry.cardId)} width={110} /><strong>{getCard(entry.cardId).name}</strong></button>)}</div></> : view.phase === 'reveal' ? <div className="round-intro panel"><div className="round-intro__versus">VS</div><p>お互いのカードを公開中…</p></div> : view.phase === 'target' && view.targetOwner === mySide ? <><p>手品で変える相手の残りカードを選んでください（20秒）。</p><div className="online-targets">{view.types[mySide === 0 ? 1 : 0].map((type, index) => view.used[mySide === 0 ? 1 : 0].includes(index) ? null : <button key={index} onClick={() => { void chooseTarget(index); }}>{typeLabels[type]} · {index + 1}番</button>)}</div></> : view.phase === 'target' ? <p role="status">相手が手品の対象を選んでいます…</p> : view.phase === 'verify' && view.reveal ? <>{!revealReady ? <div className="round-intro panel"><div className="round-intro__versus">VS</div><p>勝負の行方は…</p></div> : <><p>{view.winner === null ? 'あいこ' : view.winner === mySide ? 'このラウンドは勝ち！' : 'このラウンドは負け'}</p><div className="online-reveal-grid">{view.reveal.map((pick, side) => <div key={side}><span>{side === mySide ? 'あなた' : opponent?.nickname || '相手'}</span><Card card={getCard(pick.card.cardId)} width={170} /></div>)}</div><p>{view.events.join(' · ')}</p></>}<p role="status">次のラウンドを同期中…</p></> : <p role="status">デッキの最終確認中…</p>}</>}
        <div className="button-row"><button className="button button--ghost" onClick={leave}>対戦から戻る</button></div></>}
      {error && <p role="alert" className="portal-error">{error}</p>}
    </section><footer className="app-footer">Gカード · オンライン対戦</footer></main>;
}
