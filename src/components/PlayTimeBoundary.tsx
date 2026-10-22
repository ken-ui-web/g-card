import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { callApi, isGuest, saveSession, savedSession } from '../portal/api';
import { clearBootstrapCache } from '../portal/bootstrapCache';
import { acknowledgePlayLimit, japanDay, playLimitEvent, readPlayLimit, type PlayLimit, type SavedPlayLimit } from '../portal/playTime';

function RemainingTime({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const seconds = Math.ceil(remaining / 1000);
  return <span>{Math.floor(seconds / 60)}分{String(seconds % 60).padStart(2, '0')}秒</span>;
}

export function PlayTimeBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(savedSession);
  const [limit, setLimit] = useState<SavedPlayLimit | null>(() => readPlayLimit(savedSession()));
  const [expired, setExpired] = useState(() => Boolean(readPlayLimit(savedSession()) && Date.now() >= readPlayLimit(savedSession())!.localExpiresAt));
  const [checking, setChecking] = useState(false);

  const sync = useCallback(() => {
    const current = savedSession();
    const next = readPlayLimit(current);
    setSession(current);
    setLimit(next);
    setExpired(Boolean(next && Date.now() >= next.localExpiresAt));
  }, []);

  const refresh = useCallback(async (current: string) => {
    if (isGuest(current)) return;
    setChecking(true);
    try { await callApi<PlayLimit | null>('getPlayLimit', current); }
    catch (failure) {
      if ((failure as Error & { code?: string }).code !== 'PLAY_TIME_EXPIRED') console.error('利用時間の確認に失敗しました', failure);
    }
    finally { setChecking(false); sync(); }
  }, [sync]);

  useEffect(() => {
    window.addEventListener(playLimitEvent, sync);
    window.addEventListener('g-card-session-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(playLimitEvent, sync);
      window.removeEventListener('g-card-session-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  useEffect(() => {
    if (!session || isGuest(session)) return;
    void refresh(session);
    const onReturn = () => { if (document.visibilityState === 'visible') void refresh(session); };
    document.addEventListener('visibilitychange', onReturn);
    return () => document.removeEventListener('visibilitychange', onReturn);
  }, [session, refresh]);

  useEffect(() => {
    if (!limit) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, limit.localExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [limit?.localExpiresAt]);

  useEffect(() => {
    let day = japanDay();
    const timer = window.setInterval(() => {
      if (japanDay() !== day) {
        day = japanDay();
        sync();
        const current = savedSession();
        if (current && !isGuest(current)) void refresh(current);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, sync]);

  if (session && limit?.noticePending && !expired) return <main className="app-shell play-time-shell"><section className="panel play-time-panel" role="alertdialog" aria-modal="true" aria-labelledby="play-time-notice-title"><p className="eyebrow">利用時間のお知らせ</p><h1 id="play-time-notice-title">今日は10分間利用できます</h1><p>あなたはプレイ時間の超過により制限がかかりました。<br />今日は、今から１０分だけ利用できます。</p><p className="play-time-remaining">残り <RemainingTime expiresAt={limit.localExpiresAt} /></p><button type="button" className="button button--primary" onClick={() => acknowledgePlayLimit(session)}>確認して始める</button></section></main>;

  if (session && limit && expired) return <main className="app-shell play-time-shell"><section className="panel play-time-panel" role="alert"><p className="eyebrow">利用時間のお知らせ</p><h1>本日の利用時間は終了しました</h1><p>明日また利用できます。</p><div className="button-row"><button type="button" className="button button--ghost" disabled={checking} onClick={() => { void refresh(session); }}>{checking ? '確認中…' : '利用状況を再確認'}</button><button type="button" className="button button--ghost" onClick={() => { clearBootstrapCache(); saveSession(null); window.location.hash = '#/home'; }}>ログアウト</button></div></section></main>;

  return <>{children}{session && limit && <div className="play-time-banner" role="status">今日の利用時間：残り <RemainingTime expiresAt={limit.localExpiresAt} /></div>}</>;
}
