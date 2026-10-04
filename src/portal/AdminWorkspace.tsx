import { useEffect, useRef, useState } from 'react';
import { callApi } from './api';
import { AdminEconomy } from './AdminEconomy';
import { AdminTests } from './AdminTests';
import { LoadingState } from '../components/LoadingState';

type Tab = 'dashboard' | 'students' | 'tests' | 'economy' | 'exports';
type Dashboard = { date: string; students: number; logins: number; testAttempts: number; reflectionSubmissions: number; pointsIssued: number; pointsSpent: number };
type Student = { email: string; role: string; className: string; number: string; name: string; nickname: string; gPoint: number; maxLife: number; ownedCount: number };
type Detail = { student: Student; ownedCards: { ownedId: string; cardId: string; name: string; trainLevel: number; source: string }[]; pointHistory: { delta: number; reason: string; note: string; balanceAfter: number; at: string }[] };
type ExportPage = { headers: string[]; rows: unknown[][]; total: number; nextCursor: number | null };

const tableNames = ['Users', 'OwnedCards', 'Cards', 'Packs', 'Decks', 'Tests', 'Questions', 'TestResponses', 'TestBest', 'Reflections', 'ReflectionResponses', 'PointLog', 'Missions', 'MissionProgress', 'BattleLog', 'OnlineMatches', 'DailyCounters', 'AdminAdjustments', 'AdminActions', 'Settings'];
const reasonNames: Record<string, string> = { welcome: '初回登録', login_bonus: 'ログイン', buy_card: 'カード購入', train: 'トレーニング', mission: 'ミッション', test_score: 'テスト得点', test_perfect: '満点ボーナス', reflection: '振り返り', battle: '対戦', admin_adjust: '先生による調整' };

function DashboardPanel({ session }: { session: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const refresh = () => { setError(''); callApi<Dashboard>('adminDashboard', session).then(setData).catch((failure: Error) => setError(failure.message)); };
  useEffect(() => { refresh(); }, [session]);
  return <section className="panel admin-stage-panel"><div className="admin-stage-heading"><div><p className="eyebrow">TODAY</p><h2>今日のダッシュボード</h2></div><button className="button button--ghost" onClick={refresh}>更新</button></div>
    {data ? <><p>{data.date} の記録</p><div className="admin-metric-grid">{[
      ['登録生徒', `${data.students} 人`], ['今日のログイン', `${data.logins} 人`], ['テスト受験', `${data.testAttempts} 件`],
      ['振り返りの初回提出', `${data.reflectionSubmissions} 件`], ['Gポイント発行', `+${data.pointsIssued} G`], ['Gポイント消費', `−${data.pointsSpent} G`],
    ].map(([label, value]) => <div className="admin-metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><p className="admin-stage-note">人数は学校アカウントごとに数えます。振り返りはGカードが受け取った初回提出だけを集計します。</p></> : <LoadingState text="ダッシュボードを読み込み中" />}
    {error && <p role="alert" className="portal-error">{error}</p>}
  </section>;
}

function StudentPanel({ session }: { session: string }) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState('');
  const [csv, setCsv] = useState<string | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const adjustId = useRef<string | null>(null);
  const loadStudents = () => callApi<Student[]>('adminListStudents', session).then(setStudents).catch((failure: Error) => setMessage(failure.message));
  const loadDetail = (email: string) => callApi<Detail>('adminStudentDetail', session, { email }).then(setDetail).catch((failure: Error) => setMessage(failure.message));
  useEffect(() => { void loadStudents(); }, [session]);
  const adjust = async () => {
    if (!detail || busy) return;
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0 || reason.trim().length < 5) { setMessage('増減額と5文字以上の理由を入力してください。'); return; }
    if (!window.confirm(`${detail.student.name || detail.student.email} のGポイントを ${amount > 0 ? '+' : ''}${amount}G 調整しますか？\n理由：${reason.trim()}`)) return;
    setBusy(true); setMessage('保存中…');
    if (!adjustId.current) adjustId.current = crypto.randomUUID();
    try {
      const result = await callApi<{ gPoint: number }>('adminAdjustPoints', session, { email: detail.student.email, delta: amount, reason: reason.trim() }, adjustId.current);
      adjustId.current = null; setDelta(''); setReason(''); setMessage(`調整しました。現在 ${result.gPoint}G です。`);
      await Promise.all([loadStudents(), loadDetail(detail.student.email)]);
    } catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const resetNickname = async () => {
    if (!detail || busy || !window.confirm(`${detail.student.name || detail.student.email} のニックネームをリセットしますか？ 次回ログイン時に再設定されます。`)) return;
    setBusy(true); setMessage('保存中…');
    try { await callApi('adminResetNickname', session, { email: detail.student.email }); setMessage('ニックネームをリセットしました。'); await Promise.all([loadStudents(), loadDetail(detail.student.email)]); }
    catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const importRoster = async () => {
    if (!csv || busy) return;
    setBusy(true); setMessage('名簿を確認中…');
    try { const result = await callApi<{ added: number; updated: number }>('adminImportRoster', session, { csv }); setMessage(`名簿を更新しました。追加 ${result.added} 件、更新 ${result.updated} 件。`); setCsv(null); await loadStudents(); }
    catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const filtered = students?.filter((student) => `${student.className} ${student.number} ${student.name} ${student.nickname} ${student.email}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="panel admin-stage-panel"><p className="eyebrow">STUDENTS</p><h2>生徒管理</h2>
    <details className="admin-roster-import"><summary>名簿CSVを取り込む</summary><p>列名は <code>email,class,number,name</code>。既存の名簿を更新できます。</p><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setCsv).catch(() => setMessage('CSVを読めませんでした')); }} /><button className="button button--ghost" disabled={!csv || busy} onClick={() => { void importRoster(); }}>取り込む</button></details>
    <label>氏名・クラス・メールで検索<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="例：3年1組" /></label>
    {!students && !message && <LoadingState text="生徒を読み込み中" />}
    <div className="learning-table-wrap"><table><thead><tr><th>クラス</th><th>番号</th><th>氏名</th><th>ニックネーム</th><th>G</th><th>最大ライフ</th><th>カード</th><th></th></tr></thead><tbody>{filtered.map((student) => <tr key={student.email}><td>{student.className}</td><td>{student.number}</td><td>{student.name || (student.role === 'admin' ? '管理者' : '—')}</td><td>{student.nickname || '未設定'}</td><td>{student.gPoint}</td><td>{student.maxLife}</td><td>{student.ownedCount}</td><td><button className="button button--ghost" onClick={() => { setMessage(''); void loadDetail(student.email); }}>詳細</button></td></tr>)}</tbody></table></div>
    {detail && <div className="admin-student-detail"><div className="admin-stage-heading"><h3>{detail.student.name || '管理者'} の詳細</h3><button className="button button--ghost" onClick={() => setDetail(null)}>閉じる</button></div><p>{detail.student.email} · 所持 {detail.student.gPoint}G · 最大ライフ {detail.student.maxLife}</p><div className="admin-adjust"><label>Gポイントの増減額<input type="number" min="-100000" max="100000" value={delta} placeholder="例：20 または -20" onChange={(event) => { setDelta(event.target.value); adjustId.current = null; }} /></label><label>調整理由（必須）<input maxLength={200} value={reason} placeholder="例：授業での特別報酬" onChange={(event) => { setReason(event.target.value); adjustId.current = null; }} /></label><button className="button button--primary" disabled={busy || !delta || reason.trim().length < 5} onClick={() => { void adjust(); }}>Gポイントを調整</button></div><button className="button button--ghost" disabled={busy || !detail.student.nickname} onClick={() => { void resetNickname(); }}>ニックネームをリセット</button><h4>所持カード</h4>{detail.ownedCards.length ? <div className="admin-card-list">{detail.ownedCards.map((card) => <span key={card.ownedId}>{card.name} · 筋トレ {card.trainLevel}</span>)}</div> : <p>所持カードはありません。</p>}<h4>最近のGポイント履歴</h4><div className="learning-table-wrap"><table><thead><tr><th>日時</th><th>内容</th><th>増減</th><th>残高</th></tr></thead><tbody>{detail.pointHistory.map((entry, index) => <tr key={`${entry.at}-${index}`}><td>{entry.at ? new Date(entry.at).toLocaleString('ja-JP') : '—'}</td><td>{reasonNames[entry.reason] || entry.reason}{entry.note && <small>：{entry.note}</small>}</td><td>{entry.delta > 0 ? '+' : ''}{entry.delta}</td><td>{entry.balanceAfter}</td></tr>)}</tbody></table></div></div>}
    {message && <p role="status" className="economy-message">{message}</p>}
  </section>;
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = typeof value === 'string' && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function ExportPanel({ session }: { session: string }) {
  const [table, setTable] = useState('Users');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true); setError(''); setProgress('データを読み込み中…');
    try {
      let cursor: number | null = 0;
      let headers: string[] = [];
      const rows: unknown[][] = [];
      while (cursor !== null) {
        const page: ExportPage = await callApi<ExportPage>('adminExportData', session, { table, cursor });
        headers = page.headers; rows.push(...page.rows); cursor = page.nextCursor;
        setProgress(`${rows.length} / ${page.total} 行を取得しました`);
      }
      const content = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `Gカード-${table}-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(`${rows.length} 行のCSVを保存しました。`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="panel admin-stage-panel"><p className="eyebrow">EXPORT</p><h2>データを書き出す</h2><p>管理者だけが学校のシートからCSVを取得できます。テストの回答本文は保存していないため、書き出しにも含まれません。</p><label>データの種類<select value={table} onChange={(event) => setTable(event.target.value)}>{tableNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>{table === 'Questions' && <p>Questions にはテストの正解が含まれます。CSVの共有先に注意してください。</p>}<button className="button button--primary" disabled={busy} onClick={() => { void download(); }}>{busy ? '書き出し中…' : 'CSVを保存'}</button>{progress && <p role="status">{progress}</p>}{error && <p role="alert" className="portal-error">{error}</p>}</section>;
}

export function AdminWorkspace({ session }: { session: string }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'ダッシュボード' }, { key: 'students', label: '生徒管理' },
    { key: 'tests', label: 'テスト' }, { key: 'economy', label: 'カード・ミッション' }, { key: 'exports', label: 'CSV書き出し' },
  ];
  return <><section className="panel admin-stage-nav"><p className="eyebrow">ADMIN</p><h1>管理者メニュー</h1><div className="admin-stage-tabs">{tabs.map((item) => <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.label}</button>)}</div></section>
    {tab === 'dashboard' ? <DashboardPanel session={session} /> : tab === 'students' ? <StudentPanel session={session} /> : tab === 'tests' ? <AdminTests session={session} /> : tab === 'economy' ? <AdminEconomy session={session} /> : <ExportPanel session={session} />}
  </>;
}
