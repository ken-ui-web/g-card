import type { BootstrapData, MissionState } from './api';
import { PortalIcon } from './Icons';

const japanToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const weekStart = (today: string) => { const day = new Date(`${today}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); };
const addDays = (day: string, count: number) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); };
const displayDate = (day: string) => day.replaceAll('-', '/');
const missionRoutes: Record<string, string> = { win_battle: '#/battle', play_cpu: '#/battle', train: '#/training', open_pack: '#/shop', submit_test: '#/tests', perfect_test: '#/tests', submit_reflection: '#/reflections', play_online: '#/online' };

function LoginBonusPanel({ bonus, current }: { bonus: BootstrapData['loginBonus']; current: boolean }) {
  const start = bonus.weekStart || weekStart(japanToday());
  const days = new Set(bonus.weekDays ?? []);
  const count = days.size;
  const remaining = Math.max(0, 4 - count);
  return <section className="portal-bonus panel"><h2>ログインボーナス</h2>
    {!current ? <p>今日のログイン記録を確認中…</p> : !bonus.weekDays ? <p>週4日ボーナスの記録を準備中です。学校側の更新後に表示されます。</p> : <>
      <div className="portal-bonus__reward"><PortalIcon name="stamp" /><div><strong>週4日で +{bonus.weeklyBonus ?? 100}G</strong><small>{displayDate(start)}〜{displayDate(addDays(start, 6))} のうち4日</small></div></div>
      <div className="portal-stamps" aria-label={`今週${count}日ログイン、目標4日`}>{['月', '火', '水', '木', '金', '土', '日'].map((label, index) => { const day = addDays(start, index); return <div className={`portal-stamp${days.has(day) ? ' is-stamped' : ''}`} key={day}><span>{days.has(day) ? <PortalIcon name="stamp" /> : label}</span><small>{label}</small></div>; })}</div>
      <div className="portal-bonus__progress"><div><strong>{bonus.weeklyCompleted ? `今週の${bonus.weeklyBonus ?? 100}Gボーナス達成！` : remaining === 1 ? `あと1日で${bonus.weeklyBonus ?? 100}G！` : `今週 ${count} / 4日 · あと${remaining}日`}</strong><span>毎日のログインでも +{bonus.dailyAmount ?? 10}G</span></div><div className="mission-progress" role="progressbar" aria-label="今週のログイン" aria-valuenow={Math.min(count, 4)} aria-valuemin={0} aria-valuemax={4}><span style={{ width: `${Math.min(count / 4, 1) * 100}%` }} /></div></div>
      {bonus.awarded && <p className="portal-bonus__today">今日の受け取り：+{bonus.amount}G{bonus.weeklyAwarded ? '（週4日達成！）' : ''}</p>}
    </>}
  </section>;
}

function MissionGroup({ period, missions, current, guest }: { period: 'daily' | 'weekly'; missions: MissionState[]; current: boolean; guest: boolean }) {
  const list = missions.filter((mission) => mission.period === period).sort((a, b) => Number(a.completed) - Number(b.completed) || b.progress / b.targetCount - a.progress / a.targetCount);
  const today = japanToday();
  const start = weekStart(today);
  const span = period === 'daily' ? `${displayDate(today)} 0:00〜23:59` : `${displayDate(start)}〜${displayDate(addDays(start, 6))} 23:59`;
  return <section className="portal-mission-group"><div className="portal-mission-group__heading"><h3>{period === 'daily' ? 'デイリーミッション' : 'ウィークリーミッション'}</h3><small>{span}</small></div>
    {!current ? <p>進み具合を確認中…</p> : list.length ? <div className="portal-mission-list">{list.map((mission) => {
      const progress = Math.min(mission.progress, mission.targetCount);
      const left = Math.max(0, mission.targetCount - progress);
      const href = missionRoutes[mission.condition];
      const available = href && (!guest || !['#/tests', '#/reflections', '#/online'].includes(href));
      return <article className={`portal-mission${mission.completed ? ' is-complete' : ''}`} key={mission.missionId}>
        <div className="portal-mission__top"><strong>{mission.label}</strong><b>{mission.completed ? '✓ 達成済み' : `+${mission.reward}G`}</b></div>
        <div className="portal-mission__progress"><span>{mission.completed ? '報酬を受け取りました' : left === 1 ? 'あと1回で達成' : `あと${left}回`}</span><span>{progress} / {mission.targetCount}</span></div>
        <div className="mission-progress" role="progressbar" aria-label={`${mission.label}の進み具合`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={mission.targetCount}><span style={{ width: `${progress / mission.targetCount * 100}%` }} /></div>
        {!mission.completed && available && <a className="portal-mission__action" href={href}>挑戦する →</a>}
      </article>;
    })}</div> : <p>現在のミッションはありません。</p>}
  </section>;
}

export function HomeRewards({ bonus, missions, current, guest }: { bonus: BootstrapData['loginBonus']; missions: MissionState[]; current: boolean; guest: boolean }) {
  return <section className="portal-dashboard"><LoginBonusPanel bonus={bonus} current={current} /><div className="portal-missions panel"><MissionGroup period="daily" missions={missions} current={current} guest={guest} /><MissionGroup period="weekly" missions={missions} current={current} guest={guest} /></div></section>;
}
