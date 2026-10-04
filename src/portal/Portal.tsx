import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SoundToggle } from '../components/SoundToggle';
import { LoadingState } from '../components/LoadingState';
import { callApi, googleClientId, guestSession, isGuest, portalConfigured, saveSession, savedSession, type BootstrapData, type EconomyState } from './api';
import { clearBootstrapCache, isBootstrapFresh, isBootstrapFromToday, mergeEconomy, patchBootstrapCache, readBootstrapCache, requestBootstrap, writeBootstrapCache } from './bootstrapCache';
import { createGuest } from './guest';
import { PortalIcon, type PortalIconName } from './Icons';
import { EconomyPages } from './EconomyPages';
import { AdminWorkspace } from './AdminWorkspace';
import { LearningPages } from './LearningPages';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: { type: string; theme: string; size: string; text: string; shape: string; width: number }) => void;
    } } };
  }
}

interface LoginResult { session: string; needsNickname: boolean; role: 'student' | 'admin' }
function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !container.current || !window.google) return;
      container.current.replaceChildren();
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: ({ credential }) => onCredential(credential) });
      window.google.accounts.id.renderButton(container.current, { type: 'standard', theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', width: 300 });
    };
    if (window.google) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [onCredential]);
  return <div ref={container} className="portal-google-button" aria-label="Googleでログイン" />;
}

const menuItems = [
  { icon: 'test', title: 'テストを受ける', key: 'tests' },
  { icon: 'reflection', title: '振り返りを書く', key: 'reflections' },
  { icon: 'battle', title: '対戦する', key: 'battle' },
  { icon: 'battle', title: 'オンライン対戦', key: 'online' },
  { icon: 'deck', title: 'デッキ・図鑑', key: 'deck' },
  { icon: 'shop', title: 'カード購入', key: 'shop' },
  { icon: 'training', title: 'トレーニング', key: 'training' },
  { icon: 'ranking', title: 'ランキング', key: 'ranking' },
] as const;

function missionPeriod(period: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (period === 'daily') return `${today.replaceAll('-', '/')} 0:00〜23:59`;
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
  return `${monday.toISOString().slice(0, 10).replaceAll('-', '/')}〜${sunday.toISOString().slice(0, 10).replaceAll('-', '/')} 23:59`;
}

export function Portal({ page }: { page: 'home' | 'admin' | 'shop' | 'training' | 'collection' | 'tests' | 'reflections' }) {
  const [session, setSession] = useState<string | null>(savedSession);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(() => {
    const active = savedSession();
    return active && !isGuest(active) ? readBootstrapCache(active)?.data ?? null : null;
  });
  const [needsNickname, setNeedsNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
  const economyReady = Boolean(bootstrap?.economy?.enabled && bootstrap.packs && bootstrap.battleConfig);
  const learningReady = Boolean(bootstrap?.learning?.enabled);
  const dailyCurrent = !session || isGuest(session) || isBootstrapFromToday(readBootstrapCache(session));

  const loadBootstrap = async (activeSession: string) => {
    const data = await callApi<BootstrapData>('bootstrap', activeSession);
    if (!isGuest(activeSession)) writeBootstrapCache(activeSession, data);
    setBootstrap(data);
    setNeedsNickname(data.needsNickname);
  };

  const applyEconomy = (state: EconomyState) => {
    setBootstrap((current) => current ? mergeEconomy(current, state) : current);
    if (session && !isGuest(session)) patchBootstrapCache(session, (current) => mergeEconomy(current, state));
  };
  const applyLearning = (gPoint: number, kind: 'test' | 'reflection') => {
    const update = (current: BootstrapData) => ({ ...current, profile: { ...current.profile, gPoint }, unreadTests: kind === 'test' ? Math.max(0, current.unreadTests - 1) : current.unreadTests });
    setBootstrap((current) => current ? update(current) : current);
    if (session && !isGuest(session)) patchBootstrapCache(session, update, true);
  };

  useEffect(() => {
    if (!session || (!portalConfigured && !isGuest(session))) return;
    let cancelled = false;
    let running = false;
    const cached = !isGuest(session) ? readBootstrapCache(session) : null;
    if (cached) { setBootstrap(cached.data); setNeedsNickname(cached.data.needsNickname); }
    const refresh = () => {
      if (running || document.visibilityState === 'hidden') return;
      const snapshot = !isGuest(session) ? readBootstrapCache(session) : null;
      if (isBootstrapFresh(snapshot)) return;
      running = true;
      setRefreshing(Boolean(snapshot));
      void requestBootstrap(session).then((data) => {
        if (cancelled) return;
        if (isGuest(session) || writeBootstrapCache(session, data, Date.now(), snapshot?.revision ?? 0)) {
          setBootstrap(data);
          setNeedsNickname(data.needsNickname);
          setError('');
        } else {
          const latest = readBootstrapCache(session);
          if (latest) setBootstrap(latest.data);
        }
      }).catch((failure: Error & { code?: string }) => {
        if (cancelled) return;
        if (failure.code === 'LOGIN_REQUIRED') { clearBootstrapCache(); saveSession(null); setSession(null); setBootstrap(null); }
        setError(failure.message);
      }).finally(() => { running = false; if (!cancelled) setRefreshing(false); });
    };
    refresh();
    const onReturn = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => { cancelled = true; window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); };
  }, [session, page]);

  const onCredential = useCallback(async (credential: string) => {
    setBusy(true); setError('');
    try {
      const result = await callApi<LoginResult>('login', null, { idToken: credential });
      clearBootstrapCache(); setBootstrap(null);
      saveSession(result.session);
      setSession(result.session);
      setNeedsNickname(result.needsNickname);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }, []);

  const onGuest = () => {
    try { createGuest(); clearBootstrapCache(); setBootstrap(null); saveSession(guestSession); setError(''); setSession(guestSession); }
    catch { setError('この端末では保存できません。ブラウザーの保存設定を確認してください。'); }
  };

  const submitNickname = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError('');
    try {
      await callApi('setNickname', session, { nickname });
      await loadBootstrap(session);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const logout = () => { clearBootstrapCache(); saveSession(null); setSession(null); setBootstrap(null); setNeedsNickname(false); setError(''); };

  const illustratedPage = session && bootstrap && !needsNickname && (page === 'home' || page === 'shop' || page === 'training' || page === 'tests') ? page : null;
  const backgroundName = illustratedPage === 'tests' ? 'test' : illustratedPage;
  const illustratedStyle = backgroundName ? { '--portal-bg': `url("${import.meta.env.BASE_URL}images/bg/${backgroundName}.webp")` } as CSSProperties : undefined;

  return <main className={`app-shell portal-shell${illustratedPage ? ' portal-shell--illustrated' : ''}`} style={illustratedStyle}>
    <header className="app-header portal-header"><a href="#/home" className="portal-brand"><img src={logoUrl} alt="Gカード" /></a><nav><a href="#/battle" className="text-link">対戦</a>{bootstrap?.profile.role === 'admin' && <a href="#/admin" className="text-link">管理者</a>}<SoundToggle />{session && <button type="button" className="text-link" onClick={logout}>ログアウト</button>}</nav></header>
    {refreshing && bootstrap && <p className="portal-sync" role="status"><span className="portal-sync__spinner" />前回の記録を表示中 · 最新の記録を確認中…</p>}
    {!session ? <section className="portal-panel panel"><p className="eyebrow">WELCOME TO G CARD</p><h1>Gカードを始める</h1>{portalConfigured && <><p>学校アカウントでログインすると、記録を学校に保存できます。</p><GoogleButton onCredential={onCredential} /></>}<div className="guest-entry"><button type="button" className="button button--ghost" disabled={busy} onClick={onGuest}>ゲストとして遊ぶ</button><p>ゲストのカード・Gポイント・対戦記録はこの端末だけに保存されます。端末のデータを消すと復元できません。</p></div>{busy && <LoadingState text="ログインを確認中" />}</section>
        : needsNickname ? <section className="portal-panel panel"><p className="eyebrow">FIRST STEP</p><h1>ニックネームを決めよう</h1><p>対戦やランキングで表示する名前です。8文字以内で入力してください。</p><form onSubmit={submitNickname} className="portal-form"><label>ニックネーム<input value={nickname} maxLength={8} onChange={(event) => setNickname(event.target.value)} required /></label><button className="button button--primary" disabled={busy || !nickname.trim()}>決定する</button></form></section>
          : !bootstrap ? <section className="portal-panel panel"><LoadingState text="ホームを読み込み中" /></section>
            : page === 'admin' ? bootstrap.profile.role === 'admin' && session ? <AdminWorkspace session={session} /> : <section className="portal-panel panel"><h1>管理者のみ利用できます</h1><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : (page === 'tests' || page === 'reflections') && session ? isGuest(session) ? <section className="portal-panel panel"><h1>学校アカウント専用です</h1><p>テストと振り返りは学校アカウントでログインすると使えます。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section> : learningReady ? <LearningPages page={page} session={session} onPoints={applyLearning} /> : <section className="portal-panel panel"><h1>先生の公開待ち</h1><p>テストと振り返り連携は、先生の準備が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : page !== 'home' && session ? economyReady ? <EconomyPages page={page as 'shop' | 'training' | 'collection'} session={session} data={bootstrap} onState={applyEconomy} /> : <section className="portal-panel panel"><h1>サーバーの更新待ち</h1><p>先生によるGカードの更新が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : <><section className="portal-overview panel"><div><p className="eyebrow">MY HOME</p><h1>{bootstrap.profile.nickname}さん</h1></div><div className="portal-stats"><strong><PortalIcon name="coin" />{bootstrap.profile.gPoint.toLocaleString()} G</strong><strong><PortalIcon name="life" />最大ライフ {bootstrap.profile.maxLife}</strong></div></section>
                <section className="portal-dashboard">
                  <div className="portal-bonus panel"><h2>ログインボーナス</h2>
                    {dailyCurrent ? <><div className="portal-stamps">{Array.from({ length: 7 }, (_, index) => <span className={index < ((bootstrap.loginBonus.streak - 1) % 7) + 1 ? 'is-stamped' : ''} key={index}>{index < ((bootstrap.loginBonus.streak - 1) % 7) + 1 ? <PortalIcon name="stamp" /> : index + 1}</span>)}</div><p>{bootstrap.loginBonus.awarded ? `今日のボーナス +${bootstrap.loginBonus.amount}G！` : '今日のスタンプは押してあります。'}</p></> : <p>今日のログインボーナスを確認中…</p>}
                    <p>毎日{bootstrap.loginBonus.dailyAmount ?? 10}G、7日連続でさらに{bootstrap.loginBonus.streakBonus ?? 100}G。明日もログインしてスタンプを進めよう！</p>
                  </div>
                  <div className="portal-missions panel"><h2>ミッション</h2>{!dailyCurrent ? <p>今日の進み具合を確認中…</p> : bootstrap.missions?.length ? bootstrap.missions.map((mission) => <p key={mission.missionId}>{mission.completed ? '✓ ' : ''}{mission.label}：{mission.progress}/{mission.targetCount}（+{mission.reward}G）<small className="mission-period">{mission.period === 'daily' ? '毎日' : '毎週'} · {missionPeriod(mission.period)}</small></p>) : <p>現在のミッションはありません。</p>}</div>
                </section>
                <section className="portal-menu">{menuItems.filter((item) => !isGuest(session) || !['tests', 'reflections', 'online', 'ranking'].includes(item.key)).map((item) => { const href = item.key === 'tests' && learningReady ? '#/tests' : item.key === 'reflections' && learningReady ? '#/reflections' : item.key === 'battle' ? '#/battle' : item.key === 'online' && bootstrap.online?.enabled ? '#/online' : item.key === 'ranking' && bootstrap.online?.rankingEnabled ? '#/ranking' : economyReady && item.key === 'deck' ? '#/collection' : economyReady && item.key === 'shop' ? '#/shop' : economyReady && item.key === 'training' ? '#/training' : null; return href ? <a key={item.key} href={href} className="portal-menu-item panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong>{item.key === 'tests' && bootstrap.unreadTests > 0 && <small>{bootstrap.unreadTests}件の未受験</small>}</a> : <div key={item.key} className="portal-menu-item portal-menu-item--pending panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong><small>準備中</small></div>; })}</section></>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    <footer className="app-footer">Gカード · {isGuest(session) ? 'ゲスト' : '学校アカウント'} · 版 {import.meta.env.VITE_BUILD_VERSION?.slice(0, 7) || '開発版'}</footer>
  </main>;
}
