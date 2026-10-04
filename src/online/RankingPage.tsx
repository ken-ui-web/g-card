import { useEffect, useState } from 'react';
import { callApi, isGuest, savedSession } from '../portal/api';
import { LoadingState } from '../components/LoadingState';

type Row = { rank: number; nickname: string; wins: number; isSelf: boolean };
type Ranking = { enabled: boolean; weekStart: string; sample: Row[]; owned: Row[]; self: { sample: Row | null; owned: Row | null } };

export function RankingPage() {
  const session = isGuest(savedSession()) ? null : savedSession();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (!session) return; callApi<Ranking>('getRanking', session).then(setRanking).catch((failure: Error) => setError(failure.message)); }, [session]);
  const section = (mode: 'sample' | 'owned', label: string) => <section className="panel ranking-panel"><h2>{label}</h2>{ranking?.[mode].length ? <ol>{ranking[mode].map((item) => <li key={item.rank} className={item.isSelf ? 'is-self' : ''}><span>{item.rank}位</span><strong>{item.nickname}</strong><span>{item.wins}勝</span></li>)}</ol> : <p>今週の勝利記録はまだありません。</p>}<p>自分の順位：{ranking?.self[mode] ? `${ranking.self[mode].rank}位（${ranking.self[mode].wins}勝）` : 'まだ記録がありません'}</p></section>;
  return <main className="app-shell online-shell"><header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>週間ランキング</strong><a href="#/online" className="text-link">オンライン対戦</a></header><section className="panel online-panel"><p className="eyebrow">WEEKLY RANKING</p><h1>今週の勝利数</h1><p>月曜日に切り替わります。上位20名と自分の順位を表示します。</p>{!session ? <p>学校アカウントでログインしてください。</p> : !ranking && !error ? <LoadingState text="ランキングを読み込み中" /> : ranking && !ranking.enabled ? <p>先生がランキングを停止しています。</p> : ranking ? <><p>対象週：{ranking.weekStart}から</p>{section('owned', '自分のカードセット')}{section('sample', 'サンプルカードセット')}</> : null}{error && <p role="alert" className="portal-error">{error}</p>}</section></main>;
}
