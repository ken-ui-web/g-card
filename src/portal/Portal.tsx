import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SoundToggle } from '../components/SoundToggle';
import { BrandIdentity } from '../components/BrandIdentity';
import { LoadingState } from '../components/LoadingState';
import { showRewardCelebration } from '../components/RewardCelebration';
import { callApi, googleClientId, guestSession, isGuest, portalConfigured, saveSession, savedSession, type BootstrapData, type EconomyState, type PublicShopConfig } from './api';
import { clearBootstrapCache, isBootstrapFresh, isBootstrapFromToday, mergeEconomy, patchBootstrapCache, readBootstrapCache, requestBootstrap, writeBootstrapCache } from './bootstrapCache';
import { applyGuestShopConfig, clearGuestShopConfig, createGuest } from './guest';
import { loadGuestShopConfig } from './publicShopConfig';
import { PortalIcon, type PortalIconName } from './Icons';
import { EconomyPages } from './EconomyPages';
import { AdminWorkspace } from './AdminWorkspace';
import { LearningPages } from './LearningPages';
import { HomeRewards } from './HomeRewards';

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

function announceLoginRewards(data: BootstrapData) {
  const bonus = data.loginBonus;
  if (bonus.awarded && bonus.amount > 0) showRewardCelebration({ kind: 'login', title: bonus.weeklyAwarded ? '週4日ログイン達成！' : 'ログインボーナス獲得！', amount: bonus.amount, detail: bonus.weeklyAwarded ? bonus.amount > (bonus.weeklyBonus ?? 100) ? '毎日のログイン分と週4日達成ボーナスを受け取りました。' : '週4日達成ボーナスを受け取りました。' : '今日のログイン分を受け取りました。' });
  if (bonus.completedMissions?.length) showRewardCelebration({ kind: 'mission', title: 'ミッション達成！', amount: bonus.completedMissions.reduce((sum, item) => sum + item.reward, 0), items: bonus.completedMissions });
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
  const [guestShopConfig, setGuestShopConfig] = useState<PublicShopConfig | null>(null);
  const [guestShopError, setGuestShopError] = useState('');
  const economyReady = Boolean(bootstrap?.economy?.enabled && bootstrap.packs && bootstrap.battleConfig);
  const learningReady = Boolean(bootstrap?.learning?.enabled);
  const dailyCurrent = !session || isGuest(session) || isBootstrapFromToday(readBootstrapCache(session));
  const guestShopNeeded = isGuest(session) && (page === 'shop' || page === 'collection');
  const economyData = bootstrap && guestShopConfig && isGuest(session) ? applyGuestShopConfig(bootstrap, guestShopConfig) : bootstrap;

  const refreshGuestShop = async () => {
    const config = await loadGuestShopConfig();
    setGuestShopConfig(config);
    setGuestShopError('');
    return config;
  };

  useEffect(() => {
    if (!guestShopNeeded) return;
    let cancelled = false;
    clearGuestShopConfig();
    setGuestShopConfig(null);
    setGuestShopError('');
    void loadGuestShopConfig().then((config) => { if (!cancelled) setGuestShopConfig(config); })
      .catch((failure: Error) => { if (!cancelled) setGuestShopError(failure.message); });
    return () => { cancelled = true; };
  }, [guestShopNeeded, page, session]);

  const loadBootstrap = async (activeSession: string) => {
    const data = await callApi<BootstrapData>('bootstrap', activeSession);
    if (!isGuest(activeSession)) writeBootstrapCache(activeSession, data);
    setBootstrap(data);
    setNeedsNickname(isGuest(activeSession) && data.needsNickname);
    announceLoginRewards(data);
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
    if (cached) { setBootstrap(cached.data); setNeedsNickname(false); }
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
          setNeedsNickname(isGuest(session) && data.needsNickname);
          setError('');
          announceLoginRewards(data);
          const loginMissions = new Set(data.loginBonus.completedMissions?.map((item) => item.label) ?? []);
          const completed = snapshot ? data.missions.filter((mission) => mission.completed && !snapshot.data.missions.some((previous) => previous.missionId === mission.missionId && previous.completed) && !loginMissions.has(mission.label)) : [];
          if (completed.length) showRewardCelebration({ kind: 'mission', title: 'ミッション達成！', amount: completed.reduce((sum, item) => sum + item.reward, 0), items: completed });
        } else {
          const latest = readBootstrapCache(session);
          if (latest) setBootstrap(latest.data);
        }
      }).catch((failure: Error & { code?: string }) => {
        if (cancelled) return;
        if (failure.code === 'LOGIN_REQUIRED' || failure.code === 'NAME_REQUIRED') { clearBootstrapCache(); saveSession(null); setSession(null); setBootstrap(null); }
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
      setNeedsNickname(false);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }, []);

  const onGuest = () => {
    try { createGuest(); setGuestShopConfig(null); clearBootstrapCache(); setBootstrap(null); saveSession(guestSession); setError(''); setSession(guestSession); }
    catch { setError('この端末では保存できません。ブラウザーの保存設定を確認してください。'); }
  };

  const submitNickname = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !isGuest(session) || busy) return;
    setBusy(true); setError('');
    try {
      await callApi('setNickname', session, { nickname });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      await loadBootstrap(session);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const logout = () => { clearGuestShopConfig(); setGuestShopConfig(null); clearBootstrapCache(); saveSession(null); setSession(null); setBootstrap(null); setNeedsNickname(false); setError(''); };

  const illustratedPage = session && bootstrap && !needsNickname && (page === 'home' || page === 'shop' || page === 'training' || page === 'tests') ? page : null;
  const backgroundName = illustratedPage === 'tests' ? 'test' : illustratedPage;
  const illustratedStyle = backgroundName ? { '--portal-bg': `url("${import.meta.env.BASE_URL}images/bg/${backgroundName}.webp")` } as CSSProperties : undefined;

  return <main className={`app-shell portal-shell${illustratedPage ? ' portal-shell--illustrated' : ''}`} style={illustratedStyle}>
    <header className="app-header portal-header"><BrandIdentity /><nav><a href="#/battle" className="text-link">対戦</a>{bootstrap?.profile.role === 'admin' && <a href="#/admin" className="text-link">管理者</a>}<SoundToggle />{session && <button type="button" className="text-link" onClick={logout}>ログアウト</button>}</nav></header>
    {refreshing && bootstrap && <p className="portal-sync" role="status"><span className="portal-sync__spinner" />前回の記録を表示中 · 最新の記録を確認中…</p>}
    {!session ? <section className="portal-panel panel"><p className="eyebrow">WELCOME TO G CARD</p><h1>Gカードを始める</h1>{busy ? <><LoadingState text="学校アカウントを確認中" /><p>初回は学校の記録を準備するため、少し時間がかかることがあります。</p></> : <>{portalConfigured && <><p>学校アカウントでログインすると、記録を学校に保存できます。</p><GoogleButton onCredential={onCredential} /></>}<div className="guest-entry"><button type="button" className="button button--ghost" onClick={onGuest}>ゲストとして遊ぶ</button><p>ゲストのカード・Gポイント・対戦記録はこの端末だけに保存されます。端末のデータを消すと復元できません。</p></div></>}</section>
        : needsNickname && isGuest(session) ? <section className="portal-panel panel"><p className="eyebrow">FIRST STEP</p><h1>ニックネームを決めよう</h1><p>ゲスト対戦で表示する名前です。8文字以内で入力してください。</p><form onSubmit={submitNickname} className="portal-form"><label>ニックネーム<input value={nickname} maxLength={8} disabled={busy} onChange={(event) => setNickname(event.target.value)} required /></label><button className="button button--primary" disabled={busy || !nickname.trim()}>{busy && <span className="loading-state__spinner loading-state__spinner--small" aria-hidden="true" />}{busy ? '保存中…' : '決定する'}</button></form>{busy && <LoadingState text="ゲストのカードを準備中" />}</section>
          : !bootstrap ? <section className="portal-panel panel"><LoadingState text={session && !isGuest(session) ? '学校の記録とカードを準備中' : 'ホームを読み込み中'} /></section>
            : page === 'admin' ? bootstrap.profile.role === 'admin' && session ? <AdminWorkspace session={session} /> : <section className="portal-panel panel"><h1>管理者のみ利用できます</h1><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : (page === 'tests' || page === 'reflections') && session ? isGuest(session) ? <section className="portal-panel panel"><h1>学校アカウント専用です</h1><p>テストと振り返りは学校アカウントでログインすると使えます。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section> : learningReady ? <LearningPages page={page} session={session} onPoints={applyLearning} /> : <section className="portal-panel panel"><h1>先生の公開待ち</h1><p>テストと振り返り連携は、先生の準備が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : page !== 'home' && session ? economyReady ? guestShopNeeded && !guestShopConfig ? <section className="portal-panel panel">{guestShopError ? <><h1>ショップ設定を読み込めません</h1><p className="portal-error" role="alert">{guestShopError}</p><button type="button" className="button button--primary" onClick={() => { setGuestShopError(''); void refreshGuestShop().catch((failure: Error) => setGuestShopError(failure.message)); }}>再読み込み</button></> : <LoadingState text="ショップ設定を読み込み中" />}</section> : <EconomyPages page={page as 'shop' | 'training' | 'collection'} session={session} data={economyData!} onState={applyEconomy} onRefreshShop={isGuest(session) ? refreshGuestShop : undefined} /> : <section className="portal-panel panel"><h1>サーバーの更新待ち</h1><p>先生によるGカードの更新が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : <><section className="portal-overview panel"><div><p className="eyebrow">MY HOME</p><h1>{bootstrap.profile.nickname}さん</h1></div><div className="portal-stats"><strong><PortalIcon name="coin" />{bootstrap.profile.gPoint.toLocaleString()} G</strong><strong><PortalIcon name="life" />最大ライフ {bootstrap.profile.maxLife}</strong></div></section>
                <section className="portal-menu">{menuItems.filter((item) => !isGuest(session) || !['tests', 'reflections', 'online', 'ranking'].includes(item.key)).map((item) => { const href = item.key === 'tests' && learningReady ? '#/tests' : item.key === 'reflections' && learningReady ? '#/reflections' : item.key === 'battle' ? '#/battle' : item.key === 'online' && bootstrap.online?.enabled ? '#/online' : item.key === 'ranking' && bootstrap.online?.rankingEnabled ? '#/ranking' : economyReady && item.key === 'deck' ? '#/collection' : economyReady && item.key === 'shop' ? '#/shop' : economyReady && item.key === 'training' ? '#/training' : null; return href ? <a key={item.key} href={href} className="portal-menu-item panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong>{item.key === 'tests' && bootstrap.unreadTests > 0 && <small>{bootstrap.unreadTests}件の未受験</small>}</a> : <div key={item.key} className="portal-menu-item portal-menu-item--pending panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong><small>準備中</small></div>; })}</section>
                <HomeRewards bonus={bootstrap.loginBonus} missions={bootstrap.missions ?? []} current={dailyCurrent} guest={isGuest(session)} /></>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    <footer className="app-footer">Gカード · {session ? isGuest(session) ? 'ゲスト' : '学校アカウント' : '未ログイン'}</footer>
  </main>;
}
