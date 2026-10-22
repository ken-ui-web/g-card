import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { showRewardCelebration } from '../components/RewardCelebration';
import { getCard, typeLabels } from '../data/cards';
import type { BattleState } from '../game/battle';
import { callApi } from './api';
import { createTutorialBattle, playTutorialRound, tutorialGuide, tutorialOwnCards } from './tutorialBattle';

type TutorialReward = { completed: boolean; awarded: number; gPoint: number };
type Stage = 'intro' | 'pick' | 'reveal' | 'finished';

export function TutorialPage({ session, onPoints }: { session: string; onPoints: (gPoint: number) => void }) {
  const [battle, setBattle] = useState<BattleState>(createTutorialBattle);
  const [stage, setStage] = useState<Stage>('intro');
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reward, setReward] = useState<TutorialReward | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const last = battle.history.at(-1);

  useEffect(() => {
    let active = true;
    void callApi<{ completed: boolean }>('getTutorialStatus', session)
      .then((result) => { if (active) setCompleted(result.completed); })
      .catch(() => { if (active) setCompleted(null); });
    return () => { active = false; };
  }, [session]);

  const choose = (instanceId: string) => {
    if (stage !== 'pick') return;
    setBattle(playTutorialRound(battle, instanceId));
    setStage('reveal');
  };

  const saveCompletion = async () => {
    if (saving || reward) return;
    setSaving(true);
    setError('');
    try {
      const result = await callApi<TutorialReward>('completeTutorial', session);
      setReward(result);
      setCompleted(true);
      onPoints(result.gPoint);
      if (result.awarded) showRewardCelebration({ kind: 'mission', title: 'チュートリアル完了！', amount: result.awarded, detail: '4ラウンドの練習を終えました。' });
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  };

  const advance = () => {
    if (battle.phase === 'finished') {
      setStage('finished');
      void saveCompletion();
    } else setStage('pick');
  };

  return <section className="tutorial-page panel">
    <div className="tutorial-heading"><div><p className="eyebrow">G CARD TUTORIAL</p><h1>4枚で対戦してみよう</h1></div><a className="button button--ghost" href="#/home">ホームへ戻る</a></div>
    <p className="tutorial-lead">サンプルカードで4ラウンドの練習をします。Gは使わず、勝敗も記録されません。初回の完了で50Gを受け取れます。</p>
    <div className="tutorial-progress" aria-label="チュートリアルの進行">{[1, 2, 3, 4].map((round) => <span key={round} className={battle.history.length >= round ? 'is-done' : battle.round === round ? 'is-current' : ''}>{round}</span>)}</div>

    {stage === 'intro' && <>
      <h2>まずはカードの種類を見よう</h2>
      <p>グーはチョキに、チョキはパーに、パーはグーに勝ちます。相手のカードの裏には手の種類が見えますが、どのカードを出すかは公開まで分かりません。</p>
      <div className="tutorial-types"><span>グー <b>→</b> チョキ</span><span>チョキ <b>→</b> パー</span><span>パー <b>→</b> グー</span></div>
      <div className="tutorial-intro-cards">{tutorialOwnCards.map((id) => <div key={id}><Card card={getCard(id)} width={140} /><strong>{getCard(id).name}</strong><small>{typeLabels[getCard(id).type]}</small></div>)}</div>
      <button type="button" className="button button--primary" onClick={() => setStage('pick')}>練習対戦を始める</button>
    </>}

    {stage === 'pick' && <>
      <h2>ラウンド {battle.round} / 4</h2>
      <p className="tutorial-guide">{tutorialGuide[battle.round - 1]}</p>
      <div className="tutorial-life"><span>あなた <strong>{battle.players[0].life} / 100</strong></span><span>CPU <strong>{battle.players[1].life} / 100</strong></span></div>
      <h3>相手の残りカード</h3>
      <div className="tutorial-opponent">{battle.players[1].hand.map((instance) => <div key={instance.instanceId}><Card card={getCard(instance.cardId)} side="back" backType={instance.currentType} width={76} /><span>{typeLabels[instance.currentType]}</span></div>)}</div>
      <h3>出すカードを選ぶ</h3>
      <div className="tutorial-hand">{battle.players[0].hand.map((instance) => {
        const card = getCard(instance.cardId);
        return <button type="button" key={instance.instanceId} onClick={() => choose(instance.instanceId)}><Card card={card} width={145} /><strong>{card.name}</strong><small>{typeLabels[card.type]} · {card.text}</small></button>;
      })}</div>
    </>}

    {stage === 'reveal' && last && <>
      <p className="eyebrow">ROUND {last.round} RESULT</p>
      <h2>{last.winner === null ? 'あいこ！' : last.winner === 0 ? 'あなたの勝ち！' : 'CPUの勝ち！'}</h2>
      <p>{last.winner === null ? '同じ手なので、通常のカード効果は発動しません。' : '勝ったカードの効果が発動しました。'}</p>
      <div className="tutorial-reveal">{last.cards.map((instance, index) => <div key={instance.instanceId} className={last.winner === index ? 'is-winner' : ''}><strong>{index === 0 ? 'あなた' : 'CPU'}</strong><Card card={getCard(instance.cardId)} width={175} /><span>{getCard(instance.cardId).name}</span></div>)}</div>
      <div className="tutorial-life"><span>あなた <strong>{last.lifeAfter[0]} / 100</strong></span><span>CPU <strong>{last.lifeAfter[1]} / 100</strong></span></div>
      <button type="button" className="button button--primary" onClick={advance}>{battle.phase === 'finished' ? '結果を見る' : '次のラウンドへ'}</button>
    </>}

    {stage === 'finished' && <div className="tutorial-finished">
      <h2>練習対戦、完了！</h2>
      <p>{battle.outcome === 'draw' ? '引き分けでした。' : battle.outcome === 0 ? 'あなたの勝ちです！' : '今回はCPUの勝ちです。'} 勝敗に関係なく、最後まで遊べばチュートリアル完了です。</p>
      {saving ? <p role="status"><span className="loading-state__spinner loading-state__spinner--small" aria-hidden="true" />50Gの受け取りを記録中…</p>
        : reward ? <p className="tutorial-reward" role="status">{reward.awarded ? `＋${reward.awarded}G を受け取りました！ 所持 ${reward.gPoint.toLocaleString()}G` : '50Gの初回特典は受け取り済みです。'}</p>
          : <p>{completed ? '50Gの初回特典は受け取り済みです。' : '初回特典：50G'}</p>}
      {error && <p className="portal-error" role="alert">保存できませんでした：{error}</p>}
      {error && <button type="button" className="button button--primary" disabled={saving} onClick={() => { void saveCompletion(); }}>もう一度受け取る</button>}
      <div className="button-row"><a className="button button--ghost" href="#/home">ホームへ</a><a className="button button--ghost" href="#/battle">CPUと対戦する</a><a className="button button--ghost" href="#/shop">カードを見に行く</a></div>
    </div>}
  </section>;
}
