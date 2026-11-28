import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { getCard } from '../data/cards';
import { CHRISTMAS_FRAME_ID } from '../data/frames';
import { callApi, isGuest, savedSession, type BootstrapData, type EconomyState, type PlayerFrame } from './api';
import { patchBootstrapCache } from './bootstrapCache';
import './christmas.css';

export function FrameCollection({ data, session, onChange }: { data: BootstrapData; session: string; onChange: (state: EconomyState) => void }) {
  const frame = data.frames?.find((item) => item.frameId === CHRISTMAS_FRAME_ID);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const equip = async (ownedId: string) => {
    setBusy(true); setError('');
    try { onChange(await callApi<EconomyState>('equipFrame', session, { frameId: CHRISTMAS_FRAME_ID, ownedId })); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  return <section className="frame-collection panel"><div><p className="eyebrow">MY FRAME</p><h2>白銀のクリスマスフレーム</h2><p>装着カードの効果発動でHP＋10。最大HPを超えて回復できます。</p><p>付け替え無料・消費なし・イベント終了後も使えます。</p></div>
    {!frame ? <p>クリスマスイベントの4つのミッションを達成すると獲得できます。<a href="#/christmas">イベントを見る →</a></p> : <><p>デッキの4枚から装着先を選んでください。現在の装着先：{data.ownedCards.find((card) => card.ownedId === frame.equippedOwnedId) ? getCard(data.ownedCards.find((card) => card.ownedId === frame.equippedOwnedId)!.cardId).name : 'なし'}</p><div className="christmas-deck">{data.lastDeck.map((id) => data.ownedCards.find((item) => item.ownedId === id)).filter((item) => !!item).map((owned) => <button key={owned.ownedId} className="frame-choice" disabled={busy || owned.ownedId === frame.equippedOwnedId} onClick={() => void equip(owned.ownedId)}><Card card={getCard(owned.cardId)} frameId={owned.frameId} width={155} /><strong>{getCard(owned.cardId).name}</strong><span>{owned.frameId ? '装着中 ✓' : 'このカードに装着'}</span></button>)}</div>{!data.lastDeck.length && <p>先にデッキの4枚を保存してください。</p>}<button className="button button--ghost" disabled={busy || !frame.equippedOwnedId} onClick={() => void equip('')}>{busy ? '装着先を保存中…' : 'フレームを外す'}</button></>}
    {error && <p className="portal-error" role="alert">{error}</p>}
  </section>;
}

export function FrameReward() {
  const [pending, setPending] = useState<{ session: string; frame: PlayerFrame } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ session: string; frames: PlayerFrame[] }>).detail;
      const frame = detail.frames.find((item) => !item.noticeSeen && item.frameId === CHRISTMAS_FRAME_ID);
      if (frame && savedSession() === detail.session && !isGuest(detail.session)) setPending({ session: detail.session, frame });
    };
    window.addEventListener('g-card-frame-reward', receive);
    return () => window.removeEventListener('g-card-frame-reward', receive);
  }, []);
  useEffect(() => { if (pending) dialog.current?.showModal(); }, [pending]);
  const close = async (equip: boolean) => {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      const result = await callApi<{ frames: PlayerFrame[] }>('ackFrame', pending.session, { frameId: pending.frame.frameId });
      patchBootstrapCache(pending.session, (data) => ({ ...data, frames: result.frames }));
      dialog.current?.close(); setPending(null); if (equip) location.hash = '#/collection';
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  return <dialog className="christmas-reward" ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) { dialog.current?.close(); setPending(null); } }}><div className="christmas-reward__shine" aria-hidden="true" /><p className="eyebrow">ALL MISSIONS COMPLETE</p><h1>白銀のフレームを獲得！</h1><div className="christmas-reward__content"><Card card={getCard('G006')} frameId={CHRISTMAS_FRAME_ID} /><div><h2>効果発動でHP＋10</h2><p>最大HPを超えて回復！<br />雪が降り、結晶がきらめく特別なフレームです。</p><ol><li>「デッキ・図鑑」を開く</li><li>「フレーム」タブでデッキのカードを選ぶ</li><li>そのカードを対戦に入れる</li></ol><p>無料で付け替え可能。イベント終了後も使えます。</p></div></div>{error && <p role="alert">{error}</p>}<div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void close(true)}>{busy ? '記録中…' : 'フレームを装着する'}</button><button className="button button--ghost" disabled={busy} onClick={() => void close(false)}>あとで装着する</button></div></dialog>;
}
