import { availableCards } from '../data/cards';
import type { BootstrapData, EconomyState, MissionState, OwnedCard, PublicShopConfig } from './api';

const key = 'g-card-guest-v1';
const starter = ['G001', 'G002', 'C008', 'P001'];
const order = ['rock', 'scissors', 'paper'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monday = (date: string) => { const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); };
const missionTemplates: MissionState[] = [
  { missionId: 'daily-win', period: 'daily', condition: 'win_battle', targetCount: 1, reward: 20, label: 'CPU対戦で1回勝つ', progress: 0, completed: false },
  { missionId: 'daily-train', period: 'daily', condition: 'train', targetCount: 1, reward: 10, label: 'トレーニングを1回する', progress: 0, completed: false },
];
const sellPrices = { N: 10, R: 30, SR: 100, SSR: 300 };
let activeShopConfig: PublicShopConfig | null = null;
export function clearGuestShopConfig() { activeShopConfig = null; }
export function installGuestShopConfig(config: PublicShopConfig) {
  if (!config || !Array.isArray(config.cards) || !Array.isArray(config.packs) ||
      availableCards.some((card) => !config.cards.some((item) => item.cardId === card.cardId)) ||
      !Number.isInteger(config.packDailyLimit) || !config.sellPrices) throw new Error('ショップ設定を確認できません。もう一度読み込んでください。');
  activeShopConfig = config;
}
export function applyGuestShopConfig(data: BootstrapData, config: PublicShopConfig): BootstrapData {
  const byId = new Map(config.cards.map((card) => [card.cardId, card]));
  return {
    ...data,
    cardMaster: data.cardMaster.map((card) => ({ ...card, ...byId.get(card.cardId) })),
    packs: config.packs,
    economy: { ...data.economy, packDailyLimit: config.packDailyLimit, sellPrices: config.sellPrices },
  };
}
type GuestState = { nickname: string; gPoint: number; runCount: number; pityCounter: number; ownedCards: OwnedCard[]; lastDeck: string[]; lastLoginDate: string; loginStreak: number; dailyDate: string; daily: EconomyState['daily']; firstWinGiven: boolean; missions: MissionState[]; missionWeek: string; processed: Record<string, EconomyState>; reportedBattles: Record<string, EconomyState>; battleHistory: { battleId: string; result: string; cpuLevel: number; deckMode: string; awarded: number; at: string }[] };

function fresh(): GuestState {
  const ownedCards = starter.map((cardId) => ({ ownedId: crypto.randomUUID(), cardId, trainLevel: 0, trainingSpent: 0, source: 'initial' }));
  return { nickname: '', gPoint: 100, runCount: 0, pityCounter: 0, ownedCards, lastDeck: ownedCards.map((item) => item.ownedId), lastLoginDate: '', loginStreak: 0, dailyDate: today(), daily: { cpuRewards: 0, onlineRewards: 0, packsBought: 0 }, firstWinGiven: false, missions: missionTemplates.map((item) => ({ ...item })), missionWeek: monday(today()), processed: {}, reportedBattles: {}, battleHistory: [] };
}

function read(): GuestState {
  const raw = localStorage.getItem(key);
  if (!raw) { const state = fresh(); write(state); return state; }
  const state = JSON.parse(raw) as GuestState;
  state.reportedBattles ??= {};
  state.battleHistory ??= [];
  if (state.dailyDate !== today()) {
    state.dailyDate = today(); state.daily = { cpuRewards: 0, onlineRewards: 0, packsBought: 0 };
    state.firstWinGiven = false;
    state.missions = missionTemplates.map((item) => ({ ...item }));
    state.processed = {};
  }
  state.missionWeek = monday(today());
  return state;
}
function write(state: GuestState) { localStorage.setItem(key, JSON.stringify(state)); }
export function createGuest() { clearGuestShopConfig(); read(); }
function awardMission(state: GuestState, condition: string, count: number) {
  const completed: { label: string; reward: number }[] = [];
  state.missions.forEach((mission) => {
    if (mission.condition !== condition || mission.completed) return;
    mission.progress = Math.min(mission.targetCount, mission.progress + count);
    if (mission.progress >= mission.targetCount) { mission.completed = true; state.gPoint += mission.reward; completed.push({ label: mission.label, reward: mission.reward }); }
  });
  return completed;
}
function snapshot(state: GuestState, extra: Partial<EconomyState> = {}): EconomyState {
  return { gPoint: state.gPoint, runCount: state.runCount, pityCounter: state.pityCounter, maxLife: 100 + state.runCount * 5, ownedCards: state.ownedCards, lastDeck: state.lastDeck, missions: state.missions, daily: state.daily, ...extra };
}
function card(id: string) { const result = availableCards.find((item) => item.cardId === id); if (!result) throw new Error('カードが見つかりません'); return result; }
function amount(value: unknown) { const result = Number(value); if (!Number.isInteger(result) || result < 1 || result > 100) throw new Error('回数を確認してください'); return result; }
function bootstrap(state: GuestState): BootstrapData {
  let bonus = { awarded: false, amount: 0, streak: state.loginStreak };
  if (state.nickname && state.lastLoginDate !== today()) {
    const yesterday = new Date(`${today()}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    state.loginStreak = state.lastLoginDate === yesterday.toISOString().slice(0, 10) ? state.loginStreak + 1 : 1;
    const award = 10 + (state.loginStreak % 7 === 0 ? 100 : 0);
    state.gPoint += award; state.lastLoginDate = today(); bonus = { awarded: true, amount: award, streak: state.loginStreak };
    write(state);
  }
  const data: BootstrapData = {
    profile: { nickname: state.nickname, role: 'student', gPoint: state.gPoint, maxLife: 100 + state.runCount * 5, runCount: state.runCount, pityCounter: state.pityCounter },
    needsNickname: !state.nickname, loginBonus: { ...bonus, dailyAmount: 10, streakBonus: 100 }, ownedCards: state.ownedCards,
    cardMaster: availableCards.map((item, index) => ({ cardId: item.cardId, name: item.name, type: item.type, rarity: item.rarity, image: item.frontImage, text: item.text, effects: item.effects, trainingMultiplier: item.trainingMultiplier, trainingBonus: item.trainingBonus, shopPrice: null, inPack: false, active: false, sortOrder: order.indexOf(item.type) * 100 + index })),
    lastDeck: state.lastDeck, packs: [], battleConfig: [], missions: state.missions, daily: state.daily,
    economy: { enabled: true, muscleCostBase: 20, muscleCostStep: 2, runCostBase: 60, runCostStep: 6, lifePerRun: 5, cpuRewardDailyCap: 3, packDailyLimit: 10, sellPrices },
    learning: { enabled: false }, unreadTests: 0, pendingReflections: 0, online: { enabled: false, rankingEnabled: false, rewardDailyCap: 0 },
  };
  return activeShopConfig ? applyGuestShopConfig(data, activeShopConfig) : data;
}

export function guestAction(action: string, payload: Record<string, unknown>, requestId: string): BootstrapData | EconomyState | object {
  const state = read();
  if (action === 'bootstrap') return bootstrap(state);
  if (action === 'setNickname') {
    const name = String(payload.nickname ?? '').trim();
    if (!name || name.length > 8) throw new Error('ニックネームは1～8文字で入力してください');
    state.nickname = name; write(state); return { nickname: name };
  }
  if (!state.nickname) throw new Error('先にニックネームを決めてください');
  if (state.processed[requestId]) return state.processed[requestId];
  let extra: Partial<EconomyState> = {};
  if (action === 'buyCard') {
    const selected = card(String(payload.cardId));
    const sale = activeShopConfig?.cards.find((item) => item.cardId === selected.cardId);
    if (!sale?.active || sale.shopPrice === null || selected.rarity === 'SSR') throw new Error('このカードは購入できません');
    if (state.gPoint < sale.shopPrice) throw new Error('Gポイントが足りません');
    state.gPoint -= sale.shopPrice;
    const acquired = { ownedId: crypto.randomUUID(), cardId: selected.cardId, trainLevel: 0, trainingSpent: 0, source: 'shop' };
    state.ownedCards.push(acquired); extra = { acquired: [acquired] };
  } else if (action === 'sellCard') {
    if (state.ownedCards.length <= 4) throw new Error('カードは4枚以上残してください');
    const target = state.ownedCards.find((item) => item.ownedId === payload.ownedId);
    if (!target) throw new Error('このカードは所持していません');
    state.gPoint += (activeShopConfig?.sellPrices[card(target.cardId).rarity] ?? sellPrices[card(target.cardId).rarity]) + (target.trainingSpent ?? 0);
    state.ownedCards = state.ownedCards.filter((item) => item.ownedId !== target.ownedId);
    if (state.lastDeck.includes(target.ownedId)) state.lastDeck = [];
  } else if (action === 'train') {
    const items = payload.items as { kind: 'muscle' | 'run'; ownedId?: string; count: number }[];
    if (!Array.isArray(items) || !items.length || items.length > 20 || items.reduce((sum, item) => sum + Number(item.count), 0) > 100) throw new Error('回数を確認してください');
    let trained = 0;
    let missionCount = 0;
    for (const item of items) for (let index = 0; index < amount(item.count); index++) {
      if (item.kind === 'muscle') {
        const owned = state.ownedCards.find((entry) => entry.ownedId === item.ownedId);
        if (!owned || card(owned.cardId).type !== 'rock') throw new Error('筋トレできるカードを選んでください');
        const price = 20 + 2 * owned.trainLevel;
        if (state.gPoint < price) break;
        state.gPoint -= price; owned.trainLevel++; owned.trainingSpent = (owned.trainingSpent ?? 0) + price;
      } else if (item.kind === 'run') {
        const price = 60 + 6 * state.runCount;
        if (state.gPoint < price) break;
        state.gPoint -= price; state.runCount++;
      } else throw new Error('トレーニングを選んでください');
      trained++; missionCount++;
    }
    if (!trained) throw new Error('Gポイントが足りません');
    extra = { trained, completedMissions: awardMission(state, 'train', missionCount) };
  } else if (action === 'saveDeck') {
    const ids = payload.ownedIds as string[];
    if (!Array.isArray(ids) || ids.length !== 4 || new Set(ids).size !== 4 || !ids.every((id) => state.ownedCards.some((item) => item.ownedId === id)) || ids.filter((id) => card(state.ownedCards.find((item) => item.ownedId === id)!.cardId).rarity === 'SSR').length > 1) throw new Error('デッキを確認してください');
    state.lastDeck = ids;
  } else if (action === 'openPack') {
    const pack = activeShopConfig?.packs.find((item) => item.packId === payload.packId);
    if (!pack || !activeShopConfig || state.gPoint < pack.price || state.daily.packsBought >= activeShopConfig.packDailyLimit) throw new Error('パックを購入できません');
    const pool = availableCards.filter((item) => pack.cardPool.includes(item.cardId) && activeShopConfig!.cards.some((setting) => setting.cardId === item.cardId && setting.inPack));
    const rates = Object.entries(pack.rarityRates).map(([rarity, rate]) => ({ rarity, rate, cards: pool.filter((item) => item.rarity === rarity) }));
    if (!Number.isInteger(pack.cardsPerPack) || pack.cardsPerPack < 1 || pack.cardsPerPack > 10 || !rates.length || rates.some((item) => !item.cards.length || !Number.isFinite(item.rate) || item.rate <= 0) || Math.abs(rates.reduce((sum, item) => sum + item.rate, 0) - 100) > .001 || pack.pityCount > 0 && !pool.some((item) => item.rarity === 'SR' || item.rarity === 'SSR')) throw new Error('パックの設定を先生に確認してください');
    const acquired: OwnedCard[] = [];
    for (let index = 0; index < pack.cardsPerPack; index++) {
      const guaranteed = index === 0 && pack.pityCount > 0 && state.pityCounter >= pack.pityCount;
      const choices = guaranteed ? rates.filter((item) => item.rarity === 'SR' || item.rarity === 'SSR') : rates;
      let roll = Math.random() * choices.reduce((sum, item) => sum + item.rate, 0);
      let picked = choices[choices.length - 1];
      for (const item of choices) { roll -= item.rate; if (roll < 0) { picked = item; break; } }
      const selected = picked.cards[Math.floor(Math.random() * picked.cards.length)];
      const owned = { ownedId: crypto.randomUUID(), cardId: selected.cardId, trainLevel: 0, trainingSpent: 0, source: 'pack' };
      state.ownedCards.push(owned); acquired.push(owned);
    }
    state.pityCounter = acquired.some((item) => ['SR', 'SSR'].includes(card(item.cardId).rarity)) ? 0 : state.pityCounter + 1;
    state.gPoint -= pack.price; state.daily.packsBought++;
    extra = { acquired, pityRemaining: pack.pityCount ? Math.max(0, pack.pityCount - state.pityCounter) : null };
  } else if (action === 'reportBattle') {
    const battleId = String(payload.battleId ?? '');
    if (!/^[a-f0-9-]{20,64}$/i.test(battleId)) throw new Error('対戦結果を確認してください');
    if (state.reportedBattles[battleId]) return state.reportedBattles[battleId];
    const level = Number(payload.cpuLevel);
    const result = String(payload.result);
    if (![1, 2, 3].includes(level) || !['win', 'draw', 'loss'].includes(result)) throw new Error('対戦結果を確認してください');
    let awarded = result === 'win' && state.daily.cpuRewards < 3 ? [0, 5, 10, 20][level] : 0;
    if (awarded) state.daily.cpuRewards++;
    if (result === 'win' && !state.firstWinGiven) { awarded += 20; state.firstWinGiven = true; }
    state.gPoint += awarded;
    state.battleHistory.push({ battleId, result, cpuLevel: level, deckMode: String(payload.deckMode ?? 'sample'), awarded, at: new Date().toISOString() });
    extra = { awarded, completedMissions: result === 'win' ? awardMission(state, 'win_battle', 1) : [] };
  } else throw new Error('ゲストではこの機能を利用できません');
  const result = snapshot(state, extra);
  state.processed[requestId] = JSON.parse(JSON.stringify(result)) as EconomyState;
  if (action === 'reportBattle') state.reportedBattles[String(payload.battleId)] = JSON.parse(JSON.stringify(result)) as EconomyState;
  write(state);
  return result;
}
