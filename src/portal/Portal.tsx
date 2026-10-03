import { useCallback, useEffect, useRef, useState } from 'react';
import { callApi, googleClientId, portalConfigured, saveSession, savedSession, type BootstrapData } from './api';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: { type: string; theme: string; size: string; text: string; shape: string; width: number }) => void;
    } } };
  }
}

interface LoginResult { session: string; needsNickname: boolean; role: 'student' | 'admin' }
interface ImportResult { added: number; updated: number; total: number }

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
  { icon: '📝', title: 'テストを受ける', key: 'tests' },
  { icon: '✍️', title: '振り返りを書く', key: 'reflections' },
  { icon: '⚔️', title: '対戦する', key: 'battle' },
  { icon: '🃏', title: 'デッキ・図鑑', key: 'deck' },
  { icon: '🛒', title: 'カード購入', key: 'shop' },
  { icon: '💪', title: 'トレーニング', key: 'training' },
  { icon: '🏆', title: 'ランキング', key: 'ranking' },
] as const;

export function Portal({ adminRoute }: { adminRoute: boolean }) {
  const [session, setSession] = useState<string | null>(savedSession);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [csv, setCsv] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const logoUrl = `${import.meta.env.BASE_URL}images/brand/logo.png`;

  const loadBootstrap = async (activeSession: string) => {
    const data = await callApi<BootstrapData>('bootstrap', activeSession);
    setBootstrap(data);
    setNeedsNickname(data.needsNickname);
  };

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

  const importRoster = async () => {
    if (!session || !csv) return;
    setBusy(true); setError(''); setImportResult(null);
    try { setImportResult(await callApi<ImportResult>('adminImportRoster', session, { csv })); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const logout = () => { saveSession(null); setSession(null); setBootstrap(null); setNeedsNickname(false); setError(''); };

  return <main className="app-shell portal-shell">
    <header className="app-header portal-header"><a href="#/home" className="portal-brand"><img src={logoUrl} alt="Gカード" /></a><nav><a href="#/battle" className="text-link">試作対戦</a>{bootstrap?.profile.role === 'admin' && <a href="#/admin" className="text-link">管理者</a>}{session && <button type="button" className="text-link" onClick={logout}>ログアウト</button>}</nav></header>
    {!portalConfigured ? <section className="portal-panel panel"><p className="eyebrow">STAGE 5</p><h1>ログインの接続準備中</h1><p>学校のGoogleログインとサーバーを設定すると、ここからホーム画面を使えるようになります。</p><a className="button button--primary" href="#/battle">試作対戦を開く</a></section>
      : !session ? <section className="portal-panel panel"><p className="eyebrow">WELCOME TO G CARD</p><h1>学校アカウントでログイン</h1><p>登録済みの学校Googleアカウントでログインしてください。パスワードはGカードには送られません。</p><GoogleButton onCredential={onCredential} />{busy && <p role="status">確認中…</p>}</section>
        : needsNickname ? <section className="portal-panel panel"><p className="eyebrow">FIRST STEP</p><h1>ニックネームを決めよう</h1><p>対戦やランキングで表示する名前です。8文字以内で入力してください。</p><form onSubmit={submitNickname} className="portal-form"><label>ニックネーム<input value={nickname} maxLength={8} onChange={(event) => setNickname(event.target.value)} required /></label><button className="button button--primary" disabled={busy || !nickname.trim()}>決定する</button></form></section>
          : !bootstrap ? <section className="portal-panel panel" role="status"><h1>ホームを読み込み中…</h1></section>
            : adminRoute ? <section className="portal-panel panel"><p className="eyebrow">ADMIN</p><h1>名簿CSVの取込</h1>{bootstrap.profile.role !== 'admin' ? <p>管理者のみ利用できます。</p> : <><p>列名は <code>email,class,number,name</code>。取込前に名簿全体は画面に表示しません。</p><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setCsv).catch(() => setError('CSVを読めませんでした')); }} /><button type="button" className="button button--primary" disabled={!csv || busy} onClick={importRoster}>名簿を取り込む</button>{importResult && <p role="status">追加 {importResult.added} 件、更新 {importResult.updated} 件</p>}</>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section>
              : <><section className="portal-overview panel"><div><p className="eyebrow">MY HOME</p><h1>{bootstrap.profile.nickname}さん</h1></div><div className="portal-stats"><strong>💰 {bootstrap.profile.gPoint.toLocaleString()} G</strong><strong>❤ 最大ライフ {bootstrap.profile.maxLife}</strong></div></section>
                <section className="portal-dashboard"><div className="portal-bonus panel"><h2>📅 ログインボーナス</h2><div className="portal-stamps">{Array.from({ length: 7 }, (_, index) => <span className={index < ((bootstrap.loginBonus.streak - 1) % 7) + 1 ? 'is-stamped' : ''} key={index}>{index + 1}</span>)}</div><p>{bootstrap.loginBonus.awarded ? `今日のボーナス +${bootstrap.loginBonus.amount}G！` : '今日のスタンプは押してあります。'}</p></div><div className="portal-missions panel"><h2>🎯 今日のミッション</h2><p>ミッションは次の段階で利用できます。</p></div></section>
                <section className="portal-menu">{menuItems.map((item) => item.key === 'battle' ? <a key={item.key} href="#/battle" className="portal-menu-item panel"><span>{item.icon}</span><strong>{item.title}</strong></a> : <div key={item.key} className="portal-menu-item portal-menu-item--pending panel"><span>{item.icon}</span><strong>{item.title}</strong><small>準備中</small></div>)}</section></>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    <footer className="app-footer">Gカード · 学校アカウントのホーム</footer>
  </main>;
}
