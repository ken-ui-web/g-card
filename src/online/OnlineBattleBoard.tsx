import type { ReactNode } from 'react';
import { Card } from '../components/Card';
import { getCard, typeLabels } from '../data/cards';
import type { OnlineEntry, OnlineView } from './protocol';

type Side = 0 | 1;

function LifeBar({ name, life, maxLife, side }: { name: string; life: number; maxLife: number; side: 'self' | 'other' }) {
  const percent = Math.max(0, Math.min(100, life / maxLife * 100));
  return <div className={`life life--${side}`}>
    <div className="life__row"><strong>{name}</strong><span>{life} / {maxLife}</span></div>
    <div className="life__track" role="progressbar" aria-label={`${name}のライフ`} aria-valuemin={0} aria-valuemax={maxLife} aria-valuenow={life}>
      <span style={{ width: `${percent}%`, backgroundColor: percent > 50 ? '#3dd68c' : percent > 25 ? '#ffd057' : '#f15d62' }} />
    </div>
  </div>;
}

function OpponentCard({ view, side, index }: { view: OnlineView; side: Side; index: number }) {
  const enemy = side === 0 ? 1 : 0;
  const known = view.knownTo?.[side]?.includes(index) ? view.known?.[enemy]?.[index] : undefined;
  const hidden = view.hidden?.[enemy]?.[index];
  const type = hidden ? 'unknown' : view.types[enemy][index];
  return <div className="back-card">
    <Card card={getCard(known?.cardId ?? (view.ssr[enemy][index] ? 'C014' : 'G001'))} side={known ? 'front' : 'back'} backType={known ? undefined : type} />
    <span>{known ? getCard(known.cardId).name : hidden ? '種類不明' : typeLabels[view.types[enemy][index]]}</span>
  </div>;
}

function cardDamage(entry: OnlineEntry): number | null {
  const card = getCard(entry.cardId);
  const effect = card.effects.find((item) => item.type === 'damage');
  return effect?.type === 'damage' ? effect.amount + (card.type === 'rock' ? (entry.trainLevel + (card.trainingBonus ?? 0)) * card.trainingMultiplier : 0) : null;
}

export function OnlineBattleBoard({ view, side, entries, opponentName, busy, waiting, onPick, children }: {
  view: OnlineView; side: Side; entries: OnlineEntry[] | null; opponentName: string; busy: boolean; waiting: boolean;
  onPick: (index: number) => void; children?: ReactNode;
}) {
  const enemy = side === 0 ? 1 : 0;
  const opponentIndices = view.types[enemy].map((_, index) => index).filter((index) => !view.used[enemy].includes(index));
  const ownIndices = entries?.map((_, index) => index).filter((index) => !view.used[side].includes(index)) ?? [];
  const blind = view.blind?.[side] === true;
  const forced = view.required?.[side];
  const choosing = view.phase === 'select' && !waiting;
  return <section className="battle-page online-battle-board">
    <div className="battle-heading"><div><p className="eyebrow">BATTLE ARENA</p><h1>ラウンド {view.round} <span>/ 4</span></h1></div><span className="round-pill">オンライン対戦</span></div>
    <div className="life-grid"><LifeBar name="あなた" life={view.life[side]} maxLife={view.maxLife[side]} side="self" /><LifeBar name={opponentName} life={view.life[enemy]} maxLife={view.maxLife[enemy]} side="other" /></div>
    <div className="selection-board panel">
      <div className="hand-block"><div className="hand-block__heading"><h3>{opponentName}のカード</h3><span>残り {opponentIndices.length} 枚</span></div>
        <div className="back-row">{opponentIndices.map((index) => <OpponentCard key={index} view={view} side={side} index={index} />)}</div>
      </div>
      <div className="board-divider"><span>VS</span></div>
      <div className="hand-block"><div className="hand-block__heading"><h3>あなたのカード</h3><span>残り {ownIndices.length} 枚</span></div>
        {choosing && entries && ownIndices.length === 1 && !blind ? (() => {
          const index = ownIndices[0];
          const entry = view.known?.[side]?.[index] ?? entries[index];
          const card = getCard(entry.cardId);
          return <div className="final-open"><Card card={card} damage={cardDamage(entry)} width={190} /><div><p className="eyebrow">FINAL ROUND</p><h2>最後の1枚</h2><p>{card.name}を出します。公開の準備ができたら押してください。</p><button type="button" className="button button--primary" disabled={busy || forced !== null && forced !== undefined && forced !== index} onClick={() => onPick(index)}>オープン！</button></div></div>;
        })() : choosing && entries ? <><p>30秒以内にカードを選んでください。</p><div className="select-grid">{ownIndices.map((index) => {
          const entry = view.known?.[side]?.[index] ?? entries[index];
          const card = getCard(entry.cardId);
          return <button type="button" className="select-card" key={index} disabled={busy || forced !== null && forced !== undefined && forced !== index} onClick={() => onPick(index)}>
            <Card card={card} side={blind ? 'back' : 'front'} backType={blind ? 'unknown' : undefined} damage={blind ? null : cardDamage(entry)} />
            <strong>{blind ? 'ランダムで選択' : card.name}</strong><span>{blind ? 'カードの中身は見えません' : `${typeLabels[view.types[side][index]]} · ${card.text}`}</span><small>{forced === index ? 'このカードを出します' : 'このカードを出す'}</small>
          </button>;
        })}</div></> : waiting ? <p role="status">相手のカード決定を待っています…</p> : children}
      </div>
    </div>
  </section>;
}
