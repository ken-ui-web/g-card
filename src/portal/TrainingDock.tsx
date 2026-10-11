export function TrainingDock({ visible, balance, maxLife, tab, onTab, draftCount, draftCost, submitting, saveDisabled, onSave, onDiscard }: {
  visible: boolean;
  balance: number;
  maxLife: number;
  tab: 'muscle' | 'run';
  onTab: (tab: 'muscle' | 'run') => void;
  draftCount: number;
  draftCost: number;
  submitting: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!visible) return null;
  return <div className="economy-training-dock" role="region" aria-label="トレーニングの状況と操作">
    <div className="economy-training-dock__stats">
      <span><small>{draftCount ? '費用差引後' : '所持'}</small><strong>{Number.isFinite(balance) ? balance.toLocaleString() : '要確認'} G</strong></span>
      <span><small>ライフ</small><strong>{maxLife}</strong></span>
    </div>
    <div className="economy-training-dock__tabs" role="group" aria-label="トレーニングの種類">
      <button type="button" aria-pressed={tab === 'muscle'} onClick={() => onTab('muscle')}>筋トレ</button>
      <button type="button" aria-pressed={tab === 'run'} onClick={() => onTab('run')}>走り込み</button>
    </div>
    {draftCount > 0 && <div className="economy-training-dock__draft">
      <span><strong>仮 {draftCount}回</strong><small>合計 {Number.isFinite(draftCost) ? draftCost.toLocaleString() : '要確認'}G</small></span>
      <button type="button" className="button button--primary" disabled={saveDisabled} onClick={onSave}>{submitting ? '保存結果を確認' : '筋トレを終了する'}</button>
      {!submitting && <button type="button" className="economy-training-dock__discard" onClick={onDiscard}>選び直す</button>}
    </div>}
  </div>;
}
