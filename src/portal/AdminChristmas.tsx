import { useEffect, useState } from 'react';
import { callApi, type CardMaster, type ChristmasConfig } from './api';
import { clearBootstrapCache } from './bootstrapCache';
import { compareCards } from '../data/cardOrder';
import { LoadingState } from '../components/LoadingState';
import { eventDate } from './ChristmasPage';
import './christmas.css';

type Config = { draft: ChristmasConfig; live: ChristmasConfig | null; revision: string };
type Data = { config: Config; tests: { testId: string; title: string; published: boolean }[]; cards: CardMaster[] };
const localDate = (value: string) => value ? new Date(Date.parse(value) + 9*3600000).toISOString().slice(0,16) : '';

export function AdminChristmas({ session, onDirtyChange }: { session: string; onDirtyChange?: (dirty:boolean) => void }) {
  const [data, setData] = useState<Data | null>(null), [draft, setDraft] = useState<ChristmasConfig | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const load = () => { setError(''); callApi<Data>('adminGetChristmas', session).then((value) => { setData(value); setDraft(value.config.draft); }).catch((failure: Error) => setError(failure.message)); };
  useEffect(load, [session]);
  useEffect(() => { onDirtyChange?.(!!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.config.draft)); },[draft,data,onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (draft && data && JSON.stringify(draft) !== JSON.stringify(data.config.draft)) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [draft, data]);
  const save = async (action: 'save'|'publish'|'pause') => {
    if (!draft || !data || busy) return;
    if (action === 'publish' && !window.confirm(`${eventDate(draft.startAt)} 〜 ${eventDate(draft.endAt)} に開催します。\nイベント画面・限定パック・サンタCPU・特別ミッションをまとめて公開しますか？`)) return;
    if (action === 'pause' && !window.confirm('イベントの公開を停止しますか？ 達成記録と獲得済み報酬は残ります。')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await callApi<{ config: Config }>('adminSaveChristmas', session, { action, draft, revision: data.config.revision });
      setData({ ...data, config: result.config }); setDraft(result.config.draft); clearBootstrapCache();
      setNotice(action === 'publish' ? '公開しました。開催期間になると自動で開始・終了します。' : action === 'pause' ? '公開を停止しました。進捗と報酬は保持しています。' : '準備中の設定を保存しました。生徒にはまだ反映されません。');
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  if (!data || !draft) return <section className="panel admin-stage-panel">{error ? <p role="alert">{error}<button onClick={load}>再読み込み</button></p> : <LoadingState text="イベント設定を読み込み中" />}</section>;
  const set = <K extends keyof ChristmasConfig>(key: K, value: ChristmasConfig[K]) => setDraft({ ...draft, [key]:value });
  const changed = JSON.stringify(draft) !== JSON.stringify(data.config.draft);
  const cards = (field: 'cardPool'|'cpuCards') => <div className="christmas-admin-cards">{['rock','scissors','paper'].map((type,i) => <fieldset key={type}><legend>{['グー','チョキ','パー'][i]}</legend><div>{data.cards.filter((card) => card.type === type).sort(compareCards).map((card) => <label key={card.cardId} title={card.text}><input type="checkbox" checked={draft[field].includes(card.cardId)} onChange={(e) => set(field, e.target.checked ? [...draft[field],card.cardId] : draft[field].filter((id) => id !== card.cardId))} /><span>{card.name} <b className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</b><small>{card.text}</small></span></label>)}</div></fieldset>)}</div>;
  return <section className="panel admin-stage-panel christmas-admin"><p className="eyebrow">CHRISTMAS EVENT</p><h2>クリスマスイベント</h2><p>公開状態：<b>{data.config.live?.published ? '公開中' : '準備中・非公開'}</b>。設定はまず下書きとして保存し、準備できたら一括公開します。停止・再公開しても進捗は消えません。</p>
    <div className="christmas-admin-actions"><button className="button button--ghost" disabled={busy} onClick={() => void save('save')}>{busy ? '保存中…' : '準備中の設定を保存'}</button><a className="button button--ghost" href="#/christmas?preview=1" onClick={(e) => { if (changed) { e.preventDefault(); setError('先に「準備中の設定を保存」を押してください。'); } }}>先生用プレビュー</a><button className="button button--primary" disabled={busy} onClick={() => void save('publish')}>この設定でまとめて公開</button>{data.config.live?.published && <button className="button button--ghost" disabled={busy} onClick={() => void save('pause')}>公開を停止</button>}</div>
    {error && <p role="alert" className="portal-error">{error}</p>}{notice && <p role="status" className="economy-message">{notice}</p>}
    <fieldset disabled={busy}><legend>開催期間・ミッション</legend><label>イベント名<input value={draft.title} maxLength={100} onChange={(e) => set('title',e.target.value)} /></label><div className="christmas-form-grid">{(['startAt','endAt'] as const).map((key,i) => <label key={key}>{i?'終了日時':'開始日時'}（日本時間）<input type="datetime-local" value={localDate(draft[key])} onChange={(e) => set(key,e.target.value ? new Date(`${e.target.value}:00+09:00`).toISOString() : '')} /></label>)}</div><div className="christmas-form-grid">{(['knowledgeTestId','reflectionTestId'] as const).map((key,i) => <label key={key}>{i?'振り返りテスト（必須記述を提出）':'知識テスト（満点）'}<select value={draft[key]} onChange={(e) => set(key,e.target.value)}><option value="">選んでください</option>{data.tests.map((test) => <option key={test.testId} value={test.testId}>{test.title}{test.published?'':'（未公開）'}</option>)}</select></label>)}</div><p>2つとも通常のテスト機能で作成してください。振り返りテストには必須の「長文記述」を入れます。自由記述本文は保存しません。</p><div className="christmas-form-grid">{(['cpuWins','onlineWins'] as const).map((key,i) => <label key={key}>{i?'オンライン':'サンタCPU'}の必要勝利数<input type="number" min={1} max={100} value={draft[key]} onChange={(e) => set(key,Number(e.target.value))} /></label>)}</div></fieldset>
    <fieldset disabled={busy}><legend>サンタCPU</legend><div className="christmas-form-grid"><label>最大ライフ<input type="number" min={1} max={9999} value={draft.cpuLife} onChange={(e) => set('cpuLife',Number(e.target.value))} /></label><label>筋トレ値（各カードの上限まで）<input type="number" min={0} max={20} value={draft.cpuTraining} onChange={(e) => set('cpuTraining',Number(e.target.value))} /></label></div><p>候補から4枚・SSR1枚以下のデッキを選びます。思考性能は専用の最上位AIです。候補には非SSRを3枚以上含めてください。</p>{cards('cpuCards')}</fieldset>
    <fieldset disabled={busy}><legend>クリスマス限定パック</legend><div className="christmas-form-grid"><label>価格（G）<input type="number" min={1} max={100000} value={draft.packPrice} onChange={(e) => set('packPrice',Number(e.target.value))} /></label><label>1パックの枚数<input type="number" min={1} max={10} value={draft.packSize} onChange={(e) => set('packSize',Number(e.target.value))} /></label></div><div className="christmas-form-grid">{['N','R','SR','SSR'].map((rarity) => <label key={rarity}>{rarity}の排出率（%）<input type="number" min={0} max={100} step="0.1" value={draft.rarityRates[rarity]} onChange={(e) => set('rarityRates',{ ...draft.rarityRates,[rarity]:Number(e.target.value) })} /></label>)}</div><p>合計 {Object.values(draft.rarityRates).reduce((sum,n) => sum+n,0)}%。サンタアッパーは必ず収録してください。SSRがサンタアッパーだけなら、SSR当選時は必ずサンタアッパーが出ます。</p>{cards('cardPool')}</fieldset>
  </section>;
}
