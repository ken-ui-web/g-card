import { useEffect, useState } from 'react';
import { callApi, type CardMaster } from './api';
import { patchBootstrapCache } from './bootstrapCache';
import { collectEconomyChanges, markEconomyChangeSaved, validateEconomyChanges, type AdminData } from './adminEconomyChanges';
import { LoadingState } from '../components/LoadingState';
import { typeLabels } from '../data/cards';
import { compareCards } from '../data/cardOrder';
import { packArtKey, packArtOptions, packArtUrl } from './packArt';

type Pack = AdminData['packs'][number];
type Deck = AdminData['decks'][number];
const missionConditions = [['win_battle','対戦で勝つ'],['play_cpu','CPUと対戦'],['train','トレーニング'],['open_pack','パックを開ける'],['login','ログイン'],['submit_test','テストを受ける'],['perfect_test','テスト満点'],['submit_reflection','振り返りを提出'],['play_online','オンラインで対戦']];
export function DeckEditor({ deck, cards, onChange }: { deck: Deck; cards: CardMaster[]; onChange: (value: Deck) => void }) {
  const groups = (['rock', 'scissors', 'paper'] as const).map((type) => ({ type, cards: cards.filter((card) => card.type === type).sort(compareCards) }));
  return <details className="admin-deck-editor"><summary>{deck.name}<span>{deck.cardIds.length} / {cards.length}枚を候補に設定</span></summary>
    <p>4〜40枚を選べます。販売を停止しているカードも、サンプル・CPU対戦には使用できます。</p>
    <div className="admin-deck-settings"><label>最大ライフ<input type="number" min="1" max="9999" value={deck.maxLife} onChange={(event) => onChange({ ...deck, maxLife: Number(event.target.value) })} /></label><label>CPUの筋トレ値<input type="number" min="0" max="99" value={deck.rockTrainLevel} onChange={(event) => onChange({ ...deck, rockTrainLevel: Number(event.target.value) })} /></label></div>
    {groups.map(({ type, cards: typeCards }) => <section className="admin-deck-group" key={type}><h4>{typeLabels[type]} <small>{typeCards.length}枚</small></h4><div className="admin-deck-cards">{typeCards.map((card) => <label className="admin-deck-card" key={card.cardId}><input type="checkbox" checked={deck.cardIds.includes(card.cardId)} onChange={(event) => onChange({ ...deck, cardIds: event.target.checked ? [...deck.cardIds, card.cardId] : deck.cardIds.filter((id) => id !== card.cardId) })} /><span className="admin-deck-card__text"><strong>{card.name}</strong><b className={`admin-deck-card__rarity admin-deck-card__rarity--${card.rarity.toLowerCase()}`}>{card.rarity}</b><span>{card.text}</span></span></label>)}</div></section>)}
  </details>;
}
function PackEditor({ pack, cards, busy, onChange, onSave }: { pack: Pack; cards: CardMaster[]; busy: boolean; onChange: (value: Pack) => void; onSave?: () => void }) {
  const rateTotal = Object.values(pack.rarityRates).reduce((sum, rate) => sum + Number(rate), 0);
  const selectedArt = packArtKey(pack);
  return <div className="admin-pack"><h3>{pack.name}</h3><div className="admin-pack-art"><img src={packArtUrl(selectedArt)} alt={`${packArtOptions.find((option) => option.key === selectedArt)?.label}の画像`} /><label>パック画像<select value={selectedArt} onChange={(event) => onChange({ ...pack, imageKey: event.target.value })}>{packArtOptions.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select></label></div><div className="admin-economy-grid">
    <label>価格<input type="number" min="0" value={pack.price} onChange={(event) => onChange({ ...pack, price: Number(event.target.value) })} /></label>
    <label>1パックの枚数<input type="number" min="1" max="10" value={pack.cardsPerPack} onChange={(event) => onChange({ ...pack, cardsPerPack: Number(event.target.value) })} /></label>
    <label>天井までのパック数（0ならなし）<input type="number" min="0" value={pack.pityCount} onChange={(event) => onChange({ ...pack, pityCount: Number(event.target.value) })} /></label>
  </div><h4>排出率（合計100%）</h4><div className="admin-economy-grid">{(['N', 'R', 'SR', 'SSR'] as const).map((rarity) => <label key={rarity}>{rarity} の排出率 %<input type="number" min="0" max="100" step="0.1" value={pack.rarityRates[rarity] ?? 0} onChange={(event) => onChange({ ...pack, rarityRates: { ...pack.rarityRates, [rarity]: Number(event.target.value) } })} /></label>)}</div><p>現在の合計：{rateTotal}%</p>
    <h4>収録カード</h4><div className="admin-economy-grid">{cards.filter((card) => card.inPack).map((card) => <label key={card.cardId}><input type="checkbox" checked={pack.cardPool.includes(card.cardId)} onChange={(event) => onChange({ ...pack, cardPool: event.target.checked ? [...pack.cardPool, card.cardId] : pack.cardPool.filter((id) => id !== card.cardId) })} />{card.name}（{card.rarity}）</label>)}</div>
    <label><input type="checkbox" checked={pack.active} onChange={(event) => onChange({ ...pack, active: event.target.checked })} />販売中</label>
    {onSave && <button type="button" className="button button--ghost" disabled={busy || Math.abs(rateTotal - 100) > .001} onClick={onSave}>追加する</button>}
  </div>;
}

export function AdminEconomy({ session, onDirtyChange }: { session: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [savedData, setSavedData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [newMission, setNewMission] = useState<AdminData['missions'][number]>({ missionId: '', period: 'daily', condition: 'train', targetCount: 1, reward: 10, label: '', active: true });
  const [newPack, setNewPack] = useState<Pack>({ packId: '', name: '', price: 200, cardsPerPack: 3, rarityRates: { N: 70, R: 30 }, cardPool: [], pityCount: 0, imageKey: 'starter', active: false });
  useEffect(() => { let active = true; callApi<AdminData>('adminGetEconomy', session).then((result) => { if (active) { setData(result); setSavedData(result); } }).catch((error: Error) => { if (active) setMessage(error.message); }); return () => { active = false; }; }, [session]);
  const changes = data && savedData ? collectEconomyChanges(savedData, data) : [];
  useEffect(() => { onDirtyChange?.(changes.length > 0); }, [changes.length, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  const saveAll = async () => {
    if (!data || !savedData || !changes.length || busy) return;
    const invalid = validateEconomyChanges(data, changes);
    if (invalid) { setMessage(invalid); return; }
    setBusy(true);
    let completed = 0;
    let baseline = savedData;
    try {
      for (const change of changes) {
        setMessage(`${completed + 1} / ${changes.length} 件を保存中：${change.label}`);
        try { await callApi(change.action, session, change.payload); }
        catch (failure) { throw new Error(`${change.label}：${(failure as Error).message}`); }
        baseline = markEconomyChangeSaved(baseline, data, change);
        setSavedData(baseline);
        completed++;
      }
      patchBootstrapCache(session, (current) => current, true);
      const fresh = await callApi<AdminData>('adminGetEconomy', session);
      setData(fresh); setSavedData(fresh);
      setMessage(`${completed} 件の変更を保存しました。`);
    } catch (failure) {
      if (completed) patchBootstrapCache(session, (current) => current, true);
      setMessage(completed === changes.length ? `${completed} 件は保存されました。設定の再読み込みに失敗しました：${(failure as Error).message}` : `${completed} / ${changes.length} 件を保存しました。${(failure as Error).message} 残りの変更を確認してもう一度保存してください。`);
    } finally { setBusy(false); }
  };
  const save = async (action: string, payload: object) => {
    if (changes.length) { setMessage('既存項目の変更を先にまとめて保存してください。'); return; }
    setBusy(true); setMessage('');
    try { await callApi(action, session, payload); const fresh = await callApi<AdminData>('adminGetEconomy', session); setData(fresh); setSavedData(fresh); patchBootstrapCache(session, (current) => current, true); setMessage('追加しました。'); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  if (!data) return <section className="admin-economy panel"><h2>カードとゲームの設定</h2>{message ? <p role="alert">{message}</p> : <LoadingState text="設定を読み込み中" />}</section>;
  return <section className="admin-economy panel"><h2>カードとゲームの設定</h2><p>価格や報酬を編集し、変更した項目をまとめて保存できます。変更した項目だけ順番に送信し、保存後の操作から反映されます。</p>
    <div className="admin-bulk-save"><span>未保存の変更：{changes.length} 件</span><button type="button" className="button button--primary" disabled={busy || changes.length === 0} onClick={() => { void saveAll(); }}>{busy ? '保存中…' : `変更をまとめて保存（${changes.length}件）`}</button>{message && <small role="status">{message}</small>}</div>
    <fieldset className="admin-economy-fields" disabled={busy}>
    <details><summary>Gポイントと育成の数値</summary><div className="admin-economy-grid">{data.settings.map((setting, index) => <div className="admin-setting" key={setting.key}><label>{setting.description}<input type="number" min={setting.key === 'lifePerRun' ? '1' : '0'} max="100000" value={setting.value} onChange={(event) => setData((current) => { if (!current) return current; const settings = [...current.settings]; settings[index] = { ...settings[index], value: event.target.value }; return { ...current, settings }; })} /></label></div>)}</div></details>
    <details><summary>カードの販売設定</summary><div className="admin-economy-grid">{data.cards.map((card, index) => <div className="admin-setting" key={card.cardId}><strong>{card.name}（{card.rarity}）</strong><label>単品価格（空欄なら販売しない）<input type="number" min="0" max="100000" value={card.shopPrice ?? ''} onChange={(event) => setData((current) => { if (!current) return current; const cards = [...current.cards]; cards[index] = { ...cards[index], shopPrice: event.target.value === '' ? null : Number(event.target.value) }; return { ...current, cards }; })} /></label><label><input type="checkbox" checked={card.inPack} onChange={(event) => setData((current) => { if (!current) return current; const cards = [...current.cards]; cards[index] = { ...cards[index], inPack: event.target.checked }; return { ...current, cards }; })} />パックに入れる</label><label><input type="checkbox" checked={card.active} onChange={(event) => setData((current) => { if (!current) return current; const cards = [...current.cards]; cards[index] = { ...cards[index], active: event.target.checked }; return { ...current, cards }; })} />単品で販売する</label></div>)}</div></details>
    <details><summary>パックの設定</summary>{data.packs.map((pack, index) => <PackEditor key={pack.packId} pack={pack} cards={data.cards} busy={busy} onChange={(value) => setData((current) => { if (!current) return current; const packs = [...current.packs]; packs[index] = value; return { ...current, packs }; })} />)}</details>
    <details><summary>新しいパックを追加</summary><div className="admin-economy-grid"><label>パックID（英小文字・数字・ハイフン）<input value={newPack.packId} onChange={(event) => setNewPack({ ...newPack, packId: event.target.value })} /></label><label>パック名<input value={newPack.name} onChange={(event) => setNewPack({ ...newPack, name: event.target.value })} /></label></div><PackEditor pack={newPack} cards={data.cards} busy={busy} onChange={setNewPack} onSave={() => { const rarityRates = Object.fromEntries(Object.entries(newPack.rarityRates).filter(([, rate]) => rate > 0)); void save('adminSavePack', { ...newPack, rarityRates }); }} /></details>
    <details><summary>ミッションの設定</summary><div className="admin-economy-grid">{data.missions.map((mission, index) => <div className="admin-setting" key={mission.missionId}><strong>{mission.missionId}</strong><label>表示名<input value={mission.label} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], label: event.target.value }; return { ...current, missions }; })} /></label><label>期間<select value={mission.period} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], period: event.target.value }; return { ...current, missions }; })}><option value="daily">毎日</option><option value="weekly">毎週</option></select></label><label>条件<select value={mission.condition} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], condition: event.target.value }; return { ...current, missions }; })}>{missionConditions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>必要回数<input type="number" min="1" value={mission.targetCount} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], targetCount: Number(event.target.value) }; return { ...current, missions }; })} /></label><label>報酬<input type="number" min="0" value={mission.reward} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], reward: Number(event.target.value) }; return { ...current, missions }; })} /></label><label><input type="checkbox" checked={mission.active} onChange={(event) => setData((current) => { if (!current) return current; const missions = [...current.missions]; missions[index] = { ...missions[index], active: event.target.checked }; return { ...current, missions }; })} />有効</label></div>)}</div></details>
    <details><summary>新しいミッションを追加</summary><div className="admin-economy-grid"><label>ID（英小文字・数字・ハイフン）<input value={newMission.missionId} onChange={(event) => setNewMission({ ...newMission, missionId: event.target.value })} /></label><label>表示名<input value={newMission.label} onChange={(event) => setNewMission({ ...newMission, label: event.target.value })} /></label><label>期間<select value={newMission.period} onChange={(event) => setNewMission({ ...newMission, period: event.target.value })}><option value="daily">毎日</option><option value="weekly">毎週</option></select></label><label>条件<select value={newMission.condition} onChange={(event) => setNewMission({ ...newMission, condition: event.target.value })}>{missionConditions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>必要回数<input type="number" min="1" value={newMission.targetCount} onChange={(event) => setNewMission({ ...newMission, targetCount: Number(event.target.value) })} /></label><label>報酬<input type="number" min="0" value={newMission.reward} onChange={(event) => setNewMission({ ...newMission, reward: Number(event.target.value) })} /></label></div><button type="button" className="button button--ghost" disabled={busy || !newMission.missionId || !newMission.label} onClick={() => { void save('adminSaveMission', newMission); }}>追加する</button></details>
    <details><summary>サンプル・CPUデッキの設定</summary><div className="admin-deck-list">{data.decks.map((deck, index) => <DeckEditor key={deck.deckId} deck={deck} cards={data.cards} onChange={(value) => setData((current) => { if (!current) return current; const decks = [...current.decks]; decks[index] = value; return { ...current, decks }; })} />)}</div></details>
    </fieldset>
  </section>;
}
