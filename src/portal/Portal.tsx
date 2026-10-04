import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { callApi, googleClientId, portalConfigured, saveSession, savedSession, type BootstrapData, type EconomyState } from './api';
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

export function Portal({ page }: { page: 'home' | 'admin' | 'shop' | 'training' | 'collection' | 'tests' | 'reflections' }) {
  const [session, setSession] = useState<string | null>(savedSession);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;
  const economyReady = Boolean(bootstrap?.economy?.enabled && bootstrap.packs && bootstrap.battleConfig);
  const learningReady = Boolean(bootstrap?.learning?.enabled);

  const loadBootstrap = async (activeSession: string) => {
    const data = await callApi<BootstrapData>('bootstrap', activeSession);
    setBootstrap(data);
    setNeedsNickname(data.needsNickname);
  };

  const applyEconomy = (state: EconomyState) => setBootstrap((current) => current ? {
    ...current,
    profile: { ...current.profile, gPoint: state.gPoint, maxLife: state.maxLife, runCount: state.runCount, pityCounter: state.pityCounter },
    ownedCards: state.ownedCards, lastDeck: state.lastDeck, missions: state.missions, daily: state.daily,
  } : current);
  const applyLearning = (gPoint: number, kind: 'test' | 'reflection') => setBootstrap((current) => current ? { ...current, profile: { ...current.profile, gPoint }, unreadTests: kind === 'test' ? Math.max(0, current.unreadTests - 1) : current.unreadTests } : current);

  useEffect(() => {
    if (!session || !portalConfigured) return;
    let cancelled = false;
    callApi<BootstrapData>('bootstrap', session).then((data) => {
      if (cancelled) return;
      setBootstrap(data);
      setNeedsNickname(data.needsNickname);
    }).catch((failure: Error & { code?: string }) => {
      if (cancelled) return;
      if (failure.code === 'LOGIN_REQUIRED') { saveSession(null); setSession(null); }
      setError(failure.message);
    });
    return () => { cancelled = true; };
  }, [session]);

  const onCredential = useCallback(async (credential: string) => {
    setBusy(true); setError('');
    try {
      const result = await callApi<LoginResult>('login', null, { idToken: credential });
      saveSession(result.session);
      setSession(result.session);
      setNeedsNickname(result.needsNickname);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }, []);

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

  const logout = () => { saveSession(null); setSession(null); setBootstrap(null); setNeedsNickname(false); setError(''); };

  const illustratedPage = session && bootstrap && !needsNickname && (page === 'home' || page === 'shop' || page === 'training' || page === 'tests') ? page : null;
  const backgroundName = illustratedPage === 'tests' ? 'test' : illustratedPage;
  const illustratedStyle = backgroundName ? { '--portal-bg': `url("${import.meta.env.BASE_URL}images/bg/${backgroundName}.webp")` } as CSSProperties : undefined;

  return <main className={`app-shell portal-shell${illustratedPage ? ' portal-shell--illustrated' : ''}`} style={illustratedStyle}>
    <header className="app-header portal-header"><a href="#/home" className="portal-brand"><img src={logoUrl} alt="Gカード" /></a><nav><a href="#/battle" className="text-link">試作対戦</a>{bootstrap?.profile.role === 'admin' && <a href="#/admin" className="text-link">管理者</a>}{session && <button type="button" className="text-link" onClick={logout}>ログアウト</button>}</nav></header>
    {!portalConfigured ? <section className="portal-panel panel"><p className="eyebrow">STAGE 5</p><h1>ログインの接続準備中</h1><p>学校のGoogleログインとサーバーを設定すると、ここからホーム画面を使えるようになります。</p><a className="button button--primary" href="#/battle">試作対戦を開く</a></section>
      : !session ? <section className="portal-panel panel"><p className="eyebrow">WELCOME TO G CARD</p><h1>学校アカウントでログイン</h1><p>登録済みの学校Googleアカウントでログインしてください。パスワードはGカードには送られません。</p><GoogleButton onCredential={onCredential} />{busy && <p role="status">確認中…</p>}</section>
        : needsNickname ? <section className="portal-panel panel"><p className="eyebrow">FIRST STEP</p><h1>ニックネームを決めよう</h1><p>対戦やランキングで表示する名前です。8文字以内で入力してください。</p><form onSubmit={submitNickname} className="portal-form"><label>ニックネーム<input value={nickname} maxLength={8} onChange={(event) => setNickname(event.target.value)} required /></label><button className="button button--primary" disabled={busy || !nickname.trim()}>決定する</button></form></section>
          : !bootstrap ? <section className="portal-panel panel" role="status"><h1>ホームを読み込み中…</h1></section>
            : page === 'admin' ? bootstrap.profile.role === 'admin' && session ? <AdminWorkspace session={session} /> : <section className="portal-panel panel"><h1>管理者のみ利用できます</h1><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : (page === 'tests' || page === 'reflections') && session ? learningReady ? <LearningPages page={page} session={session} onPoints={applyLearning} /> : <section className="portal-panel panel"><h1>先生の公開待ち</h1><p>テストと振り返り連携は、先生の準備が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : page !== 'home' && session ? economyReady ? <EconomyPages page={page as 'shop' | 'training' | 'collection'} session={session} data={bootstrap} onState={applyEconomy} /> : <section className="portal-panel panel"><h1>サーバーの更新待ち</h1><p>先生によるGカードの更新が終わると使えるようになります。</p><a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : <><section className="portal-overview panel"><div><p className="eyebrow">MY HOME</p><h1>{bootstrap.profile.nickname}さん</h1></div><div className="portal-stats"><strong><PortalIcon name="coin" />{bootstrap.profile.gPoint.toLocaleString()} G</strong><strong><PortalIcon name="life" />最大ライフ {bootstrap.profile.maxLife}</strong></div></section>
                <section className="portal-dashboard"><div className="portal-bonus panel"><h2>ログインボーナス</h2><div className="portal-stamps">{Array.from({ length: 7 }, (_, index) => <span className={index < ((bootstrap.loginBonus.streak - 1) % 7) + 1 ? 'is-stamped' : ''} key={index}>{index < ((bootstrap.loginBonus.streak - 1) % 7) + 1 ? <PortalIcon name="stamp" /> : index + 1}</span>)}</div><p>{bootstrap.loginBonus.awarded ? `今日のボーナス +${bootstrap.loginBonus.amount}G！` : '今日のスタンプは押してあります。'}</p></div><div className="portal-missions panel"><h2>ミッション</h2>{bootstrap.missions?.length ? bootstrap.missions.map((mission) => <p key={mission.missionId}>{mission.completed ? '✓ ' : ''}{mission.label}：{mission.progress}/{mission.targetCount}（+{mission.reward}G）</p>) : <p>現在のミッションはありません。</p>}</div></section>
                <section className="portal-menu">{menuItems.map((item) => { const href = item.key === 'tests' && learningReady ? '#/tests' : item.key === 'reflections' && learningReady ? '#/reflections' : item.key === 'battle' ? '#/battle' : item.key === 'online' && bootstrap.online?.enabled ? '#/online' : item.key === 'ranking' && bootstrap.online?.rankingEnabled ? '#/ranking' : economyReady && item.key === 'deck' ? '#/collection' : economyReady && item.key === 'shop' ? '#/shop' : economyReady && item.key === 'training' ? '#/training' : null; return href ? <a key={item.key} href={href} className="portal-menu-item panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong>{item.key === 'tests' && bootstrap.unreadTests > 0 && <small>{bootstrap.unreadTests}件の未受験</small>}</a> : <div key={item.key} className="portal-menu-item portal-menu-item--pending panel"><PortalIcon name={item.icon as PortalIconName} /><strong>{item.title}</strong><small>準備中</small></div>; })}</section></>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    <footer className="app-footer">Gカード · 学校アカウントのホーム · 版 {import.meta.env.VITE_BUILD_VERSION?.slice(0, 7) || '開発版'}</footer>
  </main>;
}
