import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { callApi, isGuest, type BootstrapData, type CardMaster, type EconomyState, type OwnedCard, type PackMaster } from './api';
import { availableCards, type CardType, typeLabels } from '../data/cards';
import { compareCards } from '../data/cardOrder';
import { PortalIcon, type PortalIconName } from './Icons';
import { playSfx } from '../audio/sfx';
import { formatPackChance, packContents } from './packContents';
import { packArtKey, packArtUrl } from './packArt';
import { readTrainingDraft, stageMuscle, trainingCost, trainingCount, writeTrainingDraft, type TrainingDraft } from './trainingDraft';

type Page = 'shop' | 'training' | 'collection';
type Feedback = { phase: 'working' | 'done' | 'error'; title: string; detail?: string; balance?: number; image?: string; workingKind?: 'pack' | 'card'; icon?: PortalIconName; acquired?: CardMaster[]; missions?: EconomyState['completedMissions'] };
type FeedbackPlan = { working: string; workingImage?: string; workingKind?: 'pack' | 'card'; done: (result: EconomyState) => Omit<Feedback, 'phase' | 'balance' | 'missions'> };
const cardImage = (card: CardMaster) => `${import.meta.env.BASE_URL}images/cards/${card.image}?v=${import.meta.env.VITE_BUILD_VERSION || 'dev'}`;
const cardSizeKey = 'g-card-card-size-v1';
const deckTypes: CardType[] = ['rock', 'scissors', 'paper'];
const salePrice = (data: BootstrapData, owned: OwnedCard, card: CardMaster) => (data.economy.sellPrices?.[card.rarity] ?? 0) + (owned.trainingSpent ?? data.economy.muscleCostBase * owned.trainLevel + data.economy.muscleCostStep * owned.trainLevel * (owned.trainLevel - 1) / 2);

function CardSizeToggle({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return <button type="button" className="button button--ghost economy-size-toggle" aria-pressed={compact} onClick={onToggle}>{compact ? '大きくする' : '小さくする'}</button>;
}

function CardTile({ card, owned, children, className = '' }: { card: CardMaster; owned?: OwnedCard; children?: React.ReactNode; className?: string }) {
  const baseDamage = card.effects?.find((effect) => effect.type === 'damage')?.amount;
  return <article className={`economy-card panel economy-card--${card.rarity.toLowerCase()} ${className}`}><img src={cardImage(card)} alt={`${card.name}のカード表面`} /><div className="economy-card__body"><h3><span className="economy-card__title" title={card.name}>{card.name}</span><span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></h3><p className="economy-card__effect" title={card.text}>{card.text}</p>{owned && card.type === 'rock' && <p>筋トレ +{owned.trainLevel}{baseDamage !== undefined ? ` · 最終ダメージ ${baseDamage + (owned.trainLevel + card.trainingBonus) * card.trainingMultiplier}` : ''}</p>}{children}</div></article>;
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

function TrainingConfirmDialog({ draft, data, onCancel, onConfirm }: { draft: TrainingDraft; data: BootstrapData; onCancel: () => void; onConfirm: () => void }) {
  const cost = trainingCost(data, draft);
  return createPortal(<div className="economy-feedback-backdrop"><div className="economy-pack-confirm panel" role="dialog" aria-modal="true" aria-label="筋トレ内容の保存確認">
    <p className="eyebrow">CONFIRM TRAINING</p><h2>筋トレ内容を保存しますか？</h2>
    <p>{trainingCount(draft)}回分をまとめて記録します。</p>
    <div className="training-confirm-list">{draft.items.map((item) => { const owned = data.ownedCards.find((card) => card.ownedId === item.ownedId); const card = data.cardMaster.find((entry) => entry.cardId === owned?.cardId); return <div key={item.ownedId}><span>{card?.name ?? '所持カード'} · 筋トレ値 +{owned?.trainLevel ?? 0} → +{(owned?.trainLevel ?? 0) + item.count}</span><strong>{item.count}回</strong></div>; })}</div>
    <p>合計 {cost.toLocaleString()}G · 費用差引後 {Math.max(0, data.profile.gPoint - cost).toLocaleString()}G</p><small>ミッション報酬は保存後に加算されます。</small>
    <div className="button-row"><button type="button" className="button button--ghost" autoFocus onClick={onCancel}>戻る</button><button type="button" className="button button--primary" onClick={onConfirm}>この内容で保存</button></div>
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
  const [deckTypeTab, setDeckTypeTab] = useState<CardType>('rock');
  const [shopTab, setShopTab] = useState<'single' | 'pack'>('single');
  const [trainingTab, setTrainingTab] = useState<'muscle' | 'run'>('muscle');
  const [previewPack, setPreviewPack] = useState<PackMaster | null>(null);
  const [pendingPack, setPendingPack] = useState<PackMaster | null>(null);
  const [compactCards, setCompactCards] = useState(() => { try { return localStorage.getItem(cardSizeKey) === 'compact'; } catch { return false; } });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<(string | null)[]>(() => {
    const playable = data.ownedCards.filter((owned) => availableCards.some((card) => card.cardId === owned.cardId));
    const valid = data.lastDeck.filter((id) => playable.some((card) => card.ownedId === id));
    const initial = valid.length === 4 ? valid : playable.slice(0, 4).map((card) => card.ownedId);
    return Array.from({ length: 4 }, (_, index) => initial[index] ?? null);
  });
  const [trainingDraft, setTrainingDraft] = useState<TrainingDraft | null>(() => readTrainingDraft(session));
  const trainingDraftRef = useRef(trainingDraft);
  const [showTrainingConfirm, setShowTrainingConfirm] = useState(false);
  const [powerUps, setPowerUps] = useState<Record<string, number>>({});
  const cardById = (id: string) => data.cardMaster.find((card) => card.cardId === id);
  const toggleCardSize = () => setCompactCards((current) => { const next = !current; try { localStorage.setItem(cardSizeKey, next ? 'compact' : 'regular'); } catch { /* Size still changes for this visit. */ } return next; });
  const pageClass = `economy-page${compactCards ? ' economy-page--compact' : ''}`;

  useEffect(() => { if (page === 'training') setTrainingTab('muscle'); }, [page]);
  useEffect(() => { const stored = readTrainingDraft(session); trainingDraftRef.current = stored; setTrainingDraft(stored); setShowTrainingConfirm(false); }, [session]);
  useEffect(() => {
    setSelected((current) => {
      const next = current.map((id) => id && !data.ownedCards.some((owned) => owned.ownedId === id) ? null : id);
      return next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [data.ownedCards]);

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

  const queueMuscle = (ownedId: string) => {
    if (busyRef.current) return;
    try {
      const next = stageMuscle(trainingDraftRef.current, ownedId, crypto.randomUUID());
      if (trainingCost(data, next) > data.profile.gPoint) { setMessage('Gポイントが足りません'); return; }
      try { writeTrainingDraft(session, next); }
      catch { setMessage('端末に一時保存できません。ブラウザーの保存設定を確認してください。'); return; }
      trainingDraftRef.current = next;
      setTrainingDraft(next);
      setMessage('');
      setPowerUps((current) => ({ ...current, [ownedId]: (current[ownedId] ?? 0) + 1 }));
      playSfx('point');
    } catch (failure) { setMessage((failure as Error).message || '端末に一時保存できませんでした'); }
  };

  const discardTraining = () => {
    if (!trainingDraftRef.current || trainingDraftRef.current.status === 'submitting' || !window.confirm('仮の筋トレ内容を破棄しますか？')) return;
    try { writeTrainingDraft(session, null); trainingDraftRef.current = null; setTrainingDraft(null); setMessage('筋トレ内容を取り消しました。'); }
    catch { setMessage('端末の一時保存を削除できませんでした'); }
  };

  const saveTraining = async () => {
    const current = trainingDraftRef.current;
    if (!current || busyRef.current) return;
    if (current.status === 'staged' && (!Number.isFinite(trainingCost(data, current)) || trainingCost(data, current) > data.profile.gPoint)) { setMessage('所持カードやGポイントが変わりました。内容を確認してください。'); return; }
    if (current.status === 'staged') {
      try {
        const submitting: TrainingDraft = { ...current, status: 'submitting' };
        writeTrainingDraft(session, submitting);
        trainingDraftRef.current = submitting;
        setTrainingDraft(submitting);
      } catch { setMessage('端末に一時保存できないため、送信を中止しました。'); return; }
    }
    busyRef.current = true;
    setBusy(true); setMessage('');
    setFeedback({ phase: 'working', title: '筋トレ内容を保存中…' });
    try {
      const result = await callApi<EconomyState>('train', session, { items: current.items }, current.requestId);
      onState(result);
      try { writeTrainingDraft(session, null); } catch { /* The saved request ID still prevents a second charge. */ }
      trainingDraftRef.current = null;
      setTrainingDraft(null);
      const trained = result.trained;
      const detail = trained === undefined ? '保存済みの筋トレ内容を確認しました。' : trained === trainingCount(current) ? `${trained}回分の筋トレを記録しました。` : `予定${trainingCount(current)}回のうち${trained}回分を記録しました。`;
      setMessage(detail);
      setFeedback({ phase: 'done', title: '筋トレ完了！', detail, balance: result.gPoint, missions: result.completedMissions, icon: 'training' });
      playSfx('point');
    } catch (failure) {
      const error = failure as Error & { code?: string };
      if (error.code === 'BAD_REQUEST' || error.code === 'NOT_ENOUGH_POINTS') {
        const staged: TrainingDraft = { ...current, status: 'staged' };
        try { writeTrainingDraft(session, staged); trainingDraftRef.current = staged; setTrainingDraft(staged); } catch { /* Keep the saved draft for recovery. */ }
      }
      setMessage(error.message);
      setFeedback({ phase: 'error', title: '保存できませんでした', detail: error.message });
    } finally { busyRef.current = false; setBusy(false); }
  };

  const trainRun = () => {
    if (trainingDraftRef.current) return;
    void transact('train', { items: [{ kind: 'run', count: 1 }] }, (result) => `最大ライフが${result.maxLife}になりました。`, {
      working: '走り込みを記録中…',
      done: (result) => ({ title: '走り込み完了！', detail: `最大ライフは${result.maxLife}です。`, icon: 'life' }),
    });
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
    const projectedCost = trainingCost(data, trainingDraft);
    const remainingG = data.profile.gPoint - projectedCost;
    const runCost = data.economy.runCostBase + data.economy.runCostStep * data.profile.runCount;
    const currentLife = data.profile.maxLife;
    const queuedCount = trainingCount(trainingDraft);
    const rockCards = data.ownedCards.filter((owned) => cardById(owned.cardId)?.type === 'rock').sort((a, b) => compareCards(cardById(a.cardId)!, cardById(b.cardId)!));
    return <>{feedbackOverlay}{showTrainingConfirm && trainingDraft && <TrainingConfirmDialog draft={trainingDraft} data={data} onCancel={() => setShowTrainingConfirm(false)} onConfirm={() => { setShowTrainingConfirm(false); void saveTraining(); }} />}<section className={`${pageClass} economy-training-page`}><p className="eyebrow">TRAINING</p><h1>トレーニング</h1>
      <div className="economy-training-summary" aria-label="現在のトレーニング状況"><div><span>{trainingDraft ? '費用差引後' : '所持G'}</span><strong>{Number.isFinite(remainingG) ? `${remainingG.toLocaleString()} G` : '要確認'}</strong></div><div><span>最大ライフ</span><strong>{currentLife}</strong></div></div>
      <div className="economy-training-tabs" role="tablist" aria-label="トレーニングの種類"><button type="button" role="tab" aria-selected={trainingTab === 'muscle'} aria-controls="training-muscle-panel" onClick={() => setTrainingTab('muscle')}><strong>カードの筋トレ</strong><small>グーカードを1枚ずつ強化</small></button><button type="button" role="tab" aria-selected={trainingTab === 'run'} aria-controls="training-run-panel" onClick={() => setTrainingTab('run')}><strong>走り込み</strong><small>最大ライフを増やす</small></button></div>
      {trainingDraft && <div className="economy-training-draft panel" role="status"><div><strong>{trainingDraft.status === 'submitting' ? '保存結果を確認してください' : `仮の筋トレ ${queuedCount}回`}</strong><small>{trainingDraft.status === 'submitting' ? '同じ内容で再確認します。二重にGは引かれません。' : !Number.isFinite(projectedCost) || remainingG < 0 ? '所持カードや残高が変わりました。選び直してください。' : `端末に一時保存中 · 合計 ${projectedCost.toLocaleString()}G`}</small></div><div className="economy-training-draft__actions"><button type="button" className="button button--primary" disabled={busy || trainingDraft.status === 'staged' && (!Number.isFinite(projectedCost) || remainingG < 0)} onClick={() => trainingDraft.status === 'submitting' ? void saveTraining() : setShowTrainingConfirm(true)}>{trainingDraft.status === 'submitting' ? '保存結果を確認する' : '筋トレを終了する'}</button>{trainingDraft.status === 'staged' && <button type="button" className="button button--ghost" onClick={discardTraining}>選び直す</button>}</div></div>}
      {trainingTab === 'muscle' ? <div id="training-muscle-panel" role="tabpanel" className="economy-training-workspace panel"><div className="economy-training-toolbar"><div><h2>カードの筋トレ</h2><p>グーカード1枚ごとに筋トレ値が上がります。上がるダメージはカードによって異なります。</p><small>所持しているグーカード {rockCards.length}枚</small></div><CardSizeToggle compact={compactCards} onToggle={toggleCardSize} /></div>
        <div className="economy-grid economy-training-grid">{rockCards.map((owned) => { const card = cardById(owned.cardId)!; const queued = trainingDraft?.items.find((item) => item.ownedId === owned.ownedId)?.count ?? 0; const level = owned.trainLevel + queued; const cost = data.economy.muscleCostBase + data.economy.muscleCostStep * level; const baseDamage = card.effects?.find((effect) => effect.type === 'damage')?.amount; const damage = baseDamage === undefined ? null : baseDamage + (level + card.trainingBonus) * card.trainingMultiplier; return <CardTile key={owned.ownedId} card={card} className={queued ? 'has-draft' : ''}><dl className="economy-training-card-stats"><div><dt>{queued ? '仮の筋トレ値' : '筋トレ値'}</dt><dd>+{level} <span>→</span> +{level + 1}</dd></div><div><dt>次の費用</dt><dd>{cost.toLocaleString()} G</dd></div></dl>{damage !== null && <p className="economy-training-damage">基本ダメージ {damage} → {damage + card.trainingMultiplier}{card.effects?.some((effect) => effect.type === 'damage' && 'hits' in effect && Number(effect.hits) > 1) ? '（1回あたり）' : ''}</p>}<button type="button" className="button button--primary" disabled={busy || trainingDraft?.status === 'submitting' || !Number.isFinite(remainingG) || remainingG < cost || queuedCount >= 100} onClick={() => queueMuscle(owned.ownedId)}>筋トレする</button>{queued > 0 && <p className="economy-training-card-pending">未保存 {queued}回</p>}{powerUps[owned.ownedId] > 0 && <span key={powerUps[owned.ownedId]} className="training-power-burst" aria-hidden="true"><strong>+1</strong><small>POWER UP!</small></span>}</CardTile>; })}</div>
      </div> : <div id="training-run-panel" role="tabpanel"><div className="economy-run economy-run--focused panel"><img className="economy-training-art economy-training-art--run" src={`${import.meta.env.BASE_URL}images/ui/run.webp`} alt="" /><div><h2>走り込み</h2><p>すべての対戦で使う最大ライフを育てます。</p><div className="economy-run-stats"><div><span>最大ライフ</span><strong>{currentLife} <em>→</em> {currentLife + data.economy.lifePerRun}</strong></div><div><span>次の費用</span><strong>{runCost.toLocaleString()} G</strong></div></div><button type="button" className="button button--primary" disabled={busy || Boolean(trainingDraft) || data.profile.gPoint < runCost} onClick={trainRun}>走り込む</button>{trainingDraft && <p className="economy-training-card-pending">先に仮の筋トレを保存してください。</p>}</div></div></div>}
      {message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;
  }

  const selectedIds = selected.filter((id): id is string => id !== null);
  const selectedSsr = selectedIds.filter((id) => cardById(data.ownedCards.find((item) => item.ownedId === id)?.cardId ?? '')?.rarity === 'SSR').length;
  const addToDeck = (ownedId: string) => setSelected((current) => {
    const emptyIndex = current.indexOf(null);
    if (emptyIndex < 0 || current.includes(ownedId)) return current;
    const card = cardById(data.ownedCards.find((item) => item.ownedId === ownedId)?.cardId ?? '');
    if (!card || (card.rarity === 'SSR' && current.some((id) => cardById(data.ownedCards.find((item) => item.ownedId === id)?.cardId ?? '')?.rarity === 'SSR'))) return current;
    const next = [...current];
    next[emptyIndex] = ownedId;
    return next;
  });
  const ownedSorted = [...data.ownedCards].sort((a, b) => compareCards(cardById(a.cardId)!, cardById(b.cardId)!));
  const candidates = ownedSorted.filter((owned) => cardById(owned.cardId)?.type === deckTypeTab && !selectedIds.includes(owned.ownedId));
  return <>{feedbackOverlay}<section className={pageClass}><p className="eyebrow">MY COLLECTION</p><h1>デッキ・図鑑</h1><CardSizeToggle compact={compactCards} onToggle={toggleCardSize} />
    <div className="collection-tabs" role="tablist" aria-label="デッキと図鑑"><button type="button" role="tab" aria-selected={collectionTab === 'deck'} onClick={() => setCollectionTab('deck')}>デッキ</button><button type="button" role="tab" aria-selected={collectionTab === 'catalog'} onClick={() => setCollectionTab('catalog')}>図鑑</button></div>
    {collectionTab === 'deck' ? <div role="tabpanel"><p>所持カードから４枚選びます。SSRは1枚までです。同じ名前でも、所持カードごとに筋トレ値は異なります。</p>
      <div className="deck-selection-heading"><h2>選択中のカード</h2><span>{selectedIds.length} / 4 枚</span></div>
      <div className="deck-slots" aria-label="選択中の４枚">
        {selected.map((ownedId, index) => {
          const owned = data.ownedCards.find((item) => item.ownedId === ownedId);
          const card = owned ? cardById(owned.cardId) : null;
          return <div className={`deck-slot panel${card ? ` economy-card--${card.rarity.toLowerCase()}` : ' deck-slot--empty'}`} key={index}>
            <span className="deck-slot__number">{index + 1}枚目</span>
            {card ? <><img src={cardImage(card)} alt={`${card.name}のカード表面`} /><div className="deck-slot__details"><strong title={card.name}>{card.name}</strong><span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></div>{card.type === 'rock' && <small>筋トレ +{owned?.trainLevel ?? 0}</small>}<button type="button" className="deck-slot__remove" aria-label={`${card.name}を外す`} onClick={() => setSelected((current) => current.map((id, slot) => slot === index ? null : id))}>外す</button></>
              : <span className="deck-slot__placeholder">空き</span>}
          </div>;
        })}
      </div>
      <div className="deck-selection-heading"><h2>カードを選ぶ</h2><span>グー・チョキ・パーから探す</span></div>
      <div className="collection-tabs deck-type-tabs" role="tablist" aria-label="カードの種類">{deckTypes.map((type) => <button key={type} type="button" role="tab" id={`deck-tab-${type}`} aria-selected={deckTypeTab === type} aria-controls="deck-candidates" onClick={() => setDeckTypeTab(type)}>{typeLabels[type]}</button>)}</div>
      <div id="deck-candidates" role="tabpanel" aria-labelledby={`deck-tab-${deckTypeTab}`}>
        {candidates.length ? <div className="economy-grid">{candidates.map((owned) => { const card = cardById(owned.cardId)!; const playable = availableCards.some((item) => item.cardId === owned.cardId); return <CardTile key={owned.ownedId} card={card} owned={owned}><button type="button" className="button button--ghost" disabled={!playable || selectedIds.length >= 4 || (card.rarity === 'SSR' && selectedSsr >= 1)} onClick={() => addToDeck(owned.ownedId)}>{!playable ? '対戦対応待ち' : 'デッキに入れる'}</button><button type="button" className="economy-sell" disabled={busy || data.ownedCards.length <= 4} onClick={() => { if (owned.trainLevel > 0 && !window.confirm(`筋トレに使ったGも含めて${salePrice(data, owned, card)}Gで売却します。筋トレ値は失われます。よろしいですか？`)) return; void transact('sellCard', { ownedId: owned.ownedId }, (result) => `${card.name}を売却しました。所持 ${result.gPoint}G`, { working: `${card.name}を売却中…`, workingImage: cardImage(card), workingKind: 'card', done: () => ({ title: '売却完了！', detail: `${card.name}を売却し、${salePrice(data, owned, card)}Gを受け取りました。`, icon: 'coin' }) }); }}>売却する（+{salePrice(data, owned, card)}G）</button></CardTile>; })}</div> : <p className="deck-candidates-empty">この種類で選べるカードはありません。</p>}
      </div>
      <div className="button-row"><button className="button button--primary" disabled={busy || selectedIds.length !== 4 || selectedSsr > 1} onClick={() => { void transact('saveDeck', { ownedIds: selectedIds }, () => 'デッキを保存しました。'); }}>この４枚を保存</button><a className="button button--ghost" href="#/battle">対戦する</a></div>
    </div>
      : <div role="tabpanel"><p>カードはグー、チョキ、パーの順です。まだ持っていないカードは暗く表示されます。</p><div className="economy-grid economy-catalog">{data.cardMaster.filter((card) => card.image).sort(compareCards).map((card) => { const count = data.ownedCards.filter((owned) => owned.cardId === card.cardId).length; return <article key={card.cardId} className={`economy-card panel economy-card--${card.rarity.toLowerCase()}`}><img src={cardImage(card)} className={count ? '' : 'is-locked'} alt={count ? `${card.name}のカード表面` : '未所持のカード'} /><div className="economy-card__name"><strong>{count ? card.name : '未所持のカード'}</strong><span className={`economy-rarity economy-rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</span></div><small>所持 {count} 枚</small></article>; })}</div></div>}
    {message && <p className="economy-message" role="status">{message}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a></section></>;
}
