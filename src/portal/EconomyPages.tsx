import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { callApi, isGuest, type BootstrapData, type CardMaster, type EconomyState, type OwnedCard, type PackMaster } from './api';
import { availableCards } from '../data/cards';
import { compareCards } from '../data/cardOrder';
import { PortalIcon, type PortalIconName } from './Icons';
import { playSfx } from '../audio/sfx';
import { formatPackChance, packContents } from './packContents';
import { packArtKey, packArtUrl } from './packArt';

type Page = 'shop' | 'training' | 'collection';
type Feedback = { phase: 'working' | 'done' | 'error'; title: string; detail?: string; balance?: number; image?: string; workingKind?: 'pack' | 'card'; icon?: PortalIconName; acquired?: CardMaster[]; missions?: EconomyState['completedMissions'] };
type FeedbackPlan = { working: string; workingImage?: string; workingKind?: 'pack' | 'card'; done: (result: EconomyState) => Omit<Feedback, 'phase' | 'balance' | 'missions'> };
const cardImage = (card: CardMaster) => `${import.meta.env.BASE_URL}images/cards/${card.image}?v=${import.meta.env.VITE_BUILD_VERSION || 'dev'}`;
const cardSizeKey = 'g-card-card-size-v1';
const salePrice = (data: BootstrapData, owned: OwnedCard, card: CardMaster) => (data.economy.sellPrices?.[card.rarity] ?? 0) + (owned.trainingSpent ?? data.economy.muscleCostBase * owned.trainLevel + data.economy.muscleCostStep * owned.trainLevel * (owned.trainLevel - 1) / 2);

function CardSizeToggle({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return <button type="button" className="button button--ghost economy-size-toggle" aria-pressed={compact} onClick={onToggle}>{compact ? '大きくする' : '小さくする'}</button>;
}

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
  return <article className={`economy-card panel economy-card--${card.rarity.toLowerCase()} ${className}`}><img src={cardImage(card)} alt={`${card.name}のカード表面`} /><div><h3>{card.name} <span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></h3><p>{card.text}</p>{owned && card.type === 'rock' && <p>筋トレ +{owned.trainLevel}{baseDamage !== undefined ? ` · 最終ダメージ ${baseDamage + (owned.trainLevel + card.trainingBonus) * card.trainingMultiplier}` : ''}</p>}{children}</div></article>;
}

function PackContentsDialog({ pack, cards, onClose }: { pack: PackMaster; cards: CardMaster[]; onClose: () => void }) {
  return createPortal(<div className="economy-feedback-backdrop"><div className="economy-pack-dialog panel" role="dialog" aria-modal="true" aria-label={`${pack.name}の収録カード`}>
    <p className="eyebrow">PACK CONTENTS</p><h2>{pack.name}の収録カード</h2>
    <p>確率は通常の抽選1回あたりです。同じレア度の収録カードから均等に選ばれます。</p>
    {pack.pityCount > 0 && <p>天井に達したパックの1枚目はSR以上確定となり、下記の確率とは異なります。</p>}
    <div className="economy-pack-contents">{packContents(pack, cards).map(({ card, chance }) => <div className="economy-pack-content" key={card.cardId}>
      <img src={cardImage(card)} alt="" /><div><strong>{card.name} <span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></strong><p>{card.text}</p></div><b>{formatPackChance(chance)}</b>
    </div>)}</div>
    <button type="button" className="button button--primary" autoFocus onClick={onClose}>閉じる</button>
  </div></div>, document.body);
}

function PackConfirmDialog({ pack, balance, onCancel, onConfirm }: { pack: PackMaster; balance: number; onCancel: () => void; onConfirm: () => void }) {
  return createPortal(<div className="economy-feedback-backdrop"><div className="economy-pack-confirm panel" role="dialog" aria-modal="true" aria-label="パック購入の確認">
    <p className="eyebrow">CONFIRM PURCHASE</p><h2>本当に開けますか？</h2>
    <p>{pack.name}を{pack.price}Gで購入します。</p><p>購入後の所持：{(balance - pack.price).toLocaleString()}G</p>
    <div className="button-row"><button type="button" className="button button--ghost" autoFocus onClick={onCancel}>やめる</button><button type="button" className="button button--primary" onClick={onConfirm}>購入して開ける</button></div>
  </div></div>, document.body);
}

export function EconomyFeedbackOverlay({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (feedback.phase !== 'working') return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [feedback.phase]);
  return createPortal(<div className="economy-feedback-backdrop"><div className={`economy-feedback panel economy-feedback--${feedback.phase}${feedback.acquired?.length ? ' economy-feedback--pack-result' : ''}`} role="dialog" aria-modal="true" aria-label={feedback.title}>
    {feedback.phase === 'working' && feedback.image ? <img className={feedback.workingKind === 'card' ? 'economy-feedback__selling-card' : 'economy-feedback__pack'} src={feedback.image} alt="" /> : feedback.phase === 'working' ? <div className="economy-feedback__spinner" aria-hidden="true"><PortalIcon name="coin" /></div> : feedback.acquired?.length ? <div className="economy-feedback__cards">{feedback.acquired.map((card, index) => <figure className="economy-feedback__acquired" style={{ animationDelay: `${index * 180}ms` }} key={`${card.cardId}-${index}`}><img src={cardImage(card)} alt={`${card.name}のカード表面`} /><figcaption>{card.name} <span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></figcaption></figure>)}</div> : feedback.image ? <img className="economy-feedback__card" src={feedback.image} alt="" /> : <div className="economy-feedback__symbol"><PortalIcon name={feedback.icon ?? 'shop'} /></div>}
    <p className="eyebrow">{feedback.phase === 'working' ? 'PROCESSING' : feedback.phase === 'done' ? 'COMPLETE' : 'TRY AGAIN'}</p><h2>{feedback.title}</h2>
    {feedback.phase === 'working' ? <p role="status">{seconds >= 5 ? `保存に少し時間がかかっています（${seconds}秒）。画面を閉じずにお待ちください。` : '記録を保存しています'}</p> : <><p>{feedback.detail}</p>{feedback.balance !== undefined && <p className="economy-feedback__balance">所持 {feedback.balance.toLocaleString()} G</p>}{feedback.missions?.map((mission) => <p className="economy-feedback__mission" key={mission.label}>ミッション達成：{mission.label} ＋{mission.reward}G</p>)}<button type="button" className="button button--primary" autoFocus onClick={onClose}>{feedback.acquired?.length ? '確認して閉じる' : '閉じる'}</button></>}
  </div></div>, document.body);
}

export function EconomyPages({ page, session, data, onState, onRefreshShop }: { page: Page; session: string; data: BootstrapData; onState: (state: EconomyState) => void; onRefreshShop?: () => Promise<unknown> }) {
  const [collectionTab, setCollectionTab] = useState<'deck' | 'catalog'>('deck');
  const [shopTab, setShopTab] = useState<'single' | 'pack'>('single');
  const [previewPack, setPreviewPack] = useState<PackMaster | null>(null);
  const [pendingPack, setPendingPack] = useState<PackMaster | null>(null);
  const [compactCards, setCompactCards] = useState(() => { try { return localStorage.getItem(cardSizeKey) === 'compact'; } catch { return false; } });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<string[]>(() => {
    const playable = data.ownedCards.filter((owned) => availableCards.some((card) => card.cardId === owned.cardId));
    const valid = data.lastDeck.filter((id) => playable.some((card) => card.ownedId === id));
    return valid.length === 4 ? valid : playable.slice(0, 4).map((card) => card.ownedId);
  });
  const [pendingTrain, setPendingTrain] = useState<{ kind: 'muscle' | 'run'; ownedId?: string; count: number }[]>([]);
  const trainTimer = useRef<number | null>(null);
  const pendingRef = useRef<typeof pendingTrain>([]);
  const cardById = (id: string) => data.cardMaster.find((card) => card.cardId === id);
  const toggleCardSize = () => setCompactCards((current) => { const next = !current; try { localStorage.setItem(cardSizeKey, next ? 'compact' : 'regular'); } catch { /* Size still changes for this visit. */ } return next; });
  const pageClass = `economy-page${compactCards ? ' economy-page--compact' : ''}`;

  useEffect(() => { pendingRef.current = pendingTrain; }, [pendingTrain]);
  useEffect(() => () => { if (trainTimer.current !== null) { window.clearTimeout(trainTimer.current); void flushTraining(); } }, []);

  const transact = async (action: string, payload: Record<string, unknown>, success: (state: EconomyState) => string, plan?: FeedbackPlan) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true); setMessage('');
    setFeedback({ phase: 'working', title: plan?.working ?? '記録を保存中…', image: plan?.workingImage, workingKind: plan?.workingKind });
    try {
      if (isGuest(session) && (action === 'buyCard' || action === 'openPack')) await onRefreshShop?.();
      const result = await callApi<EconomyState>(action, session, payload);
      onState(result);
      setMessage(success(result));
      if (result.completedMissions?.length) setMessage((before) => `${before}　ミッション達成：${result.completedMissions!.map((item) => `${item.label} +${item.reward}G`).join('、')}`);
      setFeedback({ ...(plan?.done(result) ?? { title: '保存完了！', detail: success(result) }), phase: 'done', balance: result.gPoint, missions: result.completedMissions });
      if (action === 'openPack') playSfx((result.acquired ?? []).some((item) => ['SR', 'SSR'].includes(cardById(item.cardId)?.rarity ?? '')) ? 'rare' : 'pack');
      else if (action === 'buyCard' || action === 'train') playSfx('point');
      return result;
    } catch (error) { const detail = (error as Error).message; setMessage(detail); setFeedback({ phase: 'error', title: '処理できませんでした', detail }); return null; }
    finally { busyRef.current = false; setBusy(false); }
  };

  const confirmOpenPack = (pack: PackMaster) => {
    setPendingPack(null);
    playSfx('pack');
    void transact('openPack', { packId: pack.packId }, () => 'パックを開けました！', {
      working: 'パックを開封中…',
      workingImage: packArtUrl(packArtKey(pack)),
      done: (result) => ({
        title: 'パック開封！',
        detail: `${result.acquired?.length ?? 0}枚のカードを手に入れました。`,
        acquired: (result.acquired ?? []).map((item) => cardById(item.cardId)).filter((card): card is CardMaster => Boolean(card)),
      }),
    });
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
    playSfx('select');
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

  if (page === 'shop') return <>
    {feedbackOverlay}
    {previewPack && <PackContentsDialog pack={previewPack} cards={data.cardMaster} onClose={() => setPreviewPack(null)} />}
    {pendingPack && <PackConfirmDialog pack={pendingPack} balance={data.profile.gPoint} onCancel={() => setPendingPack(null)} onConfirm={() => confirmOpenPack(pendingPack)} />}
    <section className={pageClass}>
      <p className="eyebrow">CARD SHOP</p><h1>カード購入</h1>
      {shopTab === 'single' && <CardSizeToggle compact={compactCards} onToggle={toggleCardSize} />}
      <p className="economy-balance">所持 {data.profile.gPoint.toLocaleString()} G</p>
      <div className="shop-method">
        <h2>買い方を選ぶ</h2>
        <p>下の2つのタブをタップして切り替えられます。</p>
        <div className="collection-tabs shop-tabs" role="tablist" aria-label="カード購入の方法">
          <button type="button" role="tab" aria-selected={shopTab === 'single'} aria-controls="shop-single-panel" onClick={() => setShopTab('single')}><span className="shop-tab__status">{shopTab === 'single' ? '✓ 表示中' : 'タップして切り替え'}</span><strong>カードを選んで買う</strong><small>好きなカードを指定</small></button>
          <button type="button" role="tab" aria-selected={shopTab === 'pack'} aria-controls="shop-pack-panel" onClick={() => setShopTab('pack')}><span className="shop-tab__status">{shopTab === 'pack' ? '✓ 表示中' : 'タップして切り替え'}</span><strong>パックを開ける</strong><small>中身は開けてからのお楽しみ</small></button>
        </div>
      </div>
      {shopTab === 'single' ? <div id="shop-single-panel" role="tabpanel">
        <div className="economy-grid">{data.cardMaster.filter((card) => card.active && card.shopPrice !== null && card.image).sort(compareCards).map((card) => <CardTile key={card.cardId} card={card}>
          <p className="economy-price">{card.shopPrice} G</p>
          <button className="button button--primary" type="button" disabled={busy || data.profile.gPoint < (card.shopPrice ?? Infinity)} onClick={() => { void transact('buyCard', { cardId: card.cardId }, () => `${card.name}を購入しました。`, { working: `${card.name}を購入中…`, done: () => ({ title: '購入完了！', detail: `${card.name}を手に入れました。デッキ・図鑑で確認できます。`, image: cardImage(card) }) }); }}>購入する</button>
        </CardTile>)}</div>
      </div> : <div id="shop-pack-panel" role="tabpanel">
        <div className="economy-grid economy-pack-grid">{data.packs.map((pack) => <article className="economy-pack panel" key={pack.packId}>
          <img className="economy-pack__image" src={packArtUrl(packArtKey(pack))} alt="" />
          <h2>{pack.name}</h2><p>{pack.cardsPerPack}枚入り · {pack.price}G</p>
          <p>今日の購入：{data.daily.packsBought} / {data.economy.packDailyLimit} パック</p>
          {pack.pityCount > 0 && <p>SR以上確定まであと{Math.max(0, pack.pityCount - data.profile.pityCounter)}パック</p>}
          <button className="button button--ghost" type="button" onClick={() => setPreviewPack(pack)}>収録カード</button>
          <button className="button button--primary" type="button" disabled={busy || data.profile.gPoint < pack.price || data.daily.packsBought >= data.economy.packDailyLimit} onClick={() => setPendingPack(pack)}>パックを開ける</button>
        </article>)}</div>
      </div>}
      {message && <p className="economy-message" role="status">{message}</p>}
      <a className="button button--ghost" href="#/home">ホームへ戻る</a>
    </section>
  </>;

  if (page === 'training') {
    const projected = pendingCost(data, pendingTrain);
    const runCost = data.economy.runCostBase + data.economy.runCostStep * projected.runs;
    return <>{feedbackOverlay}<section className={pageClass}><p className="eyebrow">TRAINING</p><h1>トレーニング</h1><CardSizeToggle compact={compactCards} onToggle={toggleCardSize} /><p className="economy-balance">所持 {(data.profile.gPoint - projected.cost).toLocaleString()} G · 最大ライフ {data.profile.maxLife + (projected.runs - data.profile.runCount) * data.economy.lifePerRun}</p>
      <div className={`economy-run panel ${pendingTrain.some((item) => item.kind === 'run') ? 'is-training' : ''}`}><img className="economy-training-art economy-training-art--run" src={`${import.meta.env.BASE_URL}images/ui/run.webp`} alt="" /><div><h2>走り込み</h2><p>1回で最大ライフ +{data.economy.lifePerRun}。次の1回：{runCost}G</p><button type="button" className="button button--primary" disabled={busy || data.profile.gPoint - projected.cost < runCost} onClick={() => queueTraining('run')}>走り込む</button>{pendingTrain.some((item) => item.kind === 'run') && <p className="economy-inline-working" role="status">保存を準備中…</p>}</div></div>
      <div className="economy-training-heading"><img className="economy-training-art" src={`${import.meta.env.BASE_URL}images/ui/muscle.webp`} alt="" /><div><h2>筋トレ</h2><p>グーカード1枚ごとに育てられます。1回でダメージ +1。</p></div></div>
      <div className="economy-grid">{data.ownedCards.filter((owned) => cardById(owned.cardId)?.type === 'rock').map((owned) => { const card = cardById(owned.cardId)!; const queued = pendingTrain.find((item) => item.ownedId === owned.ownedId)?.count ?? 0; const cost = data.economy.muscleCostBase + data.economy.muscleCostStep * (owned.trainLevel + queued); return <CardTile key={owned.ownedId} card={card} owned={{ ...owned, trainLevel: owned.trainLevel + queued }} className={queued ? 'is-training' : ''}><p>次の1回：{cost}G</p><button type="button" className="button button--primary" disabled={busy || data.profile.gPoint - projected.cost < cost} onClick={() => queueTraining('muscle', owned.ownedId)}>筋トレする</button>{queued > 0 && <p className="economy-inline-working" role="status">{queued}回分を保存準備中…</p>}</CardTile>; })}</div>{pendingTrain.length > 0 && <p className="economy-training-status" role="status">{pendingTrain.reduce((sum, item) => sum + item.count, 0)}回分を準備中… <span>まもなく保存します</span></p>}{message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;
  }

  const selectedSsr = selected.filter((id) => cardById(data.ownedCards.find((item) => item.ownedId === id)?.cardId ?? '')?.rarity === 'SSR').length;
  const toggle = (ownedId: string) => setSelected((current) => current.includes(ownedId) ? current.filter((id) => id !== ownedId) : current.length < 4 && !(cardById(data.ownedCards.find((item) => item.ownedId === ownedId)?.cardId ?? '')?.rarity === 'SSR' && selectedSsr >= 1) ? [...current, ownedId] : current);
  const ownedSorted = [...data.ownedCards].sort((a, b) => compareCards(cardById(a.cardId)!, cardById(b.cardId)!));
  return <>{feedbackOverlay}<section className={pageClass}><p className="eyebrow">MY COLLECTION</p><h1>デッキ・図鑑</h1><CardSizeToggle compact={compactCards} onToggle={toggleCardSize} />
    <div className="collection-tabs" role="tablist" aria-label="デッキと図鑑"><button type="button" role="tab" aria-selected={collectionTab === 'deck'} onClick={() => setCollectionTab('deck')}>デッキ</button><button type="button" role="tab" aria-selected={collectionTab === 'catalog'} onClick={() => setCollectionTab('catalog')}>図鑑</button></div>
    {collectionTab === 'deck' ? <div role="tabpanel"><p>所持カードから４枚選びます。SSRは1枚までです。同じ名前でも、所持カードごとに筋トレ値は異なります。</p><p className="economy-balance">選択中 {selected.length} / 4 枚</p><div className="economy-grid">{ownedSorted.map((owned) => { const card = cardById(owned.cardId); if (!card) return null; const playable = availableCards.some((item) => item.cardId === owned.cardId); return <CardTile key={owned.ownedId} card={card} owned={owned}><button type="button" className={`button ${selected.includes(owned.ownedId) ? 'button--primary' : 'button--ghost'}`} disabled={!playable || (!selected.includes(owned.ownedId) && (selected.length >= 4 || card.rarity === 'SSR' && selectedSsr >= 1))} onClick={() => toggle(owned.ownedId)}>{!playable ? '対戦対応待ち' : selected.includes(owned.ownedId) ? 'デッキから外す' : 'デッキに入れる'}</button><button type="button" className="economy-sell" disabled={busy || data.ownedCards.length <= 4} onClick={() => { if (owned.trainLevel > 0 && !window.confirm(`筋トレに使ったGも含めて${salePrice(data, owned, card)}Gで売却します。筋トレ値は失われます。よろしいですか？`)) return; void transact('sellCard', { ownedId: owned.ownedId }, (result) => `${card.name}を売却しました。所持 ${result.gPoint}G`, { working: `${card.name}を売却中…`, workingImage: cardImage(card), workingKind: 'card', done: () => ({ title: '売却完了！', detail: `${card.name}を売却し、${salePrice(data, owned, card)}Gを受け取りました。`, icon: 'coin' }) }).then((result) => { if (result) setSelected(result.lastDeck); }); }}>売却する（+{salePrice(data, owned, card)}G）</button></CardTile>; })}</div><div className="button-row"><button className="button button--primary" disabled={busy || selected.length !== 4 || selectedSsr > 1} onClick={() => { void transact('saveDeck', { ownedIds: selected }, () => 'デッキを保存しました。'); }}>この４枚を保存</button><a className="button button--ghost" href="#/battle">対戦する</a></div></div>
      : <div role="tabpanel"><p>カードはグー、チョキ、パーの順です。まだ持っていないカードは暗く表示されます。</p><div className="economy-grid economy-catalog">{data.cardMaster.filter((card) => card.image).sort(compareCards).map((card) => { const count = data.ownedCards.filter((owned) => owned.cardId === card.cardId).length; return <article key={card.cardId} className={`economy-card panel economy-card--${card.rarity.toLowerCase()}`}><img src={cardImage(card)} className={count ? '' : 'is-locked'} alt={count ? `${card.name}のカード表面` : '未所持のカード'} /><div className="economy-card__name"><strong>{count ? card.name : '未所持のカード'}</strong><span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></div><small>所持 {count} 枚</small></article>; })}</div></div>}
    {message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;
}
