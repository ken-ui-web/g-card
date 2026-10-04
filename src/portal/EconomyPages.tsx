import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { callApi, type BootstrapData, type CardMaster, type EconomyState, type OwnedCard } from './api';
import { availableCards } from '../data/cards';
import { PortalIcon, type PortalIconName } from './Icons';

type Page = 'shop' | 'training' | 'collection';
type Feedback = { phase: 'working' | 'done' | 'error'; title: string; detail?: string; balance?: number; image?: string; icon?: PortalIconName; missions?: EconomyState['completedMissions'] };
type FeedbackPlan = { working: string; done: (result: EconomyState) => Omit<Feedback, 'phase' | 'balance' | 'missions'> };
const cardImage = (card: CardMaster) => `${import.meta.env.BASE_URL}images/cards/${card.image}`;

function pendingCost(data: BootstrapData, items: { kind: 'muscle' | 'run'; ownedId?: string; count: number }[]) {
  let cost = 0;
  let runs = data.profile.runCount;
  const levels = new Map(data.ownedCards.map((card) => [card.ownedId, card.trainLevel]));
  for (const item of items) for (let index = 0; index < item.count; index++) {
    if (item.kind === 'run') { cost += data.economy.runCostBase + data.economy.runCostStep * runs; runs++; }
    else { const level = levels.get(item.ownedId ?? '') ?? 0; cost += data.economy.muscleCostBase + data.economy.muscleCostStep * level; levels.set(item.ownedId ?? '', level + 1); }
  }
  return { cost, runs };
}

function CardTile({ card, owned, children, className = '' }: { card: CardMaster; owned?: OwnedCard; children?: React.ReactNode; className?: string }) {
  const baseDamage = card.effects?.find((effect) => effect.type === 'damage')?.amount;
  return <article className={`economy-card panel ${className}`}><img src={cardImage(card)} alt={`${card.name}のカード表面`} /><div><h3>{card.name} <small>{card.rarity}</small></h3><p>{card.text}</p>{owned && card.type === 'rock' && <p>筋トレ +{owned.trainLevel}{baseDamage !== undefined ? ` · 最終ダメージ ${baseDamage + owned.trainLevel * card.trainingMultiplier}` : ''}</p>}{children}</div></article>;
}

export function EconomyFeedbackOverlay({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (feedback.phase !== 'working') return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [feedback.phase]);
  return createPortal(<div className="economy-feedback-backdrop"><div className={`economy-feedback panel economy-feedback--${feedback.phase}`} role="dialog" aria-modal="true" aria-label={feedback.title}>
    {feedback.phase === 'working' ? <div className="economy-feedback__spinner" aria-hidden="true"><PortalIcon name="coin" /></div> : feedback.image ? <img className="economy-feedback__card" src={feedback.image} alt="" /> : <div className="economy-feedback__symbol"><PortalIcon name={feedback.icon ?? 'shop'} /></div>}
    <p className="eyebrow">{feedback.phase === 'working' ? 'PROCESSING' : feedback.phase === 'done' ? 'COMPLETE' : 'TRY AGAIN'}</p><h2>{feedback.title}</h2>
    {feedback.phase === 'working' ? <p role="status">{seconds >= 5 ? `保存に少し時間がかかっています（${seconds}秒）。画面を閉じずにお待ちください。` : 'サーバーからの返事を待っています'}</p> : <><p>{feedback.detail}</p>{feedback.balance !== undefined && <p className="economy-feedback__balance">所持 {feedback.balance.toLocaleString()} G</p>}{feedback.missions?.map((mission) => <p className="economy-feedback__mission" key={mission.label}>ミッション達成：{mission.label} ＋{mission.reward}G</p>)}<button type="button" className="button button--primary" autoFocus onClick={onClose}>閉じる</button></>}
  </div></div>, document.body);
}

export function EconomyPages({ page, session, data, onState }: { page: Page; session: string; data: BootstrapData; onState: (state: EconomyState) => void }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<string[]>(() => {
    const playable = data.ownedCards.filter((owned) => availableCards.some((card) => card.cardId === owned.cardId));
    const valid = data.lastDeck.filter((id) => playable.some((card) => card.ownedId === id));
    return valid.length === 4 ? valid : playable.slice(0, 4).map((card) => card.ownedId);
  });
  const [opened, setOpened] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const [pendingTrain, setPendingTrain] = useState<{ kind: 'muscle' | 'run'; ownedId?: string; count: number }[]>([]);
  const trainTimer = useRef<number | null>(null);
  const pendingRef = useRef<typeof pendingTrain>([]);
  const cardById = (id: string) => data.cardMaster.find((card) => card.cardId === id);

  useEffect(() => { pendingRef.current = pendingTrain; }, [pendingTrain]);
  useEffect(() => () => { if (trainTimer.current !== null) { window.clearTimeout(trainTimer.current); void flushTraining(); } }, []);

  const transact = async (action: string, payload: Record<string, unknown>, success: (state: EconomyState) => string, plan?: FeedbackPlan) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true); setMessage('');
    if (plan) setFeedback({ phase: 'working', title: plan.working });
    try {
      const result = await callApi<EconomyState>(action, session, payload);
      onState(result);
      setMessage(success(result));
      if (result.completedMissions?.length) setMessage((before) => `${before}　ミッション達成：${result.completedMissions!.map((item) => `${item.label} +${item.reward}G`).join('、')}`);
      if (plan) setFeedback({ ...plan.done(result), phase: 'done', balance: result.gPoint, missions: result.completedMissions });
      return result;
    } catch (error) { const detail = (error as Error).message; setMessage(detail); if (plan) setFeedback({ phase: 'error', title: '処理できませんでした', detail }); return null; }
    finally { busyRef.current = false; setBusy(false); }
  };

  const flushTraining = async () => {
    const items = pendingRef.current;
    if (!items.length) return;
    pendingRef.current = [];
    setPendingTrain([]);
    const runCount = items.filter((item) => item.kind === 'run').reduce((sum, item) => sum + item.count, 0);
    const muscleCount = items.filter((item) => item.kind === 'muscle').reduce((sum, item) => sum + item.count, 0);
    const trainedCard = items.length === 1 && items[0].kind === 'muscle' ? cardById(data.ownedCards.find((owned) => owned.ownedId === items[0].ownedId)?.cardId ?? '') : null;
    await transact('train', { items }, (result) => `${result.trained ?? 0}回のトレーニングを記録しました。`, {
      working: 'トレーニングを記録中…',
      done: (result) => { const trainedOwned = items.length === 1 && items[0].kind === 'muscle' ? result.ownedCards.find((owned) => owned.ownedId === items[0].ownedId) : null; return { title: muscleCount && !runCount ? '筋トレ完了！' : runCount && !muscleCount ? '走り込み完了！' : 'トレーニング完了！', detail: `${result.trained ?? 0}回分を記録しました。${trainedCard && trainedOwned ? ` ${trainedCard.name}の筋トレ値は＋${trainedOwned.trainLevel}です。` : ''}${runCount && !muscleCount ? ` 最大ライフは${result.maxLife}です。` : ''}`, image: trainedCard ? cardImage(trainedCard) : undefined, icon: runCount && !muscleCount ? 'life' : 'training' }; },
    });
  };
  const queueTraining = (kind: 'muscle' | 'run', ownedId?: string) => {
    if (busyRef.current) return;
    const key = `${kind}:${ownedId ?? ''}`;
    const next = [...pendingRef.current];
    const index = next.findIndex((item) => `${item.kind}:${item.ownedId ?? ''}` === key);
    if (index >= 0) next[index] = { ...next[index], count: next[index].count + 1 };
    else next.push({ kind, ownedId, count: 1 });
    if (pendingCost(data, next).cost > data.profile.gPoint) { setMessage('Gポイントが足りません'); return; }
    pendingRef.current = next;
    setPendingTrain(next);
    if (trainTimer.current !== null) window.clearTimeout(trainTimer.current);
    trainTimer.current = window.setTimeout(() => { void flushTraining(); }, 800);
  };

  const feedbackOverlay = feedback && <EconomyFeedbackOverlay feedback={feedback} onClose={() => setFeedback(null)} />;

  if (page === 'shop') return <>{feedbackOverlay}<section className="economy-page"><p className="eyebrow">CARD SHOP</p><h1>カード購入</h1><p className="economy-balance">所持 {data.profile.gPoint.toLocaleString()} G</p>
    <h2>カードを選んで買う</h2><div className="economy-grid">{data.cardMaster.filter((card) => card.active && card.shopPrice !== null && cardImage(card)).map((card) => <CardTile key={card.cardId} card={card}><p className="economy-price">{card.shopPrice} G</p><button className="button button--primary" type="button" disabled={busy || data.profile.gPoint < (card.shopPrice ?? Infinity)} onClick={() => { void transact('buyCard', { cardId: card.cardId }, () => `${card.name}を購入しました。`, { working: `${card.name}を購入中…`, done: () => ({ title: '購入完了！', detail: `${card.name}を手に入れました。デッキ・図鑑で確認できます。`, image: cardImage(card) }) }); }}>購入する</button></CardTile>)}</div>
    <h2>パックを開ける</h2><div className="economy-grid">{data.packs.map((pack) => <article className="economy-pack panel" key={pack.packId}><img className="economy-pack__image" src={`${import.meta.env.BASE_URL}images/packs/normal.webp`} alt="" /><h3>{pack.name}</h3><p>{pack.cardsPerPack}枚入り · {pack.price}G</p><p>排出率：{Object.entries(pack.rarityRates).map(([rarity, rate]) => `${rarity} ${rate}%`).join('／')}</p><p>今日の購入：{data.daily.packsBought} / {data.economy.packDailyLimit} パック</p>{pack.pityCount > 0 && <p>SR以上確定まであと{Math.max(0, pack.pityCount - data.profile.pityCounter)}パック</p>}<button className="button button--primary" type="button" disabled={busy || data.profile.gPoint < pack.price || data.daily.packsBought >= data.economy.packDailyLimit} onClick={() => { setOpening(true); setOpened([]); void transact('openPack', { packId: pack.packId }, (result) => { setOpened((result.acquired ?? []).map((item) => item.cardId)); return 'パックを開けました！'; }).finally(() => setOpening(false)); }}>{opening ? '開封中…' : 'パックを開ける'}</button></article>)}</div>{opened.length > 0 && <div className="economy-opened panel" role="status"><h2>出たカード</h2><div className="economy-grid">{opened.map((id, index) => { const card = cardById(id); return card ? <div className="economy-opened-card" style={{ animationDelay: `${index * 220}ms` }} key={`${id}-${index}`}><CardTile card={card} /></div> : null; })}</div></div>}
    {message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;

  if (page === 'training') {
    const projected = pendingCost(data, pendingTrain);
    const runCost = data.economy.runCostBase + data.economy.runCostStep * projected.runs;
    return <>{feedbackOverlay}<section className="economy-page"><p className="eyebrow">TRAINING</p><h1>トレーニング</h1><p className="economy-balance">所持 {(data.profile.gPoint - projected.cost).toLocaleString()} G · 最大ライフ {data.profile.maxLife + (projected.runs - data.profile.runCount) * data.economy.lifePerRun}</p><div className={`economy-run panel ${pendingTrain.some((item) => item.kind === 'run') ? 'is-training' : ''}`}><h2>走り込み</h2><p>1回で最大ライフ +{data.economy.lifePerRun}。次の1回：{runCost}G</p><button type="button" className="button button--primary" disabled={busy || data.profile.gPoint - projected.cost < runCost} onClick={() => queueTraining('run')}>走り込む</button>{pendingTrain.some((item) => item.kind === 'run') && <p className="economy-inline-working" role="status">保存を準備中…</p>}</div><h2>筋トレ</h2><p>グーカード1枚ごとに育てられます。1回でダメージ +1。</p><div className="economy-grid">{data.ownedCards.filter((owned) => cardById(owned.cardId)?.type === 'rock').map((owned) => { const card = cardById(owned.cardId)!; const queued = pendingTrain.find((item) => item.ownedId === owned.ownedId)?.count ?? 0; const cost = data.economy.muscleCostBase + data.economy.muscleCostStep * (owned.trainLevel + queued); return <CardTile key={owned.ownedId} card={card} owned={{ ...owned, trainLevel: owned.trainLevel + queued }} className={queued ? 'is-training' : ''}><p>次の1回：{cost}G</p><button type="button" className="button button--primary" disabled={busy || data.profile.gPoint - projected.cost < cost} onClick={() => queueTraining('muscle', owned.ownedId)}>筋トレする</button>{queued > 0 && <p className="economy-inline-working" role="status">{queued}回分を保存準備中…</p>}</CardTile>; })}</div>{pendingTrain.length > 0 && <p className="economy-training-status" role="status">{pendingTrain.reduce((sum, item) => sum + item.count, 0)}回分を準備中… <span>まもなく保存します</span></p>}{message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;
  }

  const toggle = (ownedId: string) => setSelected((current) => current.includes(ownedId) ? current.filter((id) => id !== ownedId) : current.length < 4 ? [...current, ownedId] : current);
  return <section className="economy-page"><p className="eyebrow">MY COLLECTION</p><h1>デッキ・図鑑</h1><p>所持カードから４枚選びます。同じ名前でも、所持カードごとに筋トレ値は異なります。</p><p className="economy-balance">選択中 {selected.length} / 4 枚</p><div className="economy-grid">{data.ownedCards.map((owned) => { const card = cardById(owned.cardId); if (!card) return null; const playable = availableCards.some((item) => item.cardId === owned.cardId); return <CardTile key={owned.ownedId} card={card} owned={owned}><button type="button" className={`button ${selected.includes(owned.ownedId) ? 'button--primary' : 'button--ghost'}`} disabled={!playable || (!selected.includes(owned.ownedId) && selected.length >= 4)} onClick={() => toggle(owned.ownedId)}>{!playable ? '対戦対応待ち' : selected.includes(owned.ownedId) ? 'デッキから外す' : 'デッキに入れる'}</button><button type="button" className="economy-sell" disabled={busy || data.ownedCards.length <= 4} onClick={() => { if (owned.trainLevel > 0 && !window.confirm('筋トレの成果も消えます。売却しますか？')) return; void transact('sellCard', { ownedId: owned.ownedId }, () => `${card.name}を売却しました。`).then((result) => { if (result) setSelected(result.lastDeck); }); }}>売却する（+{data.economy.sellPrices?.[card.rarity] ?? 0}G）</button></CardTile>; })}</div><div className="button-row"><button className="button button--primary" disabled={busy || selected.length !== 4} onClick={() => { void transact('saveDeck', { ownedIds: selected }, () => 'デッキを保存しました。'); }}>この４枚を保存</button><a className="button button--ghost" href="#/battle">対戦する</a></div><h2>カード図鑑</h2><div className="economy-grid economy-catalog">{data.cardMaster.filter((card) => card.image).map((card) => { const count = data.ownedCards.filter((owned) => owned.cardId === card.cardId).length; return <article key={card.cardId} className="economy-card panel"><img src={cardImage(card)} className={count ? '' : 'is-locked'} alt={count ? `${card.name}のカード表面` : '未所持のカード'} /><strong>{count ? card.name : '未所持のカード'}</strong><small>所持 {count} 枚</small></article>; })}</div>{message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section>;
}
