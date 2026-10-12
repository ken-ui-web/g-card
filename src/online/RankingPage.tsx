import { useEffect, useState } from 'react';
import { callApi, isGuest, savedSession } from '../portal/api';
import { LoadingState } from '../components/LoadingState';

type Row = { rank: number; nickname: string; wins: number; isSelf: boolean };
type RankingRows = { sample: Row[]; owned: Row[]; self: { sample: Row | null; owned: Row | null } };
type Period = 'weekly' | 'monthly' | 'overall';
type Ranking = RankingRows & {
  enabled: boolean;
  weekStart: string;
  monthStart?: string;
  periods?: Record<Period, RankingRows>;
};

const periodLabels: Record<Period, string> = { weekly: '週間', monthly: '月間', overall: '総合' };

export function RankingPage() {
  const session = isGuest(savedSession()) ? null : savedSession();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [period, setPeriod] = useState<Period>('weekly');
  const [error, setError] = useState('');
  useEffect(() => { if (!session) return; callApi<Ranking>('getRanking', session).then(setRanking).catch((failure: Error) => setError(failure.message)); }, [session]);

  const rows = ranking?.periods?.[period] ?? (period === 'weekly' ? ranking : null);
  const section = (mode: 'sample' | 'owned', label: string) => <section className="panel ranking-panel" key={mode}>
    <h2>{label}</h2>
    {rows?.[mode].length ? <ol>{rows[mode].map((item) => <li key={item.rank} className={item.isSelf ? 'is-self' : ''}><span>{item.rank}位</span><strong>{item.nickname}</strong><span>{item.wins}勝</span></li>)}</ol> : <p>この期間の勝利記録はまだありません。</p>}
    <p>自分の順位：{rows?.self[mode] ? `${rows.self[mode].rank}位（${rows.self[mode].wins}勝）` : 'まだ記録がありません'}</p>
  </section>;

  const periodDetail = period === 'weekly' ? `対象週：${ranking?.weekStart}から（月曜更新）`
    : period === 'monthly' ? `対象月：${ranking?.monthStart}から（月初更新）`
      : 'オンライン対戦の開始から現在まで';

  return <main className="app-shell online-shell">
    <header className="app-header"><a href="#/home" className="text-link">← ホーム</a><strong>ランキング</strong><a href="#/online" className="text-link">オンライン対戦</a></header>
    <section className="panel online-panel">
      <p className="eyebrow">ONLINE RANKING</p><h1>オンライン対戦の勝利数</h1>
      <p>週間・月間・総合から選べます。各部門の上位20名と自分の順位を表示します。</p>
      {!session ? <p>学校アカウントでログインしてください。</p>
        : !ranking && !error ? <LoadingState text="ランキングを読み込み中" />
          : ranking && !ranking.enabled ? <p>先生がランキングを停止しています。</p>
            : ranking ? <>
              <div className="ranking-period-tabs" role="group" aria-label="ランキングの集計期間">
                {(Object.keys(periodLabels) as Period[]).map((item) => <button key={item} type="button" aria-pressed={period === item} onClick={() => setPeriod(item)}>{periodLabels[item]}</button>)}
              </div>
              {rows ? <><p className="ranking-period-detail">{periodDetail}</p>{section('owned', '自分のカードセット')}{section('sample', 'サンプルカードセット')}</>
                : <p>月間・総合ランキングは学校側の更新後に表示されます。</p>}
            </> : null}
      {error && <p role="alert" className="portal-error">{error}</p>}
    </section>
  </main>;
}
