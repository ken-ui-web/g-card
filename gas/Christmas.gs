// Event configuration is one atomic live snapshot; student progress and permanent
// rewards live separately. No test answers or Firebase credentials are stored here.
let GC_CHRISTMAS_REQUEST_CACHE;
const GC_CHRISTMAS_ID = 'christmas-2026';
const GC_EVENT_HEADERS = {
  EventProgress: ['eventId', 'email', 'knowledgeDone', 'reflectionDone', 'cpuWins', 'onlineWins', 'frameAwarded', 'updatedAt', 'cpuBattleIds', 'onlineBattleIds'],
  PlayerFrames: ['email', 'frameId', 'acquiredAt', 'equippedOwnedId', 'noticeSeen'],
};
function gcEventSheet_(name) {
  const book = SpreadsheetApp.openById(gcProperty_('SPREADSHEET_ID'));
  let sheet = book.getSheetByName(name);
  if (!sheet) { try { sheet = book.insertSheet(name); } catch (error) { sheet = book.getSheetByName(name); if (!sheet) throw error; } }
  if (!sheet.getLastRow()) { sheet.getRange(1, 1, 1, GC_EVENT_HEADERS[name].length).setValues([GC_EVENT_HEADERS[name]]); sheet.setFrozenRows(1); }
  return sheet;
}
function gcChristmasDefault_() {
  return { eventId: GC_CHRISTMAS_ID, title: 'Gカード クリスマスイベント', startAt: '', endAt: '', published: false,
    knowledgeTestId: '', reflectionTestId: '', cpuWins: 3, onlineWins: 3, cpuLife: 160, cpuTraining: 20,
    cpuCards: ['G023','G010','G007','P010'], packPrice: 200, packSize: 3,
    rarityRates: { N: 60, R: 30, SR: 8.5, SSR: 1.5 },
    cardPool: GC_ALL_CARD_IDS.filter(function (id) { const row = GC_CARDS.find(function (card) { return card[0] === id; }); return row[3] !== 'SSR'; }).concat(['G023']) };
}
function gcChristmasConfig_() {
  if (GC_CHRISTMAS_REQUEST_CACHE) return GC_CHRISTMAS_REQUEST_CACHE;
  const rows = gcSheet_('Settings').getDataRange().getValues();
  const row = rows.find(function (item) { return item[0] === 'christmasConfig'; });
  if (!row || !row[1]) return (GC_CHRISTMAS_REQUEST_CACHE = { draft: gcChristmasDefault_(), live: null, revision: '' });
  try { return (GC_CHRISTMAS_REQUEST_CACHE = JSON.parse(row[1])); } catch (_) { gcError_('BAD_EVENT', 'イベント設定を確認してください'); }
}
function gcChristmasWrite_(config) {
  GC_CHRISTMAS_REQUEST_CACHE = undefined;
  const sheet = gcSheet_('Settings'), rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(function (row) { return row[0] === 'christmasConfig'; });
  const values = ['christmasConfig', JSON.stringify(config), 'クリスマスイベント：準備中設定と公開中設定'];
  if (index < 0) sheet.appendRow(values); else sheet.getRange(index + 1, 1, 1, 3).setValues([values]);
}
function gcChristmasActive_(event, at) {
  const now = at === undefined ? Date.now() : Number(at);
  return Boolean(event && event.published && Date.parse(event.startAt) <= now && now <= Date.parse(event.endAt));
}
function gcChristmasPack_(event) {
  return { packId: GC_CHRISTMAS_ID, name: 'クリスマス限定パック', price: event.packPrice, cardsPerPack: event.packSize,
    rarityRates: event.rarityRates, cardPool: event.cardPool, pityCount: 0, startAt: event.startAt, endAt: event.endAt, imageKey: 'christmas', eventId: GC_CHRISTMAS_ID };
}
function gcChristmasPacks_(packs) {
  const live = gcChristmasConfig_().live;
  return gcChristmasActive_(live) ? packs.filter(function (pack) { return pack.packId !== GC_CHRISTMAS_ID; }).concat([gcChristmasPack_(live)]) : packs.filter(function (pack) { return pack.packId !== GC_CHRISTMAS_ID; });
}
function gcChristmasCards_(identity) {
  const live = gcChristmasConfig_().live;
  const disclosed = Boolean(identity && identity.admin || live && live.published || identity && gcOwned_(identity.email).some(function (card) { return card.cardId === 'G023'; }));
  return gcCardMaster_().filter(function (card) { return card.cardId !== 'G023' || disclosed; }).map(function (card) {
    return card.cardId === 'G023' ? Object.assign({}, card, { name: 'サンタアッパー', active: gcChristmasActive_(live), inPack: gcChristmasActive_(live), shopPrice: null }) : card;
  });
}
function gcFrameRows_(email) {
  return gcEventSheet_('PlayerFrames').getDataRange().getValues().slice(1).map(function (row, index) { return { row: row, rowNumber: index + 2 }; })
    .filter(function (item) { return String(item.row[0]).toLowerCase() === email; });
}
function gcFrames_(email) {
  return gcFrameRows_(email).map(function (item) { return { frameId: String(item.row[1]), acquiredAt: String(item.row[2]), equippedOwnedId: String(item.row[3] || ''), noticeSeen: item.row[4] === true }; });
}
function gcFramedOwned_(email, cards) {
  const frames = gcFrames_(email);
  return cards.map(function (card) { const frame = frames.find(function (item) { return item.equippedOwnedId === card.ownedId; }); return frame ? Object.assign({}, card, { frameId: frame.frameId }) : card; });
}
function gcChristmasProgress_(email) {
  const sheet = gcEventSheet_('EventProgress'), rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(function (row, i) { return i > 0 && row[0] === GC_CHRISTMAS_ID && String(row[1]).toLowerCase() === email; });
  return { sheet: sheet, rowNumber: index < 0 ? 0 : index + 1,
    values: index < 0 ? [GC_CHRISTMAS_ID, email, false, false, 0, 0, false, '', '[]', '[]'] : rows[index] };
}
function gcChristmasView_(email, preview) {
  const config = gcChristmasConfig_();
  const event = preview ? config.draft : config.live;
  if (!event || !preview && !event.published) return null;
  const progress = email && !preview ? gcChristmasProgress_(email).values : [null,null,false,false,0,0,false];
  return Object.assign({}, event, { active: preview || gcChristmasActive_(event), preview: Boolean(preview),
    progress: { knowledgeDone: progress[2] === true, reflectionDone: progress[3] === true, cpuWins: Math.min(event.cpuWins, Number(progress[4] || 0)), onlineWins: Math.min(event.onlineWins, Number(progress[5] || 0)), frameAwarded: progress[6] === true } });
}
function gcChristmasRecord_(email, action) {
  const event = gcChristmasConfig_().live;
  if (!gcChristmasActive_(event)) return;
  if (action.startedAt && Date.parse(action.startedAt) < Date.parse(event.startAt)) return;
  const found = gcChristmasProgress_(email), row = found.values;
  let changed = false;
  if (action.kind === 'test' && action.testId === event.knowledgeTestId && action.maxScore > 0 && action.score === action.maxScore && row[2] !== true) { row[2] = true; changed = true; }
  if (action.kind === 'test' && action.testId === event.reflectionTestId && row[3] !== true) { row[3] = true; changed = true; }
  if ((action.kind === 'santa' || action.kind === 'online') && action.battleId) {
    const countIndex = action.kind === 'santa' ? 4 : 5, idsIndex = action.kind === 'santa' ? 8 : 9;
    const ids = JSON.parse(row[idsIndex] || '[]');
    if (Number(row[countIndex] || 0) < 100 && ids.indexOf(action.battleId) < 0) {
      ids.push(action.battleId); row[idsIndex] = JSON.stringify(ids); row[countIndex] = Number(row[countIndex] || 0) + 1; changed = true;
    }
  }
  if (row[2] === true && row[3] === true && Number(row[4]) >= event.cpuWins && Number(row[5]) >= event.onlineWins) {
    const sheet = gcEventSheet_('PlayerFrames');
    if (!gcFrameRows_(email).some(function (item) { return item.row[1] === GC_CHRISTMAS_ID; })) sheet.appendRow([email, GC_CHRISTMAS_ID, new Date().toISOString(), '', false]);
    if (row[6] !== true) changed = true;
    row[6] = true;
  }
  if (!changed) return;
  row[7] = new Date().toISOString();
  if (found.rowNumber) found.sheet.getRange(found.rowNumber, 1, 1, GC_EVENT_HEADERS.EventProgress.length).setValues([row]); else found.sheet.appendRow(row);
}
function gcEquipFrame_(token, payload) {
  const identity = gcSession_(token, false);
  return gcWithLock_(function () {
    const ownedId = String(payload.ownedId || '');
    const records = gcFrameRows_(identity.email);
    const target = records.find(function (item) { return item.row[1] === payload.frameId; });
    if (!target) gcError_('FORBIDDEN', 'まだこのフレームを獲得していません');
    if (ownedId && !gcOwned_(identity.email).some(function (card) { return card.ownedId === ownedId; })) gcError_('BAD_DECK', '所持しているカードを選んでください');
    records.forEach(function (item) {
      const next = item === target ? ownedId : ownedId ? '' : String(item.row[3] || '');
      if (String(item.row[3] || '') !== next) gcEventSheet_('PlayerFrames').getRange(item.rowNumber, 4).setValue(next);
    });
    return gcState_(identity);
  });
}
function gcAckFrame_(token, payload) {
  const identity = gcSession_(token, false);
  return gcWithLock_(function () {
    const found = gcFrameRows_(identity.email).find(function (item) { return item.row[1] === payload.frameId; });
    if (!found) gcError_('NOT_FOUND', 'フレームが見つかりません');
    gcEventSheet_('PlayerFrames').getRange(found.rowNumber, 5).setValue(true);
    return { frames: gcFrames_(identity.email) };
  });
}
function gcChristmasEnsureCard_() {
  const cards = gcSheet_('Cards');
  const rows = cards.getDataRange().getValues();
  const index = rows.findIndex(function (row) { return row[0] === 'G023'; });
  if (index < 0) {
    cards.appendRow(GC_CARDS.find(function (row) { return row[0] === 'G023'; })); gcClearMasterCache_('Cards');
  } else if (rows[index][1] !== 'サンタアッパー') {
    // Rename the existing card without replacing ownership, training or teacher settings.
    cards.getRange(index + 1, 2).setValue('サンタアッパー'); gcClearMasterCache_('Cards');
  }
}
function gcAdminChristmas_(token) {
  gcSession_(token, true);
  gcWithLock_(function () { gcChristmasEnsureCard_(); });
  return { config: gcChristmasConfig_(), tests: gcLearnRows_('Tests').map(function (row) { return { testId: String(row[0]), title: String(row[1]), published: row[5] === true }; }), cards: gcCardMaster_() };
}
function gcChristmasValidate_(input, publication) {
  const value = JSON.parse(JSON.stringify(input || {})), initial = gcChristmasDefault_();
  Object.keys(initial).forEach(function (key) { if (value[key] === undefined) value[key] = initial[key]; });
  value.rarityRates = { N: Number(value.rarityRates && value.rarityRates.N), R: Number(value.rarityRates && value.rarityRates.R), SR: Number(value.rarityRates && value.rarityRates.SR), SSR: Number(value.rarityRates && value.rarityRates.SSR) };
  value.eventId = GC_CHRISTMAS_ID; value.published = false; value.title = String(value.title || '').trim().slice(0, 100);
  ['cpuWins','onlineWins','cpuLife','cpuTraining','packPrice','packSize'].forEach(function (key) {
    const max = key === 'cpuLife' ? 9999 : key === 'packPrice' ? 100000 : key === 'cpuTraining' ? 20 : key === 'packSize' ? 10 : 100;
    if (!Number.isInteger(value[key]) || value[key] < (key === 'cpuTraining' ? 0 : 1) || value[key] > max) gcError_('BAD_EVENT', '必要勝利数・CPUの強さ・パックの数値を確認してください');
  });
  const master = gcCardMaster_();
  if (!Array.isArray(value.cpuCards) || value.cpuCards.length < 4 || value.cpuCards.length > 41 || new Set(value.cpuCards).size !== value.cpuCards.length || !value.cpuCards.every(function (id) { return master.some(function (card) { return card.cardId === id; }); })) gcError_('BAD_EVENT', 'サンタCPUの候補カードを4枚以上選んでください');
  if (!Array.isArray(value.cardPool) || !value.cardPool.includes('G023') || new Set(value.cardPool).size !== value.cardPool.length || !value.cardPool.every(function (id) { return master.some(function (card) { return card.cardId === id; }); })) gcError_('BAD_EVENT', '限定パックにはサンタアッパーを含む収録カードを選んでください');
  let sum = 0;
  ['N','R','SR','SSR'].forEach(function (rarity) { const rate = Number(value.rarityRates && value.rarityRates[rarity]); if (!Number.isFinite(rate) || rate < 0 || rate > 100 || rate > 0 && !value.cardPool.some(function (id) { return master.some(function (card) { return card.cardId === id && card.rarity === rarity; }); })) gcError_('BAD_EVENT', rarity + 'の排出率と収録カードを確認してください'); sum += rate; });
  if (Math.abs(sum - 100) > .001 || Number(value.rarityRates.SSR) <= 0) gcError_('BAD_EVENT', '排出率を合計100%にし、SSRを0%より大きくしてください');
  if (publication) {
    if (!value.title || !Number.isFinite(Date.parse(value.startAt)) || !Number.isFinite(Date.parse(value.endAt)) || Date.parse(value.startAt) >= Date.parse(value.endAt) || Date.parse(value.endAt) < Date.now()) gcError_('BAD_EVENT', '開催期間を確認してください');
    if (!value.knowledgeTestId || value.knowledgeTestId === value.reflectionTestId) gcError_('BAD_EVENT', '異なる2つのテストを指定してください');
    const knowledge = gcLearnTestById_(value.knowledgeTestId), reflection = gcLearnTestById_(value.reflectionTestId);
    if (!knowledge.published || !reflection.published) gcError_('BAD_EVENT', '対象の2つのテストを公開してください');
    if (!gcLearnQuestions_(knowledge.testId, true).some(function (q) { return q.points > 0; })) gcError_('BAD_EVENT', '知識テストには採点する問題が必要です');
    if (!gcLearnQuestions_(reflection.testId, true).some(function (q) { return q.type === 'paragraph' && q.required; })) gcError_('BAD_EVENT', '振り返りテストに必須の長文記述問題を作成してください');
    const eligible = value.cpuCards.filter(function (id) { return master.find(function (card) { return card.cardId === id; }).rarity !== 'SSR'; });
    if (eligible.length < 3) gcError_('BAD_EVENT', 'サンタCPUがSSR1枚以下のデッキを組めるようにしてください');
  }
  return value;
}
function gcAdminSaveChristmas_(token, payload) {
  gcSession_(token, true);
  return gcWithLock_(function () {
    gcChristmasEnsureCard_();
    const current = gcChristmasConfig_();
    if (String(payload.revision || '') !== String(current.revision || '')) gcError_('CONFLICT', '設定が更新されています。読み込み直してください');
    if (payload.action === 'pause') {
      if (current.live) current.live.published = false;
    } else {
      current.draft = gcChristmasValidate_(payload.draft || current.draft, payload.action === 'publish');
      if (payload.action === 'publish') current.live = Object.assign({}, current.draft, { published: true });
      else if (payload.action !== 'save') gcError_('BAD_REQUEST', '操作を確認してください');
    }
    current.revision = Utilities.getUuid(); gcChristmasWrite_(current);
    return { config: current };
  });
}
function gcGetChristmas_(token, preview) {
  const identity = gcSession_(token, Boolean(preview));
  if (!preview) gcWithLock_(function () { gcChristmasRecord_(identity.email, { kind: 'reconcile' }); });
  return { event: gcChristmasView_(identity.email, Boolean(preview)), frames: gcFrames_(identity.email) };
}
