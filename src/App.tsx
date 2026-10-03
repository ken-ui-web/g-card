import { useEffect, useRef, useState } from 'react';
import { Card } from './components/Card';
import { availableCards, defaultDeckIds, getCard, type CardDefinition, typeLabels } from './data/cards';
import { beginRound, createBattle, finalDamage, finishRound, targetOptions, type BattleCard, type BattleEvent, type BattleMode, type BattleState, type DeckEntry, type PlayerIndex, type RoundLog } from './game/battle';
import { chooseCpuCard, chooseCpuDeck, chooseCpuTarget, nextRandom, toCpuView, type CpuLevel } from './game/cpu';
import { defaultSettings, loadSettings, saveSettings, type TuningSettings } from './game/settings';
import { Portal } from './portal/Portal';
import { callApi, portalConfigured, savedSession, type BootstrapData, type EconomyState } from './portal/api';
import './styles.css';

type Screen = 'menu' | 'deck' | 'battle' | 'result';
type BattleUi = 'handoff' | 'select' | 'thinking' | 'round-intro' | 'reveal' | 'target' | 'summary';
type IntroStage = 'title' | 'suspense';
type RevealStage = 'backs' | 'flipping' | 'fronts';

function configuredDamage(card: CardDefinition, settings: TuningSettings): number | null {
  const effect = card.effects.find((item) => item.type === 'damage');
  return effect?.type === 'damage' ? settings.damages[card.cardId] ?? effect.amount : null;
}

function cardText(card: CardDefinition, settings: TuningSettings): string {
  const healing = card.effects.find((effect) => effect.type === 'heal');
  if (healing?.type === 'heal') return `ライフを${settings.heals[card.cardId] ?? healing.amount}回復`;
  const damage = configuredDamage(card, settings);
  return damage === null ? card.text : `最終ダメージ ${damage}`;
}

function LifeBar({ name, life, maxLife, side }: { name: string; life: number; maxLife: number; side: 'self' | 'other' }) {
  const percent = Math.max(0, Math.min(100, (life / maxLife) * 100));
  return (
    <div className={`life life--${side}`}>
      <div className="life__row"><strong>{name}</strong><span>{life} / {maxLife}</span></div>
      <div className="life__track" role="progressbar" aria-label={`${name}のライフ`} aria-valuemin={0} aria-valuemax={maxLife} aria-valuenow={life}>
        <span style={{ width: `${percent}%`, backgroundColor: percent > 50 ? '#3dd68c' : percent > 25 ? '#ffd057' : '#f15d62' }} />
      </div>
    </div>
  );
}

function BackRow({ cards, title }: { cards: BattleCard[]; title: string }) {
  return (
    <div className="hand-block">
      <div className="hand-block__heading"><h3>{title}</h3><span>残り {cards.length} 枚</span></div>
      <div className="back-row">
        {cards.map((instance) => (
          <div className="back-card" key={instance.instanceId}>
            <Card card={getCard(instance.cardId)} side="back" backType={instance.currentType} />
            <span>{typeLabels[instance.currentType]}{instance.currentType !== instance.originalType ? '・変化' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundEvent({ event, names }: { event: BattleEvent; names: [string, string] }) {
  if (event.kind === 'tie') return <p className="event-line">あいこ。効果は発動しません。</p>;
  if (event.kind === 'damage') return <p className="event-line event-line--damage"><strong>{event.amount} ダメージ！</strong> {names[event.target]}のライフが減りました。</p>;
  if (event.kind === 'heal') return <p className="event-line event-line--heal">{event.amount > 0 ? <><strong>{event.amount} 回復！</strong> {names[event.actor]}のライフが増えました。</> : `${names[event.actor]}のライフは満タンです。`}</p>;
  if (event.kind === 'change') return <p className="event-line">{names[event.actor]}の手品！ 相手の残りカード1枚を【{typeLabels[event.to]}】に変えました。</p>;
  return <p className="event-line">手品の対象がありません。効果は発動しません。</p>;
}

function TuningPage({ settings, onChange }: { settings: TuningSettings; onChange: (next: TuningSettings) => void }) {
  const setNumber = (field: 'initialLife' | 'cpuMaxLife' | 'cpuTraining', value: string) => {
    const number = Number(value);
    const minimum = field === 'cpuTraining' ? 0 : 1;
    const maximum = field === 'cpuTraining' ? 99 : 999;
    onChange({ ...settings, [field]: Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : minimum });
  };
  const setDamage = (cardId: string, value: string) => {
    const number = Number(value);
    onChange({ ...settings, damages: { ...settings.damages, [cardId]: Number.isFinite(number) ? Math.min(999, Math.max(0, Math.round(number))) : 0 } });
  };
  const setHeal = (cardId: string, value: string) => {
    const number = Number(value);
    onChange({ ...settings, heals: { ...settings.heals, [cardId]: Number.isFinite(number) ? Math.min(999, Math.max(0, Math.round(number))) : 0 } });
  };
  return (
    <main className="app-shell">
      <header className="app-header"><a className="brand" href="#/battle"><span>G</span><strong>Gカード</strong></a><a className="text-link" href="#/battle">対戦メニューへ</a></header>
      <section className="tuning-page panel">
        <p className="eyebrow">DEVELOPMENT SETTINGS</p>
        <h1>試作用の調整</h1>
        <p>数値はこの端末に保存され、次に始める対戦から反映されます。カード画像内の効果文は初期値のままです。変更したダメージはカード右上、回復量はカード下の説明で確認してください。</p>
        <div className="tuning-grid">
          <label>初期ライフ<input type="number" min="1" max="999" value={settings.initialLife} onChange={(event) => setNumber('initialLife', event.target.value)} /></label>
          <label>CPUの最大ライフ<input type="number" min="1" max="999" value={settings.cpuMaxLife} onChange={(event) => setNumber('cpuMaxLife', event.target.value)} /></label>
          <label>CPUの筋トレ値<input type="number" min="0" max="99" value={settings.cpuTraining} onChange={(event) => setNumber('cpuTraining', event.target.value)} /></label>
          {availableCards.filter((card) => card.effects.some((effect) => effect.type === 'damage')).map((card) => (
            <label key={card.cardId}>{card.name}の基本ダメージ<input type="number" min="0" max="999" value={settings.damages[card.cardId]} onChange={(event) => setDamage(card.cardId, event.target.value)} /></label>
          ))}
          <label>救急箱の回復量<input type="number" min="0" max="999" value={settings.heals.P003} onChange={(event) => setHeal('P003', event.target.value)} /></label>
          <label>演出の速さ<select value={settings.animationSpeed} onChange={(event) => onChange({ ...settings, animationSpeed: Number(event.target.value) })}>
            <option value={0.5}>ゆっくり</option><option value={1}>標準</option><option value={2}>速い</option>
          </select></label>
        </div>
        <div className="button-row"><button className="button button--ghost" onClick={() => onChange({ ...defaultSettings, damages: { ...defaultSettings.damages }, heals: { ...defaultSettings.heals } })}>初期値に戻す</button><a className="button button--primary" href="#/battle">対戦メニューへ</a></div>
      </section>
    </main>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [settings, setSettings] = useState<TuningSettings>(loadSettings);
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<BattleMode>('cpu');
  const [level, setLevel] = useState<CpuLevel>(1);
  const [localNames, setLocalNames] = useState<[string, string]>(['', '']);
  const [names, setNames] = useState<[string, string]>(['あなた', 'CPU Lv1']);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(defaultDeckIds);
  const [deckMode, setDeckMode] = useState<'sample' | 'owned'>('sample');
  const [account, setAccount] = useState<BootstrapData | null>(null);
  const [ownedSelection, setOwnedSelection] = useState<string[]>([]);
  const [reward, setReward] = useState<EconomyState | null>(null);
  const [rewardError, setRewardError] = useState('');
  const [deckError, setDeckError] = useState('');
  const [starting, setStarting] = useState(false);
  const battleId = useRef('');
  const reportingId = useRef('');
  const [ui, setUi] = useState<BattleUi>('select');
  const [turn, setTurn] = useState<PlayerIndex>(0);
  const [firstPick, setFirstPick] = useState<string | null>(null);
  const [introStage, setIntroStage] = useState<IntroStage>('title');
  const [revealStage, setRevealStage] = useState<RevealStage>('backs');
  const [canFlip, setCanFlip] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const seed = useRef(Date.now() >>> 0);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => {
    const session = savedSession();
    if (hash !== '#/battle' || !session || !portalConfigured) return;
    let cancelled = false;
    callApi<BootstrapData>('bootstrap', session).then((data) => {
      if (cancelled) return;
      setAccount(data);
      const samplePool = data.battleConfig?.find((deck) => deck.deckId === 'sample')?.cardIds.filter((id) => availableCards.some((card) => card.cardId === id));
      if (samplePool && samplePool.length >= 4) setSelectedDeckIds((selected) => {
        const valid = selected.filter((id) => samplePool.includes(id));
        return valid.length === 4 ? valid : samplePool.slice(0, 4);
      });
      const playable = data.ownedCards.filter((owned) => availableCards.some((card) => card.cardId === owned.cardId));
      const valid = data.lastDeck.filter((id) => playable.some((card) => card.ownedId === id));
      setOwnedSelection(valid.length === 4 ? valid : playable.slice(0, 4).map((card) => card.ownedId));
    }).catch(() => { if (!cancelled) setAccount(null); });
    return () => { cancelled = true; };
  }, [hash]);
  useEffect(() => {
    if (ui === 'round-intro' || ui === 'reveal') window.scrollTo(0, 0);
  }, [ui]);
  useEffect(() => {
    if (ui !== 'round-intro') return;
    const timer = window.setTimeout(() => {
      if (introStage === 'title') setIntroStage('suspense');
      else setUi('reveal');
    }, (introStage === 'title' ? 1400 : 2200) / settings.animationSpeed);
    return () => window.clearTimeout(timer);
  }, [ui, introStage, settings.animationSpeed]);
  useEffect(() => {
    if (ui !== 'reveal' || revealStage !== 'backs') return;
    const timer = window.setTimeout(() => setCanFlip(true), 2600 / settings.animationSpeed);
    return () => window.clearTimeout(timer);
  }, [ui, revealStage, settings.animationSpeed]);
  useEffect(() => {
    if (ui !== 'reveal' || revealStage !== 'flipping') return;
    const timer = window.setTimeout(() => setRevealStage('fronts'), 2800 / settings.animationSpeed);
    return () => window.clearTimeout(timer);
  }, [ui, revealStage, settings.animationSpeed]);
  useEffect(() => {
    if (ui !== 'thinking' || !battle || !firstPick) return;
    const draw = nextRandom(seed.current);
    seed.current = draw.seed;
    const timer = window.setTimeout(() => {
      const decision = chooseCpuCard(toCpuView(battle), level, seed.current);
      seed.current = decision.seed;
      setBattle(beginRound(battle, [firstPick, decision.id]));
      setFirstPick(null);
      setIntroStage('title');
      setRevealStage('backs');
      setCanFlip(false);
      setUi('round-intro');
    }, (800 + draw.value * 700) / settings.animationSpeed);
    return () => window.clearTimeout(timer);
  }, [ui, battle, firstPick, level, settings.animationSpeed]);

  const startGame = async () => {
    const usingOwned = mode === 'cpu' && deckMode === 'owned';
    if (usingOwned ? ownedSelection.length !== 4 : selectedDeckIds.length !== 4) return;
    if (usingOwned) {
      const session = savedSession();
      if (!session) { setDeckError('学校アカウントでログインしてください'); return; }
      setStarting(true); setDeckError('');
      try { await callApi<EconomyState>('saveDeck', session, { ownedIds: ownedSelection }); }
      catch (error) { setDeckError((error as Error).message); setStarting(false); return; }
      setStarting(false);
    }
    setNames(mode === 'cpu' ? ['あなた', `CPU Lv${level}`] : [localNames[0].trim() || 'プレイヤー1', localNames[1].trim() || 'プレイヤー2']);
    seed.current = Date.now() >>> 0;
    const ownEntries: DeckEntry[] = usingOwned ? ownedSelection.map((id) => {
      const owned = account!.ownedCards.find((card) => card.ownedId === id)!;
      return { cardId: owned.cardId, ownedId: id, trainLevel: owned.trainLevel };
    }) : selectedDeckIds;
    const cpuConfig = account?.battleConfig?.find((deck) => deck.deckId === `cpu-${level}`);
    const sampleConfig = account?.battleConfig?.find((deck) => deck.deckId === 'sample');
    const cpuPool = cpuConfig?.cardIds.filter((id) => availableCards.some((card) => card.cardId === id));
    const cpuDeck = mode === 'cpu' ? chooseCpuDeck(ownEntries.map((entry) => typeof entry === 'string' ? entry : entry.cardId), level, seed.current, cpuPool && cpuPool.length >= 4 ? cpuPool : undefined) : null;
    if (cpuDeck) seed.current = cpuDeck.seed;
    setBattle(createBattle(mode, {
      initialLife: usingOwned ? account!.profile.maxLife : sampleConfig?.maxLife ?? settings.initialLife,
      cpuMaxLife: cpuConfig?.maxLife ?? settings.cpuMaxLife,
      cpuTraining: cpuConfig?.rockTrainLevel ?? settings.cpuTraining,
      damages: { ...settings.damages },
      heals: { ...settings.heals },
    }, seed.current, [ownEntries, cpuDeck?.ids ?? selectedDeckIds]));
    battleId.current = crypto.randomUUID();
    reportingId.current = '';
    setReward(null);
    setRewardError('');
    setTurn(0);
    setFirstPick(null);
    setSelectedTarget(null);
    setUi(mode === 'local' ? 'handoff' : 'select');
    setScreen('battle');
  };

  const toggleDeckCard = (cardId: string) => {
    setSelectedDeckIds((selected) => selected.includes(cardId)
      ? selected.filter((id) => id !== cardId)
      : selected.length < 4 ? [...selected, cardId] : selected);
  };
  const toggleOwnedCard = (ownedId: string) => setOwnedSelection((selected) => selected.includes(ownedId)
    ? selected.filter((id) => id !== ownedId)
    : selected.length < 4 ? [...selected, ownedId] : selected);

  const reportResult = async () => {
    const session = savedSession();
    if (!session || !battle || mode !== 'cpu' || !battleId.current || reportingId.current === battleId.current) return;
    reportingId.current = battleId.current;
    setRewardError('');
    try {
      const result = await callApi<EconomyState>('reportBattle', session, {
        battleId: battleId.current, mode: 'cpu', deckMode, cpuLevel: level,
        result: battle.outcome === 0 ? 'win' : battle.outcome === 'draw' ? 'draw' : 'loss',
      });
      setReward(result);
    } catch (failure) {
      reportingId.current = '';
      setRewardError((failure as Error).message);
    }
  };
  useEffect(() => { if (screen === 'result' && mode === 'cpu' && battle?.outcome !== null && account?.economy?.enabled && savedSession()) void reportResult(); }, [screen, battle?.outcome, account?.economy?.enabled]);

  const selectCard = (id: string) => {
    if (!battle) return;
    if (mode === 'cpu') {
      setFirstPick(id);
      setUi('thinking');
      return;
    }
    if (turn === 0) {
      setFirstPick(id);
      setTurn(1);
      setUi('handoff');
      return;
    }
    if (!firstPick) return;
    setBattle(beginRound(battle, [firstPick, id]));
    setFirstPick(null);
    setIntroStage('title');
    setRevealStage('backs');
    setCanFlip(false);
    setUi('round-intro');
  };

  const commitRound = (targetId?: string) => {
    if (!battle) return;
    setBattle(finishRound(battle, targetId));
    setSelectedTarget(null);
    setUi('summary');
  };

  const resolveReveal = () => {
    if (!battle) return;
    const choices = targetOptions(battle);
    if (choices.length === 0) { commitRound(); return; }
    if (mode === 'cpu' && battle.reveal?.winner === 1) {
      const decision = chooseCpuTarget(toCpuView(battle), level, seed.current);
      seed.current = decision.seed;
      commitRound(decision.id);
    } else {
      setSelectedTarget(null);
      setUi('target');
    }
  };

  const nextRound = () => {
    if (!battle) return;
    if (battle.outcome !== null) { setScreen('result'); return; }
    setTurn(0);
    setUi(mode === 'local' ? 'handoff' : 'select');
  };

  if (hash === '#/dev/tuning') return <TuningPage settings={settings} onChange={setSettings} />;
  if (hash === '#/home' || hash === '#/admin' || hash === '#/shop' || hash === '#/training' || hash === '#/collection' || (!hash && portalConfigured)) {
    const page = hash === '#/admin' ? 'admin' : hash === '#/shop' ? 'shop' : hash === '#/training' ? 'training' : hash === '#/collection' ? 'collection' : 'home';
    return <Portal page={page} />;
  }

  const current = battle?.players[turn];
  const opponent = battle?.players[turn === 0 ? 1 : 0];
  const log = battle?.history.at(-1);
  const sampleCards = availableCards.filter((card) => !account?.battleConfig?.length || account.battleConfig.find((deck) => deck.deckId === 'sample')?.cardIds.includes(card.cardId));
  const reveal = battle?.reveal;
  const winnerName = (winner: PlayerIndex | null) => winner === null ? 'あいこ！' : `${names[winner]}の勝ち！`;

  return (
    <main className="app-shell">
      <header className="app-header">
        <button type="button" className="brand brand--button" onClick={() => setScreen('menu')}><span>G</span><strong>Gカード</strong></button>
        <nav><a className="text-link" href="#/home">ホーム</a><button type="button" className="text-link" onClick={() => setScreen('menu')}>対戦メニュー</button><a className="text-link" href="#/dev/tuning">試作用の調整</a></nav>
      </header>

      {screen === 'menu' && <>
        <section className="hero">
          <div className="hero__copy"><p className="eyebrow">G CARD BATTLE</p><h1>見せるのは手の形。<br /><em>勝負はカードの中身。</em></h1><p>サンプルカードか、自分が持っているカードから4枚を選んで対戦できます。</p></div>
          <div className="hero__cards">{availableCards.filter((card) => selectedDeckIds.includes(card.cardId)).map((card) => <Card key={card.cardId} card={card} damage={configuredDamage(card, settings)} />)}</div>
        </section>
        <section className="panel mode-panel"><div className="section-heading"><span>01</span><div><h2>対戦モードを選ぶ</h2><p>CPU対戦は学校アカウントでログインしていると、勝利報酬を受け取れます。</p></div></div>
          <div className="mode-grid">
            <button type="button" className={`mode-option ${mode === 'cpu' ? 'is-active' : ''}`} onClick={() => setMode('cpu')} aria-pressed={mode === 'cpu'}><span className="mode-option__icon">⚙</span><strong>CPUと対戦</strong><small>レベルを選んで1人でプレイ</small></button>
            <button type="button" className={`mode-option ${mode === 'local' ? 'is-active' : ''}`} onClick={() => setMode('local')} aria-pressed={mode === 'local'}><span className="mode-option__icon">↔</span><strong>この端末で対戦</strong><small>交代で端末を渡して2人でプレイ</small></button>
          </div>
          {mode === 'cpu' ? <div className="level-picker"><strong>CPUのレベル</strong><div>{([1, 2, 3] as CpuLevel[]).map((value) => <button type="button" key={value} aria-pressed={level === value} onClick={() => setLevel(value)}>Lv{value}<small>{value === 1 ? 'ランダム' : value === 2 ? '種類を読む' : '先を読む'}</small></button>)}</div></div> : <div className="name-grid"><label>プレイヤー1の名前<input value={localNames[0]} maxLength={16} placeholder="プレイヤー1" onChange={(event) => setLocalNames([event.target.value, localNames[1]])} /></label><label>プレイヤー2の名前<input value={localNames[1]} maxLength={16} placeholder="プレイヤー2" onChange={(event) => setLocalNames([localNames[0], event.target.value])} /></label></div>}
          {mode === 'cpu' && <div className="deck-mode-picker"><strong>使うカードセット</strong><button type="button" aria-pressed={deckMode === 'sample'} onClick={() => setDeckMode('sample')}>サンプルカード</button><button type="button" aria-pressed={deckMode === 'owned'} disabled={!account?.economy?.enabled || account.ownedCards.length < 4} onClick={() => setDeckMode('owned')}>自分のカード</button>{!account?.economy?.enabled && <small>自分のカードはログインとサーバー更新後に選べます。</small>}</div>}
          <div className="button-row"><button type="button" className="button button--primary" onClick={() => setScreen('deck')}>カードセットを見る <span aria-hidden="true">→</span></button></div>
        </section>
      </>}

      {screen === 'deck' && <section className="panel deck-page"><p className="eyebrow">READY YOUR DECK</p><h1>カードを4枚選ぶ</h1><p>{mode === 'cpu' && deckMode === 'owned' ? `所持カードから4枚を選びます（現在 ${ownedSelection.length} / 4 枚）。筋トレ値と最大ライフが反映されます。` : `サンプル${sampleCards.length}枚から4枚を選びます（現在 ${selectedDeckIds.length} / 4 枚）。`} 別のカードを入れるときは、まず選択中の1枚を外してください。</p>
        {mode === 'cpu' && deckMode === 'owned' && account ? <div className="deck-grid">{account.ownedCards.filter((owned) => availableCards.some((card) => card.cardId === owned.cardId)).map((owned) => { const card = getCard(owned.cardId); const selected = ownedSelection.includes(owned.ownedId); const damage = configuredDamage(card, settings); return <button type="button" className={`deck-card ${selected ? 'is-selected' : ''}`} key={owned.ownedId} aria-pressed={selected} disabled={!selected && ownedSelection.length === 4} onClick={() => toggleOwnedCard(owned.ownedId)}><Card card={card} damage={damage === null ? null : damage + owned.trainLevel * card.trainingMultiplier} /><strong>{card.name} · 筋トレ +{owned.trainLevel}</strong><span>{typeLabels[card.type]} · {card.text}</span><small>{selected ? '選択中・押すと外す' : 'このカードを入れる'}</small></button>; })}</div> : <div className="deck-grid">{sampleCards.map((card) => { const selected = selectedDeckIds.includes(card.cardId); return <button type="button" className={`deck-card ${selected ? 'is-selected' : ''}`} key={card.cardId} aria-pressed={selected} disabled={!selected && selectedDeckIds.length === 4} onClick={() => toggleDeckCard(card.cardId)}><Card card={card} damage={configuredDamage(card, settings)} /><strong>{card.name}</strong><span>{typeLabels[card.type]} · {cardText(card, settings)}</span><small>{selected ? '選択中・押すと外す' : 'このカードを入れる'}</small></button>; })}</div>}
        <div className="deck-note"><strong>勝ち方</strong><p>グーはチョキに、チョキはパーに、パーはグーに勝ちます。勝ったカードだけが効果を発動。4ラウンド後、残りライフが多い側の勝利です。</p></div>
        {deckError && <p className="portal-error" role="alert">{deckError}</p>}<div className="button-row"><button type="button" className="button button--ghost" onClick={() => setScreen('menu')}>戻る</button><button type="button" className="button button--primary" disabled={starting || (mode === 'cpu' && deckMode === 'owned' ? ownedSelection : selectedDeckIds).length !== 4} onClick={() => { void startGame(); }}>{starting ? '保存中…' : '対戦を始める'}</button></div>
      </section>}

      {screen === 'battle' && battle && <section className="battle-page">
        <div className="battle-heading"><div><p className="eyebrow">BATTLE ARENA</p><h1>ラウンド {battle.round} <span>/ 4</span></h1></div><span className="round-pill">{mode === 'cpu' ? `CPU Lv${level}` : 'この端末で対戦'}</span></div>
        {ui !== 'round-intro' && ui !== 'reveal' && <div className="life-grid"><LifeBar name={names[0]} life={battle.players[0].life} maxLife={battle.players[0].maxLife} side="self" /><LifeBar name={names[1]} life={battle.players[1].life} maxLife={battle.players[1].maxLife} side="other" /></div>}

        {ui === 'handoff' && <div className="handoff panel"><span className="handoff__icon">↔</span><p className="eyebrow">PASS THE DEVICE</p><h2>{names[turn]}の番です</h2><p>ほかのプレイヤーは画面を見ないでください。準備ができたらカードを選びます。</p><button type="button" className="button button--primary" onClick={() => setUi('select')}>準備できた</button></div>}

        {(ui === 'select' || ui === 'thinking') && current && opponent && <div className="selection-board panel">
          <BackRow cards={opponent.hand} title={`${names[turn === 0 ? 1 : 0]}のカード`} />
          <div className="board-divider"><span>VS</span></div>
          <div className="hand-block"><div className="hand-block__heading"><h3>{names[turn]}のカード</h3><span>残り {current.hand.length} 枚</span></div>
            {ui === 'thinking' ? <div className="thinking"><span className="thinking__gear">⚙</span><h2>CPUが考え中…</h2><p>相手が選んだカードの中身は見ていません。</p></div> : current.hand.length === 1 ? <div className="final-open"><Card card={getCard(current.hand[0].cardId)} damage={finalDamage(current.hand[0], battle.config)} width={190} /><div><p className="eyebrow">FINAL ROUND</p><h2>最後の1枚</h2><p>{cardText(getCard(current.hand[0].cardId), settings)}。このカードを自動で選びます。公開の準備ができたら押してください。</p><button type="button" className="button button--primary" onClick={() => selectCard(current.hand[0].instanceId)}>オープン！</button></div></div> : <div className="select-grid">{current.hand.map((instance) => { const card = getCard(instance.cardId); const damage = finalDamage(instance, battle.config); return <button type="button" className="select-card" key={instance.instanceId} onClick={() => selectCard(instance.instanceId)}><Card card={card} damage={damage} /><strong>{card.name}</strong><span>{typeLabels[instance.currentType]}{instance.currentType !== instance.originalType ? '（手品で変化）' : ''} · {damage === null ? cardText(card, settings) : `最終ダメージ ${damage}`}</span><small>このカードを出す</small></button>; })}</div>}
          </div>
        </div>}

        {ui === 'round-intro' && <div className={`round-intro round-intro--${introStage} panel`} data-stage={introStage} role="status" aria-live="polite">
          {introStage === 'title' ? <><p className="eyebrow">ROUND START</p><div className="round-intro__number">ラウンド {battle.round}</div><p>両者のカードが決まりました</p></> : <div className="round-intro__suspense"><div className="round-intro__versus" aria-hidden="true">VS</div><p>勝負の行方は…</p><div className="round-intro__pulse" aria-hidden="true"><span /><span /><span /></div></div>}
        </div>}

        {ui === 'reveal' && reveal && <div className="reveal-panel panel">
          <p className="eyebrow">CARD REVEAL</p>
          {revealStage === 'backs' ? <div className="reveal-verdict" role="status"><p className="reveal-verdict__types">{typeLabels[reveal.cards[0].currentType]} <span>VS</span> {typeLabels[reveal.cards[1].currentType]}</p><h2>{winnerName(reveal.winner)}</h2><p>{reveal.winner === null ? '種類は同じ。効果は発動しません。' : 'カードの表面で効果を確認しましょう。'}</p></div> : <h2>{winnerName(reveal.winner)}</h2>}
          <div className="reveal-grid">{reveal.cards.map((instance, index) => <div className={`reveal-entry ${revealStage === 'backs' ? 'is-dealt' : ''} ${revealStage === 'backs' && reveal.winner === index ? 'is-winner' : ''}`} key={instance.instanceId}>
            <span>{names[index]}</span>
            <div className={`flip-card ${revealStage !== 'backs' ? 'is-flipped' : ''}`}><div className="flip-card__inner" style={{ transitionDuration: `${950 / settings.animationSpeed}ms` }} onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === 'transform' && revealStage === 'flipping') setRevealStage('fronts'); }}>
              <div className="flip-card__face flip-card__face--back"><Card card={getCard(instance.cardId)} side="back" backType={instance.currentType} /></div>
              <div className="flip-card__face flip-card__face--front" aria-hidden={revealStage !== 'fronts'}><Card card={getCard(instance.cardId)} damage={finalDamage(instance, battle.config)} /></div>
            </div></div>
            {revealStage === 'backs' ? <strong className="reveal-entry__type">{typeLabels[instance.currentType]}{reveal.winner === index ? ' · 勝ち' : reveal.winner === null ? ' · あいこ' : ' · 負け'}</strong> : revealStage === 'fronts' ? <strong className="reveal-entry__type">{getCard(instance.cardId).name}</strong> : null}
          </div>)}</div>
          <div className="button-row">{revealStage === 'backs' && <><p className="reveal-hint">種類と勝敗を見たら、カードをめくろう。</p><button type="button" className="button button--primary" disabled={!canFlip} onClick={() => setRevealStage('flipping')}>{canFlip ? 'カードをめくる' : '勝敗を見てね…'}</button></>}{revealStage === 'fronts' && <button type="button" className="button button--primary" onClick={resolveReveal}>効果を見る</button>}</div>
        </div>}

        {ui === 'target' && reveal && <div className="target-panel panel"><p className="eyebrow">MAGIC EFFECT</p><h2>{names[reveal.winner!]}が対象を選ぶ</h2><p>相手の残りカードを1枚選び、種類を【グー】に変えます。カードの中身は見えません。</p><div className="target-grid">{targetOptions(battle).map((instance) => <button type="button" className={`target-card ${selectedTarget === instance.instanceId ? 'is-selected' : ''}`} key={instance.instanceId} aria-pressed={selectedTarget === instance.instanceId} onClick={() => setSelectedTarget(instance.instanceId)}><Card card={getCard(instance.cardId)} side="back" backType={instance.currentType} /><strong>{typeLabels[instance.currentType]}</strong>{instance.currentType !== instance.originalType && <small>手品で変化</small>}</button>)}</div><button type="button" className="button button--primary" disabled={!selectedTarget} onClick={() => commitRound(selectedTarget!)}>このカードを変える</button></div>}

        {ui === 'summary' && log && <div className="summary-panel panel"><p className="eyebrow">ROUND {log.round} RESULT</p><h2>{winnerName(log.winner)}</h2><div className="summary-cards">{log.cards.map((instance, index) => <div key={instance.instanceId}><span>{names[index]}</span><Card card={getCard(instance.cardId)} damage={finalDamage(instance, battle.config)} width={180} /></div>)}</div><div className="event-box">{log.events.map((event, index) => <RoundEvent key={index} event={event} names={names} />)}</div><button type="button" className="button button--primary" onClick={nextRound}>{battle.outcome !== null ? '結果を見る' : '次のラウンドへ'}</button></div>}
        <div className="battle-footnote">CPU対戦はログイン中、結果画面でGポイントとミッションの進み具合を保存します。この端末での2人対戦に報酬はありません。</div>
      </section>}

      {screen === 'result' && battle && <section className="result-page panel"><p className="eyebrow">BATTLE RESULT</p><h1>{battle.outcome === 'draw' ? '引き分け！' : `${names[battle.outcome!]}の勝ち！`}</h1><div className="result-life"><LifeBar name={names[0]} life={battle.players[0].life} maxLife={battle.players[0].maxLife} side="self" /><LifeBar name={names[1]} life={battle.players[1].life} maxLife={battle.players[1].maxLife} side="other" /></div>{mode === 'cpu' && account?.economy?.enabled && savedSession() ? <div className="result-note" role="status">{reward ? <>獲得したGポイント：{reward.awarded ?? 0}G。今日のCPU報酬：{reward.daily.cpuRewards} / {account?.economy?.cpuRewardDailyCap ?? 3}回。{reward.completedMissions?.map((item) => ` ミッション達成：${item.label} +${item.reward}G`).join('')}</> : rewardError ? <>報酬の保存に失敗しました：{rewardError} <button type="button" className="button button--ghost" onClick={() => { void reportResult(); }}>もう一度送る</button></> : '報酬を確認中…'}</div> : <p className="result-note">この対戦にGポイント報酬はありません。</p>}<h2>ラウンドの記録</h2><ol className="history-list">{battle.history.map((round: RoundLog) => <li key={round.round}><strong>{round.round}R</strong><span>{getCard(round.cards[0].cardId).name} vs {getCard(round.cards[1].cardId).name}</span><b>{round.winner === null ? 'あいこ' : `${names[round.winner]}の勝ち`}</b><small>{round.lifeAfter[0]} – {round.lifeAfter[1]}</small></li>)}</ol><div className="button-row"><button type="button" className="button button--ghost" onClick={() => setScreen('menu')}>対戦メニューへ</button><button type="button" className="button button--primary" disabled={starting} onClick={() => { void startGame(); }}>もう一度対戦</button></div></section>}
      <footer className="app-footer">Gカード · 対戦</footer>
    </main>
  );
}

export default App;
