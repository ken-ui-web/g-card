import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PortalIcon } from '../portal/Icons';

export type RewardNotice = { kind: 'login' | 'mission'; title: string; amount: number; detail?: string; items?: { label: string; reward: number }[] };
const eventName = 'g-card:reward-celebration';

export function showRewardCelebration(notice: RewardNotice) {
  window.dispatchEvent(new CustomEvent<RewardNotice>(eventName, { detail: notice }));
}

export function RewardCelebration() {
  const [queue, setQueue] = useState<RewardNotice[]>([]);
  useEffect(() => {
    const receive = (event: Event) => setQueue((current) => [...current, (event as CustomEvent<RewardNotice>).detail]);
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  const reward = queue[0];
  if (!reward) return null;
  return createPortal(<div className="reward-celebration-backdrop"><div className="reward-celebration panel" role="dialog" aria-modal="true" aria-label={reward.title}>
    <div className="reward-celebration__coin" aria-hidden="true"><PortalIcon name={reward.kind === 'login' ? 'stamp' : 'coin'} /></div>
    <p className="eyebrow">{reward.kind === 'login' ? 'LOGIN BONUS' : 'MISSION COMPLETE'}</p>
    <h2>{reward.title}</h2>
    <strong className="reward-celebration__amount">+{reward.amount.toLocaleString()} G</strong>
    {reward.detail && <p>{reward.detail}</p>}
    {reward.items?.map((item) => <p className="reward-celebration__item" key={item.label}>{item.label}　+{item.reward}G</p>)}
    <button type="button" className="button button--primary" autoFocus onClick={() => setQueue((current) => current.slice(1))}>確認する</button>
  </div></div>, document.body);
}
