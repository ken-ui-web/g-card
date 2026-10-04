// Gカード。学校アカウント所有のスプレッドシートに紐づけて使う。
// 秘密の値と名簿は、このソースではなくスクリプトプロパティとシートに保存する。
const GC_TZ = 'Asia/Tokyo';
const GC_HEADERS = {
  Users: ['email', 'role', 'class', 'number', 'name', 'nickname', 'gPoint', 'runCount', 'totalEarned', 'loginStreak', 'lastLoginDate', 'pityCounter', 'lastDeckJson', 'welcomeGiven', 'createdAt', 'updatedAt'],
  OwnedCards: ['ownedId', 'email', 'cardId', 'trainLevel', 'source', 'acquiredAt', 'soldAt'],
  Cards: ['cardId', 'name', 'type', 'rarity', 'text', 'effects', 'trainingMultiplier', 'image', 'shopPrice', 'inPack', 'active', 'sortOrder', 'flavor', 'trainingBonus'],
  Packs: ['packId', 'name', 'price', 'cardsPerPack', 'rarityRatesJson', 'cardPoolJson', 'pityCount', 'startAt', 'endAt', 'active'],
  Decks: ['deckId', 'name', 'cardIdsJson', 'maxLife', 'rockTrainLevel'],
  Tests: ['testId', 'title', 'description', 'sectionsJson', 'settingsJson', 'published', 'createdAt', 'updatedAt'],
  Questions: ['testId', 'questionId', 'sectionId', 'order', 'qType', 'text', 'imageFileId', 'optionsJson', 'answerKeyJson', 'points', 'required', 'shuffleOptions', 'feedbackCorrect', 'feedbackWrong'],
  TestResponses: ['responseId', 'testId', 'email', 'attemptNo', 'answersJson', 'autoScore', 'manualScore', 'totalScore', 'maxScore', 'gAwarded', 'gradingStatus', 'submittedAt'],
  TestBest: ['email', 'testId', 'bestScore', 'bestG', 'perfectAwarded', 'attempts'],
  Reflections: ['reflectionId', 'title', 'prompt', 'targetClassesJson', 'startAt', 'endAt', 'gPoint', 'active'],
  ReflectionResponses: ['id', 'reflectionId', 'email', 'text', 'gAwarded', 'submittedAt'],
  PointLog: ['logId', 'email', 'delta', 'reason', 'refId', 'balanceAfter', 'createdAt'],
  Missions: ['missionId', 'period', 'condition', 'targetCount', 'reward', 'label', 'active', 'sortOrder'],
  MissionProgress: ['email', 'missionId', 'periodKey', 'progress', 'completedAt'],
  BattleLog: ['battleId', 'email', 'mode', 'deckMode', 'cpuLevel', 'result', 'opponentNickname', 'gAwarded', 'createdAt'],
  OnlineMatches: ['battleId', 'deckMode', 'emailA', 'uidA', 'emailB', 'uidB', 'resultA', 'hashA', 'resultB', 'hashB', 'createdAt', 'status', 'finishedAt'],
  DailyCounters: ['email', 'dateKey', 'cpuRewards', 'onlineRewards', 'firstWinGiven', 'packsBought'],
  AdminAdjustments: ['requestId', 'adminEmail', 'targetEmail', 'delta', 'reason', 'balanceAfter', 'createdAt'],
  AdminActions: ['requestId', 'adminEmail', 'targetEmail', 'action', 'before', 'after', 'createdAt'],
  Settings: ['key', 'value', 'description'],
};

const GC_CARDS = [
  ['G001', 'パンチ', 'rock', 'N', '20のダメージを与える', '[{"type":"damage","amount":20}]', 1, 'G001-front.webp', 50, true, true, 1, '', 0],
  ['G002', 'キック', 'rock', 'N', '20のダメージを与える', '[{"type":"damage","amount":20}]', 1, 'G002-front.webp', 50, true, true, 2, '', 0],
  ['C008', '火縄銃', 'scissors', 'R', '50のダメージを与える', '[{"type":"damage","amount":50}]', 0, 'C008-front.webp', 150, true, true, 3, '', 0],
  ['P001', '手品', 'paper', 'N', '相手のカードを1枚選び、種類を【グー】に変える', '[{"type":"changeOpponentType","to":"rock"}]', 0, 'P001-front.webp', 50, true, true, 4, '', 0],
  ['P003', '救急箱', 'paper', 'N', 'ライフを30回復', '[{"type":"heal","amount":30}]', 0, 'P003-front.webp', 50, true, true, 5, '', 0],
  ['G006', '正拳突き', 'rock', 'R', '30のダメージを与える', '[{"type":"damage","amount":30}]', 1, 'G006-front.webp', 150, true, true, 6, '', 0],
  ['C002', 'のこぎり', 'scissors', 'N', '30のダメージを与える', '[{"type":"damage","amount":30}]', 0, 'C002-front.webp', 50, true, true, 7, '', 0],
  ['P002', '催眠術', 'paper', 'N', '相手のカードを1枚選び、種類を【チョキ】に変える', '[{"type":"changeOpponentType","to":"scissors"}]', 0, 'P002-front.webp', 50, true, true, 8, '', 0],
  ['P017', 'おりがみ', 'paper', 'N', '相手のカードを1枚選び、種類を【パー】に変える', '[{"type":"changeOpponentType","to":"paper"}]', 0, 'P017-front.webp', 50, true, true, 9, '', 0],
  ['C014', 'レーザーカッター', 'scissors', 'SSR', '60のダメージを与える', '[{"type":"damage","amount":60}]', 0, 'C014-front.webp', '', true, true, 10, '', 0],
];
const GC_INITIAL_CARDS = ['G001', 'G002', 'C008', 'P001'];
const GC_ECONOMY_SETTINGS = [
  ['economyEnabled', '0', '生徒にGポイント機能を公開（0=停止、1=公開）'],
  ['learningEnabled', '0', '生徒にテストと振り返り連携を公開（0=停止、1=公開）'],
  ['muscleCostBase', '20', '筋トレの基本価格'], ['muscleCostStep', '2', '筋トレ値ごとの価格上昇'],
  ['runCostBase', '60', '走り込みの基本価格'], ['runCostStep', '6', '走り込み回数ごとの価格上昇'],
  ['lifePerRun', '5', '走り込み1回の最大ライフ増加'], ['maxLifeCap', '', '最大ライフの上限。空欄なら無制限'],
  ['cpuRewardLv1', '5', 'CPU Lv1勝利報酬'], ['cpuRewardLv2', '10', 'CPU Lv2勝利報酬'],
  ['cpuRewardLv3', '20', 'CPU Lv3勝利報酬'], ['cpuRewardDailyCap', '3', 'CPU対戦報酬の1日上限'],
  ['onlineEnabled', '0', 'オンライン対戦を受付（0=停止、1=公開）'], ['rankingEnabled', '1', '週間ランキングを表示'],
  ['onlineRewardWin', '10', 'オンライン勝利報酬'], ['onlineRewardDraw', '5', 'オンライン引き分け報酬'], ['onlineRewardLoss', '3', 'オンライン敗北報酬'],
  ['onlineRewardDailyCap', '3', 'オンライン対戦報酬の1日上限'],
  ['firstWinBonus', '20', '本日の初勝利報酬'], ['packDailyLimit', '10', 'パックの1日購入上限'],
  ['sellN', '10', 'N売却価格'], ['sellR', '30', 'R売却価格'], ['sellSR', '100', 'SR売却価格'], ['sellSSR', '300', 'SSR売却価格'],
  ['perfectBonus', '50', 'テストで初めて満点を取ったときのボーナス'],
  ['defaultReflectionPoint', '20', '振り返りのお題の標準Gポイント'],
];
const GC_STARTER_PACK = ['starter', 'スタートパック', 200, 3, '{"N":70,"R":30}', '["G001","G002","C008","P001","P003"]', 0, '', '', true];
const GC_FIRST_WAVE_PACK = ['first-wave', '第1弾パック', 200, 3, '{"N":68.5,"R":30,"SSR":1.5}', '["G001","G002","C008","P001","P003","G006","C002","P002","P017","C014"]', 0, '', '', true];
const GC_STARTER_DECKS = [
  ['sample', 'サンプルカードセット', '["G001","G002","C008","P001","P003","G006","C002","P002","P017","C014"]', 100, 0],
  ['cpu-1', 'CPU Lv1の候補', '["G001","G002","C008","P001","P003","G006","C002","P002","P017","C014"]', 100, 0],
  ['cpu-2', 'CPU Lv2の候補', '["G001","G002","C008","P001","P003","G006","C002","P002","P017","C014"]', 110, 5],
  ['cpu-3', 'CPU Lv3の候補', '["G001","G002","C008","P001","P003","G006","C002","P002","P017","C014"]', 130, 10],
];
const GC_STARTER_MISSIONS = [
  ['daily-test', 'daily', 'submit_test', 1, 30, 'テストを1回受ける', true, 1],
  ['daily-win', 'daily', 'win_battle', 1, 20, 'CPU対戦で1回勝つ', true, 2],
  ['daily-train', 'daily', 'train', 1, 10, 'トレーニングを1回する', true, 3],
  ['weekly-test', 'weekly', 'submit_test', 3, 100, '今週テストを3回受ける', true, 4],
  ['weekly-reflection', 'weekly', 'submit_reflection', 2, 100, '今週振り返りを2回提出する', true, 5],
];

function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Gカード用スプレッドシートから Apps Script を開いてください');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', book.getId());
  Object.keys(GC_HEADERS).forEach(function (name) {
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    const headers = GC_HEADERS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (name === 'Cards' && actual.slice(0, -1).join('|') === headers.slice(0, -1).join('|') && actual[headers.length - 1] === '') {
        sheet.getRange(1, headers.length).setValue('trainingBonus');
        actual[headers.length - 1] = 'trainingBonus';
      }
      if (actual.join('|') !== headers.join('|')) throw new Error(name + ' シートの見出しが異なります');
    }
  });
  const cards = gcSheet_('Cards');
  if (cards.getLastRow() === 1) cards.getRange(2, 1, GC_CARDS.length, GC_HEADERS.Cards.length).setValues(GC_CARDS);
  // 既存の学校用シートでは、先生が変更した価格を上書きしない。
  if (cards.getLastRow() > 1) {
    const values = cards.getRange(2, 1, cards.getLastRow() - 1, GC_HEADERS.Cards.length).getValues();
    values.forEach(function (row, index) {
      const seed = GC_CARDS.find(function (card) { return card[0] === row[0]; });
      if (seed && row[8] === '') cards.getRange(index + 2, 9).setValue(seed[8]);
      if (row[3] === 'UR') cards.getRange(index + 2, 4).setValue('SSR');
    });
    const existingIds = values.map(function (row) { return row[0]; });
    const missingCards = GC_CARDS.filter(function (row) { return existingIds.indexOf(row[0]) < 0; });
    if (missingCards.length) cards.getRange(cards.getLastRow() + 1, 1, missingCards.length, GC_HEADERS.Cards.length).setValues(missingCards);
  }
  const settings = gcSheet_('Settings');
  if (settings.getLastRow() === 1) {
    settings.getRange(2, 1, 7, 3).setValues([
      ['schoolDomain', '', '学校メールの@より後。例: school.example.jp'],
      ['adminEmails', '', '管理者の学校メール。複数ならカンマ区切り'],
      ['sessionDays', '7', 'セッション有効日数'],
      ['welcomeBonus', '100', '初回設定時のGポイント'],
      ['loginBonus', '10', '1日1回のGポイント'],
      ['loginStreakBonus', '100', '7日目の追加Gポイント'],
      ['initialLife', '100', '初期ライフ'],
    ]);
  }
  // 以前の設定手順で使った一時行を先に処理する。学校の値を公開ソースに残さない。
  const pending = settings.getRange(9, 1, 1, 2).getValues()[0];
  if (pending[0] === 'googleClientIdSetup') {
    const clientId = String(pending[1] || '').trim();
    if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('Settings!B9 のGoogleクライアントIDを確認してください');
    properties.setProperty('GOOGLE_CLIENT_ID', clientId);
    settings.getRange(9, 1, 1, 3).clearContent();
  }
  const existingSettings = settings.getDataRange().getValues().map(function (row) { return String(row[0]); });
  const missingSettings = GC_ECONOMY_SETTINGS.filter(function (row) { return existingSettings.indexOf(row[0]) < 0; });
  const oldSell = settings.getDataRange().getValues().find(function (row) { return row[0] === 'sellUR'; });
  if (oldSell) missingSettings.forEach(function (row) { if (row[0] === 'sellSSR') row[1] = String(oldSell[1] || '300'); });
  if (missingSettings.length) settings.getRange(settings.getLastRow() + 1, 1, missingSettings.length, 3).setValues(missingSettings);
  const packs = gcSheet_('Packs');
  if (packs.getLastRow() === 1) packs.appendRow(GC_STARTER_PACK);
  const packRows = packs.getDataRange().getValues();
  const packIds = packRows.map(function (row) { return row[0]; });
  packRows.forEach(function (row, index) {
    if (index > 0 && row[0] && String(row[4]).indexOf('"UR"') >= 0) packs.getRange(index + 1, 5).setValue(JSON.stringify(gcRarityRates_(row[4])));
  });
  if (packIds.indexOf(GC_FIRST_WAVE_PACK[0]) < 0) packs.appendRow(GC_FIRST_WAVE_PACK);
  const decks = gcSheet_('Decks');
  if (decks.getLastRow() === 1) decks.getRange(2, 1, GC_STARTER_DECKS.length, GC_HEADERS.Decks.length).setValues(GC_STARTER_DECKS);
  else {
    const rows = decks.getDataRange().getValues();
    rows.forEach(function (row, index) {
      const seed = GC_STARTER_DECKS.find(function (item) { return item[0] === row[0]; });
      if (!seed || index === 0) return;
      const current = JSON.parse(row[2] || '[]');
      const added = JSON.parse(seed[2]).filter(function (id) { return current.indexOf(id) < 0; });
      if (added.length) decks.getRange(index + 1, 3).setValue(JSON.stringify(current.concat(added)));
    });
  }
  const missions = gcSheet_('Missions');
  if (missions.getLastRow() === 1) missions.getRange(2, 1, GC_STARTER_MISSIONS.length, GC_HEADERS.Missions.length).setValues(GC_STARTER_MISSIONS);
  if (!properties.getProperty('SESSION_SECRET')) {
    properties.setProperty('SESSION_SECRET', [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('-'));
  }
  if (!properties.getProperty('REFLECTION_REWARD_START_AT')) properties.setProperty('REFLECTION_REWARD_START_AT', new Date().toISOString());
  ['Cards', 'Packs', 'Decks', 'Missions'].forEach(gcClearMasterCache_);
  return 'Gカードの設定が完了しました。Settings の schoolDomain と adminEmails、スクリプトプロパティの GOOGLE_CLIENT_ID を確認してください。';
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Gカード API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// HTML Service 内の google.script.run から呼ぶ。認証と権限検査は gcDispatch_ が行う。
function bridgeRequest(request) {
  try { return { ok: true, data: gcDispatch_(request) }; }
  catch (error) { return { ok: false, error: { code: error.code || 'SERVER_ERROR', message: error.publicMessage || '処理できませんでした。先生に伝えてください' } }; }
}

function doPost(event) {
  let response;
  try {
    if (!event || !event.postData || !event.postData.contents) gcError_('BAD_REQUEST', 'リクエストがありません');
    const request = JSON.parse(event.postData.contents);
    response = { ok: true, data: gcDispatch_(request) };
  } catch (error) {
    response = { ok: false, error: { code: error.code || 'SERVER_ERROR', message: error.publicMessage || '処理できませんでした。先生に伝えてください' } };
  }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function gcDispatch_(request) {
  if (!request || typeof request.action !== 'string') gcError_('BAD_REQUEST', '操作が指定されていません');
  switch (request.action) {
    case 'login': return gcLogin_(request.payload || {});
    case 'bootstrap': return gcBootstrap_(request.session);
    case 'setNickname': return gcSetNickname_(request.session, request.payload || {});
    case 'adminImportRoster': return gcImportRoster_(request.session, request.payload || {});
    case 'buyCard': return gcBuyCard_(request.session, request.payload || {}, request.requestId);
    case 'sellCard': return gcSellCard_(request.session, request.payload || {}, request.requestId);
    case 'openPack': return gcOpenPack_(request.session, request.payload || {}, request.requestId);
    case 'train': return gcTrain_(request.session, request.payload || {}, request.requestId);
    case 'saveDeck': return gcSaveDeck_(request.session, request.payload || {});
    case 'reportBattle': return gcReportBattle_(request.session, request.payload || {});
    case 'onlineJoin': return gcOnlineJoin_(request.session, request.payload || {});
    case 'onlineReport': return gcOnlineReport_(request.session, request.payload || {});
    case 'onlineResult': return gcOnlineResult_(request.session, request.payload || {});
    case 'getRanking': return gcGetRanking_(request.session);
    case 'adminSaveSettings': return gcAdminSaveSettings_(request.session, request.payload || {});
    case 'adminSaveCard': return gcAdminSaveCard_(request.session, request.payload || {});
    case 'adminSavePack': return gcAdminSavePack_(request.session, request.payload || {});
    case 'adminSaveMission': return gcAdminSaveMission_(request.session, request.payload || {});
    case 'adminGetEconomy': return gcAdminGetEconomy_(request.session);
    case 'adminSaveDeck': return gcAdminSaveDeck_(request.session, request.payload || {});
    case 'getBattleConfig': return gcBattleConfig_(request.session);
    case 'listTests': return gcListTests_(request.session);
    case 'getTest': return gcGetTest_(request.session, request.payload || {});
    case 'submitTest': return gcSubmitTest_(request.session, request.payload || {}, request.requestId);
    case 'getTestResult': return gcGetTestResult_(request.session, request.payload || {});
    case 'listReflections': return gcListReflections_(request.session);
    case 'syncReflections': return gcSyncReflections_(request.session);
    case 'adminListTests': return gcAdminListTests_(request.session);
    case 'adminGetTest': return gcAdminGetTest_(request.session, request.payload || {});
    case 'adminSaveTest': return gcAdminSaveTest_(request.session, request.payload || {});
    case 'adminDeleteTest': return gcAdminDeleteTest_(request.session, request.payload || {});
    case 'adminTestResponses': return gcAdminTestResponses_(request.session, request.payload || {});
    case 'adminDashboard': return gcAdminDashboard_(request.session);
    case 'adminListStudents': return gcAdminListStudents_(request.session);
    case 'adminStudentDetail': return gcAdminStudentDetail_(request.session, request.payload || {});
    case 'adminAdjustPoints': return gcAdminAdjustPoints_(request.session, request.payload || {}, request.requestId);
    case 'adminResetNickname': return gcAdminResetNickname_(request.session, request.payload || {}, request.requestId);
    case 'adminExportData': return gcAdminExportData_(request.session, request.payload || {});
    default: gcError_('NOT_IMPLEMENTED', 'この機能はまだ利用できません');
  }
}

function gcError_(code, message) {
  const error = new Error(message);
  error.code = code;
  error.publicMessage = message;
  throw error;
}

function gcSheet_(name) {
  const sheet = SpreadsheetApp.openById(gcProperty_('SPREADSHEET_ID')).getSheetByName(name);
  if (!sheet) gcError_('NOT_SETUP', '先生による初期設定が必要です');
  return sheet;
}

function gcMasterRows_(name) {
  const key = 'gc-master:' + name;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* キャッシュを読めない場合はシートから読む。 */ }
  const rows = gcSheet_(name).getDataRange().getValues().slice(1);
  try { CacheService.getScriptCache().put(key, JSON.stringify(rows), 60); }
  catch (_) { /* キャッシュ容量を超えても処理は続ける。 */ }
  return rows;
}

function gcClearMasterCache_(name) {
  try { CacheService.getScriptCache().remove('gc-master:' + name); }
  catch (_) { /* キャッシュが使えなくてもシートの更新は有効。 */ }
}

function gcSettings_() {
  const values = gcSheet_('Settings').getDataRange().getValues();
  const settings = {};
  values.slice(1).forEach(function (row) { if (row[0]) settings[String(row[0])] = String(row[1]).trim(); });
  return settings;
}

function gcProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) gcError_('NOT_SETUP', '先生による初期設定が必要です');
  return value;
}

function gcAdminEmails_(settings) {
  return String(settings.adminEmails || '').split(',').map(function (email) { return email.trim().toLowerCase(); }).filter(Boolean);
}

function gcFindUser_(email) {
  const sheet = gcSheet_('Users');
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const emails = sheet.getRange(2, 1, last - 1, 1).getValues();
  const index = emails.findIndex(function (row) { return String(row[0]).trim().toLowerCase() === email; });
  if (index < 0) return null;
  const rowNumber = index + 2;
  return { sheet: sheet, rowNumber: rowNumber, values: sheet.getRange(rowNumber, 1, 1, GC_HEADERS.Users.length).getValues()[0] };
}

function gcUserObject_(record) {
  const user = {};
  GC_HEADERS.Users.forEach(function (key, index) { user[key] = record.values[index]; });
  return user;
}

function gcWriteUser_(record, user) {
  record.sheet.getRange(record.rowNumber, 1, 1, GC_HEADERS.Users.length).setValues([GC_HEADERS.Users.map(function (key) { return user[key] === undefined ? '' : user[key]; })]);
}

function gcValidateGoogle_(idToken, settings) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 8192) gcError_('INVALID_LOGIN', 'Googleログインをやり直してください');
  const domain = String(settings.schoolDomain || '').replace(/^@/, '').toLowerCase();
  if (!domain) gcError_('NOT_SETUP', '学校ドメインの設定が必要です');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) gcError_('INVALID_LOGIN', 'Googleログインをやり直してください');
  const info = JSON.parse(response.getContentText());
  const clientId = gcProperty_('GOOGLE_CLIENT_ID');
  const email = String(info.email || '').toLowerCase();
  const validIssuer = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== clientId || !validIssuer || Number(info.exp) * 1000 <= Date.now() ||
      info.email_verified !== 'true' && info.email_verified !== true ||
      String(info.hd || '').toLowerCase() !== domain || !email.endsWith('@' + domain)) {
    gcError_('INVALID_LOGIN', '学校のGoogleアカウントでログインしてください');
  }
  return email;
}

function gcSignSession_(email, role, settings) {
  const days = Math.max(1, Math.min(30, Number(settings.sessionDays) || 7));
  const data = { email: email, role: role, exp: Date.now() + days * 86400000 };
  const body = 'v1.' + Utilities.base64EncodeWebSafe(JSON.stringify(data), Utilities.Charset.UTF_8).replace(/=+$/, '');
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, gcProperty_('SESSION_SECRET'))).replace(/=+$/, '');
  return body + '.' + signature;
}

function gcSession_(token, requireAdmin) {
  if (typeof token !== 'string' || token.length > 8192) gcError_('LOGIN_REQUIRED', 'ログインしてください');
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') gcError_('LOGIN_REQUIRED', 'ログインしてください');
  const body = parts[0] + '.' + parts[1];
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, gcProperty_('SESSION_SECRET'))).replace(/=+$/, '');
  if (!gcEqual_(parts[2], expected)) gcError_('LOGIN_REQUIRED', 'ログインしてください');
  let claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString('UTF-8')); }
  catch (_) { gcError_('LOGIN_REQUIRED', 'ログインしてください'); }
  if (!claims || typeof claims.email !== 'string' || Number(claims.exp) <= Date.now()) gcError_('LOGIN_REQUIRED', 'ログインしてください');
  const settings = gcSettings_();
  const domain = String(settings.schoolDomain || '').replace(/^@/, '').toLowerCase();
  const email = claims.email.toLowerCase();
  if (!domain || !email.endsWith('@' + domain)) gcError_('LOGIN_REQUIRED', 'ログインしてください');
  const admin = gcAdminEmails_(settings).indexOf(email) >= 0;
  if (requireAdmin && !admin) gcError_('FORBIDDEN', '管理者のみ利用できます');
  const record = gcFindUser_(email);
  if (!record) gcError_('LOGIN_REQUIRED', 'ログインしてください');
  return { email: email, admin: admin, record: record, settings: settings };
}

function gcEqual_(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function gcWithLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) gcError_('BUSY', '混み合っています。もう一度試してください');
  try { const result = callback(); SpreadsheetApp.flush(); return result; } finally { lock.releaseLock(); }
}

function gcLogin_(payload) {
  const settings = gcSettings_();
  const email = gcValidateGoogle_(payload.idToken, settings);
  const admin = gcAdminEmails_(settings).indexOf(email) >= 0;
  let record = gcFindUser_(email);
  if (!record && !admin) gcError_('NOT_IN_ROSTER', 'このアカウントは登録されていません。先生に伝えてください');
  if (!record && admin) {
    record = gcWithLock_(function () {
      const existing = gcFindUser_(email);
      if (existing) return existing;
      const now = new Date().toISOString();
      gcSheet_('Users').appendRow([email, 'admin', '', '', '', '', 0, 0, 0, 0, '', 0, '', false, now, now]);
      return gcFindUser_(email);
    });
  }
  const user = gcUserObject_(record);
  return { session: gcSignSession_(email, admin ? 'admin' : 'student', settings), needsNickname: !user.nickname, role: admin ? 'admin' : 'student' };
}

function gcPointLog_(email, delta, reason, refId, balance) {
  gcSheet_('PointLog').appendRow([Utilities.getUuid(), email, delta, reason, refId, balance, new Date().toISOString()]);
}

function gcPointLogEntry_(email, reason, refId) {
  const sheet = gcSheet_('PointLog');
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 5).getValues();
  return rows.find(function (row) { return String(row[0]).toLowerCase() === email && row[2] === reason && gcDateKey_(row[3]) === refId; }) || null;
}

function gcSetNickname_(token, payload) {
  const identity = gcSession_(token, false);
  const nickname = String(payload.nickname || '').trim();
  if (!nickname || Array.from(nickname).length > 8 || /^[=+\-@]/.test(nickname) || /[<>\r\n\t]/.test(nickname) || /ばか|しね|死ね/i.test(nickname)) gcError_('INVALID_NICKNAME', 'ニックネームは8文字以内で入力してください');
  return gcWithLock_(function () {
    const record = gcFindUser_(identity.email);
    if (!record) gcError_('LOGIN_REQUIRED', 'ログインしてください');
    const user = gcUserObject_(record);
    if (user.nickname) gcError_('ALREADY_SET', 'ニックネームは先生に変更を相談してください');
    user.nickname = nickname;
    if (user.welcomeGiven !== true) {
      const owned = gcSheet_('OwnedCards');
      const now = new Date().toISOString();
      const existing = gcOwned_(identity.email).map(function (card) { return card.cardId; });
      const rows = GC_INITIAL_CARDS.filter(function (cardId) { return existing.indexOf(cardId) < 0; }).map(function (cardId) { return [Utilities.getUuid(), identity.email, cardId, 0, 'initial', now, '']; });
      if (rows.length) owned.getRange(owned.getLastRow() + 1, 1, rows.length, GC_HEADERS.OwnedCards.length).setValues(rows);
      const bonus = Number(identity.settings.welcomeBonus) || 100;
      const prior = gcPointLogEntry_(identity.email, 'welcome', 'initial');
      if (!prior) gcPointLog_(identity.email, bonus, 'welcome', 'initial', Number(user.gPoint || 0) + bonus);
      user.gPoint = prior ? Number(prior[4]) : Number(user.gPoint || 0) + bonus;
      user.totalEarned = Number(user.totalEarned || 0) + bonus;
      user.welcomeGiven = true;
    }
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    return { needsNickname: false };
  });
}

function gcToday_() { return Utilities.formatDate(new Date(), GC_TZ, 'yyyy-MM-dd'); }
function gcDateKey_(value) { return value instanceof Date ? Utilities.formatDate(value, GC_TZ, 'yyyy-MM-dd') : String(value || ''); }
function gcDayNumber_(dateText) { return Date.parse(dateText + 'T00:00:00Z') / 86400000; }

function gcCardMaster_() {
  return gcMasterRows_('Cards').filter(function (row) { return row[0]; }).map(function (row) {
    return { cardId: row[0], name: row[1], type: row[2], rarity: row[3] === 'UR' ? 'SSR' : row[3], text: row[4], effects: JSON.parse(row[5] || '[]'), trainingMultiplier: Number(row[6] || 0), trainingBonus: Number(row[13] || 0), image: row[7], shopPrice: row[8] === '' ? null : Number(row[8]), inPack: row[9] === true, active: row[10] === true };
  });
}

function gcRarityRates_(json) {
  const rates = JSON.parse(json || '{}');
  if (rates.UR !== undefined) {
    rates.SSR = Number(rates.SSR || 0) + Number(rates.UR || 0);
    delete rates.UR;
  }
  return rates;
}

function gcOwned_(email) {
  return gcSheet_('OwnedCards').getDataRange().getValues().slice(1).filter(function (row) { return String(row[1]).toLowerCase() === email && !row[6]; }).map(function (row) {
    return { ownedId: row[0], cardId: row[2], trainLevel: Number(row[3] || 0), source: row[4] };
  });
}

function gcPackMaster_() {
  return gcMasterRows_('Packs').filter(function (row) { return row[0] && row[9] === true; }).map(function (row) {
    return { packId: String(row[0]), name: String(row[1]), price: Number(row[2]), cardsPerPack: Number(row[3]), rarityRates: gcRarityRates_(row[4]), cardPool: JSON.parse(row[5] || '[]'), pityCount: Number(row[6] || 0), startAt: row[7] ? gcDateKey_(row[7]) : '', endAt: row[8] ? gcDateKey_(row[8]) : '' };
  });
}

function gcCounter_(email, today, create) {
  const sheet = gcSheet_('DailyCounters');
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(function (row, i) { return i > 0 && String(row[0]).toLowerCase() === email && gcDateKey_(row[1]) === today; });
  if (index >= 0) return { sheet: sheet, rowNumber: index + 1, values: rows[index] };
  const values = [email, today, 0, 0, false, 0];
  if (create === false) return { sheet: sheet, rowNumber: 0, values: values };
  sheet.appendRow(values);
  return { sheet: sheet, rowNumber: sheet.getLastRow(), values: values };
}

function gcMissionPeriod_(period, today) {
  if (period === 'daily') return today;
  const date = new Date(today + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function gcMissionState_(email, today) {
  const progress = gcSheet_('MissionProgress').getDataRange().getValues();
  return gcMasterRows_('Missions').filter(function (row) { return row[0] && row[6] === true; }).map(function (row) {
    const periodKey = gcMissionPeriod_(String(row[1]), today);
    const found = progress.find(function (entry, index) { return index > 0 && String(entry[0]).toLowerCase() === email && entry[1] === row[0] && gcDateKey_(entry[2]) === periodKey; });
    return { missionId: String(row[0]), period: String(row[1]), condition: String(row[2]), targetCount: Number(row[3]), reward: Number(row[4]), label: String(row[5]), progress: found ? Number(found[3] || 0) : 0, completed: Boolean(found && found[4]) };
  });
}

function gcBattleConfig_(token) {
  gcSession_(token, false);
  return gcBattleConfigRows_();
}

function gcBattleConfigRows_() {
  return gcMasterRows_('Decks').filter(function (row) { return row[0]; }).map(function (row) {
    return { deckId: String(row[0]), name: String(row[1]), cardIds: JSON.parse(row[2] || '[]'), maxLife: Number(row[3] || 100), rockTrainLevel: Number(row[4] || 0) };
  });
}

function gcBootstrap_(token) {
  const identity = gcSession_(token, false);
  const today = gcToday_();
  let user = gcUserObject_(identity.record);
  let bonus = { awarded: false, amount: 0, streak: Number(user.loginStreak || 0) };
  if (user.nickname && gcDateKey_(user.lastLoginDate) !== today) {
    bonus = gcWithLock_(function () {
      const record = gcFindUser_(identity.email);
      const user = gcUserObject_(record);
      const outcome = { awarded: false, amount: 0, streak: Number(user.loginStreak || 0) };
      const previous = gcDateKey_(user.lastLoginDate);
      if (user.nickname && previous !== today) {
        const consecutive = previous && gcDayNumber_(today) - gcDayNumber_(previous) === 1;
        const streak = consecutive ? Number(user.loginStreak || 0) + 1 : 1;
        const award = (Number(identity.settings.loginBonus) || 10) + (streak % 7 === 0 ? Number(identity.settings.loginStreakBonus) || 100 : 0);
        const prior = gcPointLogEntry_(identity.email, 'login_bonus', today);
        if (!prior) {
          user.gPoint = Number(user.gPoint || 0) + award;
          user.totalEarned = Number(user.totalEarned || 0) + award;
          gcPointLog_(identity.email, award, 'login_bonus', today, user.gPoint);
        }
        user.loginStreak = streak;
        user.lastLoginDate = today;
        user.updatedAt = new Date().toISOString();
        gcWriteUser_(record, user);
        gcAwardMissions_(identity, user, { login: 1 });
        gcWriteUser_(record, user);
        outcome.awarded = !prior;
        outcome.amount = prior ? 0 : award;
        outcome.streak = streak;
      }
      return outcome;
    });
    user = gcUserObject_(gcFindUser_(identity.email));
  }
  return {
      profile: { nickname: String(user.nickname || ''), role: identity.admin ? 'admin' : 'student', gPoint: Number(user.gPoint || 0), maxLife: gcNumber_(identity.settings, 'initialLife', 100, 1, 9999) + Number(user.runCount || 0) * gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100), runCount: Number(user.runCount || 0), pityCounter: Number(user.pityCounter || 0) },
      needsNickname: !user.nickname,
      loginBonus: bonus,
      ownedCards: gcOwned_(identity.email),
      cardMaster: gcCardMaster_(),
      lastDeck: user.lastDeckJson ? JSON.parse(user.lastDeckJson) : [],
      packs: gcPackMaster_(),
      battleConfig: gcBattleConfigRows_(),
      missions: gcMissionState_(identity.email, today),
      daily: (function () { const counter = gcCounter_(identity.email, today, false).values; return { cpuRewards: Number(counter[2] || 0), onlineRewards: Number(counter[3] || 0), packsBought: Number(counter[5] || 0) }; })(),
      economy: { enabled: identity.admin || identity.settings.economyEnabled === '1', muscleCostBase: gcNumber_(identity.settings, 'muscleCostBase', 20, 0, 100000), muscleCostStep: gcNumber_(identity.settings, 'muscleCostStep', 2, 0, 100000), runCostBase: gcNumber_(identity.settings, 'runCostBase', 60, 0, 100000), runCostStep: gcNumber_(identity.settings, 'runCostStep', 6, 0, 100000), lifePerRun: gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100), cpuRewardDailyCap: gcNumber_(identity.settings, 'cpuRewardDailyCap', 3, 0, 100), packDailyLimit: gcNumber_(identity.settings, 'packDailyLimit', 10, 0, 1000), sellPrices: { N: gcNumber_(identity.settings, 'sellN', 10, 0, 100000), R: gcNumber_(identity.settings, 'sellR', 30, 0, 100000), SR: gcNumber_(identity.settings, 'sellSR', 100, 0, 100000), SSR: gcNumber_(identity.settings, 'sellSSR', gcNumber_(identity.settings, 'sellUR', 300, 0, 100000), 0, 100000) } },
      // ホーム表示のたびに受験履歴を全件走査しない。件数はテスト一覧を開いた時に取得する。
      unreadTests: 0, pendingReflections: 0,
      learning: { enabled: identity.admin || identity.settings.learningEnabled === '1' },
      online: { enabled: identity.settings.onlineEnabled === '1', rankingEnabled: identity.settings.rankingEnabled !== '0', rewardDailyCap: gcNumber_(identity.settings, 'onlineRewardDailyCap', 3, 0, 100) },
    };
}

function gcImportRoster_(token, payload) {
  const identity = gcSession_(token, true);
  if (typeof payload.csv !== 'string' || payload.csv.length > 2000000) gcError_('BAD_CSV', 'CSVファイルを確認してください');
  const rows = Utilities.parseCsv(payload.csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
  if (rows.length < 2 || rows[0].map(function (value) { return String(value).trim().toLowerCase(); }).join(',') !== 'email,class,number,name') {
    gcError_('BAD_CSV', 'CSVの先頭行は email,class,number,name にしてください');
  }
  const domain = String(identity.settings.schoolDomain || '').replace(/^@/, '').toLowerCase();
  const seen = {};
  const entries = rows.slice(1).filter(function (row) { return row.some(Boolean); }).map(function (row) {
    const email = String(row[0] || '').trim().toLowerCase();
    if (row.length !== 4 || !email.endsWith('@' + domain) || seen[email] || !String(row[3] || '').trim() ||
        row.slice(1).some(function (value) { return /^[=+\-@]/.test(String(value).trim()); })) gcError_('BAD_CSV', 'CSVのメールアドレス・氏名・重複を確認してください');
    seen[email] = true;
    return [email, String(row[1] || '').trim(), String(row[2] || '').trim(), String(row[3] || '').trim()];
  });
  if (!entries.length) gcError_('BAD_CSV', '名簿の行がありません');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Users');
    const current = sheet.getDataRange().getValues();
    const byEmail = {};
    current.slice(1).forEach(function (row, index) { byEmail[String(row[0]).toLowerCase()] = index + 2; });
    const additions = [];
    let updated = 0;
    const now = new Date().toISOString();
    entries.forEach(function (entry) {
      const rowNumber = byEmail[entry[0]];
      if (rowNumber) {
        sheet.getRange(rowNumber, 3, 1, 3).setValues([[entry[1], entry[2], entry[3]]]);
        updated++;
      } else {
        additions.push([entry[0], 'student', entry[1], entry[2], entry[3], '', 0, 0, 0, 0, '', 0, '', false, now, now]);
      }
    });
    if (additions.length) sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, GC_HEADERS.Users.length).setValues(additions);
    return { added: additions.length, updated: updated, total: entries.length };
  });
}

function gcRequestId_(requestId) {
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{20,64}$/i.test(requestId)) gcError_('BAD_REQUEST', '操作をやり直してください');
  return requestId;
}

function gcNumber_(settings, key, fallback, min, max) {
  const value = settings[key] === '' || settings[key] === undefined ? fallback : Number(settings[key]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function gcEconomyAccess_(identity) {
  if (!identity.admin && identity.settings.economyEnabled !== '1') gcError_('NOT_READY', 'この機能は準備中です');
}

function gcState_(identity, extra) {
  const user = gcUserObject_(gcFindUser_(identity.email));
  const counter = gcCounter_(identity.email, gcToday_()).values;
  return Object.assign({
    gPoint: Number(user.gPoint || 0), runCount: Number(user.runCount || 0), pityCounter: Number(user.pityCounter || 0),
    maxLife: gcNumber_(identity.settings, 'initialLife', 100, 1, 9999) + Number(user.runCount || 0) * gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100),
    ownedCards: gcOwned_(identity.email), lastDeck: user.lastDeckJson ? JSON.parse(user.lastDeckJson) : [],
    missions: gcMissionState_(identity.email, gcToday_()),
    daily: { cpuRewards: Number(counter[2] || 0), onlineRewards: Number(counter[3] || 0), packsBought: Number(counter[5] || 0) },
  }, extra || {});
}

function gcCachedResult_(email, action, requestId) {
  const key = 'gc:' + action + ':' + email + ':' + requestId;
  try {
    const value = CacheService.getScriptCache().get(Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key)).slice(0, 160));
    return value ? JSON.parse(value) : null;
  } catch (_) { return null; }
}

function gcRememberResult_(email, action, requestId, result) {
  const key = 'gc:' + action + ':' + email + ':' + requestId;
  try { CacheService.getScriptCache().put(Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key)).slice(0, 160), JSON.stringify(result), 21600); }
  catch (_) { /* PointLogとBattleLogでも重複を防ぐ。 */ }
  return result;
}

function gcAwardMissions_(identity, user, conditions) {
  const today = gcToday_();
  const sheet = gcSheet_('MissionProgress');
  const rows = sheet.getDataRange().getValues();
  const completed = [];
  gcMasterRows_('Missions').forEach(function (mission) {
    if (!mission[0] || mission[6] !== true || !conditions[mission[2]]) return;
    const periodKey = gcMissionPeriod_(String(mission[1]), today);
    let rowNumber = rows.findIndex(function (entry, index) { return index > 0 && String(entry[0]).toLowerCase() === identity.email && entry[1] === mission[0] && gcDateKey_(entry[2]) === periodKey; }) + 1;
    const current = rowNumber ? Number(rows[rowNumber - 1][3] || 0) : 0;
    const done = rowNumber && rows[rowNumber - 1][4];
    if (done) return;
    const next = Math.min(Number(mission[3]), current + Number(conditions[mission[2]]));
    const nowComplete = next >= Number(mission[3]);
    if (rowNumber) sheet.getRange(rowNumber, 4, 1, 2).setValues([[next, nowComplete ? new Date().toISOString() : '']]);
    else {
      sheet.appendRow([identity.email, mission[0], periodKey, next, nowComplete ? new Date().toISOString() : '']);
      rowNumber = sheet.getLastRow();
      rows.push([identity.email, mission[0], periodKey, next, nowComplete ? new Date().toISOString() : '']);
    }
    if (nowComplete) {
      const reward = Number(mission[4] || 0);
      user.gPoint = Number(user.gPoint || 0) + reward;
      user.totalEarned = Number(user.totalEarned || 0) + reward;
      gcPointLog_(identity.email, reward, 'mission', String(mission[0]) + ':' + periodKey, user.gPoint);
      completed.push({ label: String(mission[5]), reward: reward });
    }
  });
  return completed;
}

function gcBuyCard_(token, payload, requestId) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  gcRequestId_(requestId);
  return gcWithLock_(function () {
    if (gcPointLogEntry_(identity.email, 'buy_card', requestId)) return gcCachedResult_(identity.email, 'buy_card', requestId) || gcState_(identity);
    const card = gcCardMaster_().find(function (item) { return item.cardId === payload.cardId; });
    if (!card || !card.active || card.rarity === 'SSR' || card.shopPrice === null || card.shopPrice < 0) gcError_('NOT_FOR_SALE', 'このカードは購入できません');
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    if (Number(user.gPoint || 0) < card.shopPrice) gcError_('NOT_ENOUGH_POINTS', 'Gポイントが足りません');
    const ownedId = Utilities.getUuid();
    gcSheet_('OwnedCards').appendRow([ownedId, identity.email, card.cardId, 0, 'shop', new Date().toISOString(), '']);
    user.gPoint = Number(user.gPoint || 0) - card.shopPrice;
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    gcPointLog_(identity.email, -card.shopPrice, 'buy_card', requestId, user.gPoint);
    return gcRememberResult_(identity.email, 'buy_card', requestId, gcState_(identity, { acquired: [{ ownedId: ownedId, cardId: card.cardId, trainLevel: 0 }] }));
  });
}

function gcSellCard_(token, payload, requestId) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  gcRequestId_(requestId);
  return gcWithLock_(function () {
    if (gcPointLogEntry_(identity.email, 'sell_card', requestId)) return gcCachedResult_(identity.email, 'sell_card', requestId) || gcState_(identity);
    const owned = gcOwned_(identity.email);
    if (owned.length <= 4) gcError_('MIN_CARDS', 'カードは4枚以上残してください');
    const target = owned.find(function (item) { return item.ownedId === payload.ownedId; });
    if (!target) gcError_('NOT_OWNED', 'このカードは所持していません');
    const card = gcCardMaster_().find(function (item) { return item.cardId === target.cardId; });
    const price = gcNumber_(identity.settings, 'sell' + card.rarity, 10, 0, 100000);
    const sheet = gcSheet_('OwnedCards');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row, i) { return i > 0 && row[0] === target.ownedId && String(row[1]).toLowerCase() === identity.email && !row[6]; });
    if (index < 1) gcError_('NOT_OWNED', 'このカードは所持していません');
    sheet.getRange(index + 1, 7).setValue(new Date().toISOString());
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    user.gPoint = Number(user.gPoint || 0) + price;
    user.totalEarned = Number(user.totalEarned || 0) + price;
    const deck = user.lastDeckJson ? JSON.parse(user.lastDeckJson) : [];
    if (deck.indexOf(target.ownedId) >= 0) user.lastDeckJson = '';
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    gcPointLog_(identity.email, price, 'sell_card', requestId, user.gPoint);
    return gcRememberResult_(identity.email, 'sell_card', requestId, gcState_(identity));
  });
}

function gcTrain_(token, payload, requestId) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  gcRequestId_(requestId);
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 20) gcError_('BAD_REQUEST', 'トレーニングを選んでください');
  return gcWithLock_(function () {
    if (gcPointLogEntry_(identity.email, 'train', requestId)) return gcCachedResult_(identity.email, 'train', requestId) || gcState_(identity);
    const sheet = gcSheet_('OwnedCards');
    const rows = sheet.getDataRange().getValues();
    const cards = gcCardMaster_();
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    if (payload.items.reduce(function (sum, item) { return sum + Number(item.count || 0); }, 0) > 100) gcError_('BAD_REQUEST', '一度に100回までにしてください');
    payload.items.forEach(function (item) {
      if (!Number.isInteger(Number(item.count)) || Number(item.count) < 1 || Number(item.count) > 100) gcError_('BAD_REQUEST', '回数を確認してください');
      if (item.kind !== 'muscle' && item.kind !== 'run') gcError_('BAD_REQUEST', 'トレーニングを選んでください');
      if (item.kind === 'muscle' && !rows.some(function (row, i) { return i > 0 && row[0] === item.ownedId && String(row[1]).toLowerCase() === identity.email && !row[6] && cards.some(function (card) { return card.cardId === row[2] && card.type === 'rock'; }); })) gcError_('BAD_REQUEST', '筋トレできるカードを選んでください');
    });
    let spent = 0;
    let trained = 0;
    payload.items.forEach(function (item) {
      const count = Number(item.count);
      if (!Number.isInteger(count) || count < 1 || count > 100) gcError_('BAD_REQUEST', '回数を確認してください');
      if (item.kind === 'muscle') {
        const index = rows.findIndex(function (row, i) { return i > 0 && row[0] === item.ownedId && String(row[1]).toLowerCase() === identity.email && !row[6]; });
        if (index < 1 || !cards.some(function (card) { return card.cardId === rows[index][2] && card.type === 'rock'; })) gcError_('BAD_REQUEST', '筋トレできるカードを選んでください');
        for (let n = 0; n < count; n++) {
          const price = gcNumber_(identity.settings, 'muscleCostBase', 20, 0, 100000) + gcNumber_(identity.settings, 'muscleCostStep', 2, 0, 100000) * Number(rows[index][3] || 0);
          if (Number(user.gPoint || 0) < price) break;
          user.gPoint = Number(user.gPoint || 0) - price;
          rows[index][3] = Number(rows[index][3] || 0) + 1;
          spent += price; trained++;
        }
        sheet.getRange(index + 1, 4).setValue(rows[index][3]);
      } else if (item.kind === 'run') {
        for (let n = 0; n < count; n++) {
          const price = gcNumber_(identity.settings, 'runCostBase', 60, 0, 100000) + gcNumber_(identity.settings, 'runCostStep', 6, 0, 100000) * Number(user.runCount || 0);
          const nextLife = gcNumber_(identity.settings, 'initialLife', 100, 1, 9999) + (Number(user.runCount || 0) + 1) * gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100);
          if (Number(user.gPoint || 0) < price || (identity.settings.maxLifeCap && nextLife > Number(identity.settings.maxLifeCap))) break;
          user.gPoint = Number(user.gPoint || 0) - price;
          user.runCount = Number(user.runCount || 0) + 1;
          spent += price; trained++;
        }
      } else gcError_('BAD_REQUEST', 'トレーニングを選んでください');
    });
    if (!trained) gcError_('NOT_ENOUGH_POINTS', 'Gポイントが足りないか、ライフの上限に達しています');
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    gcPointLog_(identity.email, -spent, 'train', requestId, user.gPoint);
    const completedMissions = gcAwardMissions_(identity, user, { train: trained });
    gcWriteUser_(record, user);
    return gcRememberResult_(identity.email, 'train', requestId, gcState_(identity, { trained: trained, completedMissions: completedMissions }));
  });
}

function gcSaveDeck_(token, payload) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  if (!Array.isArray(payload.ownedIds) || payload.ownedIds.length !== 4 || new Set(payload.ownedIds).size !== 4) gcError_('BAD_DECK', '異なる所持カードを4枚選んでください');
  return gcWithLock_(function () {
    const owned = gcOwned_(identity.email);
    if (!payload.ownedIds.every(function (id) { return owned.some(function (card) { return card.ownedId === id; }); })) gcError_('BAD_DECK', '所持していないカードは使えません');
    const master = gcCardMaster_();
    const ssr = payload.ownedIds.filter(function (id) {
      const item = owned.find(function (card) { return card.ownedId === id; });
      return master.some(function (card) { return card.cardId === item.cardId && card.rarity === 'SSR'; });
    });
    if (ssr.length > 1) gcError_('BAD_DECK', 'SSRはデッキに1枚までです');
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    user.lastDeckJson = JSON.stringify(payload.ownedIds);
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    return gcState_(identity);
  });
}

function gcOpenPack_(token, payload, requestId) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  gcRequestId_(requestId);
  return gcWithLock_(function () {
    if (gcPointLogEntry_(identity.email, 'open_pack', requestId)) {
      const cached = gcCachedResult_(identity.email, 'open_pack', requestId);
      if (cached) return cached;
      const acquired = gcOwned_(identity.email).filter(function (card) { return card.source === 'pack:' + requestId; });
      return gcState_(identity, { acquired: acquired });
    }
    const pack = gcPackMaster_().find(function (item) { return item.packId === payload.packId; });
    const today = gcToday_();
    if (!pack || pack.startAt && pack.startAt.slice(0, 10) > today || pack && pack.endAt && pack.endAt.slice(0, 10) < today) gcError_('NOT_FOR_SALE', 'このパックは購入できません');
    const counter = gcCounter_(identity.email, today);
    if (Number(counter.values[5] || 0) >= gcNumber_(identity.settings, 'packDailyLimit', 10, 0, 1000)) gcError_('DAILY_LIMIT', '今日のパック購入上限に達しました');
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    if (Number(user.gPoint || 0) < pack.price) gcError_('NOT_ENOUGH_POINTS', 'Gポイントが足りません');
    const master = gcCardMaster_();
    const pool = master.filter(function (card) { return card.active && card.inPack && pack.cardPool.indexOf(card.cardId) >= 0; });
    const rates = Object.keys(pack.rarityRates).map(function (rarity) { return { rarity: rarity, rate: Number(pack.rarityRates[rarity]), cards: pool.filter(function (card) { return card.rarity === rarity; }) }; });
    if (!Number.isInteger(pack.cardsPerPack) || pack.cardsPerPack < 1 || pack.cardsPerPack > 10 ||
        !rates.length || rates.some(function (item) { return !item.cards.length || !Number.isFinite(item.rate) || item.rate <= 0; }) ||
        Math.abs(rates.reduce(function (sum, item) { return sum + item.rate; }, 0) - 100) > .001 ||
        pack.pityCount > 0 && !pool.some(function (card) { return card.rarity === 'SR' || card.rarity === 'SSR'; })) gcError_('BAD_PACK', 'パックの設定を先生に確認してください');
    const drawn = [];
    let pity = Number(user.pityCounter || 0);
    for (let index = 0; index < pack.cardsPerPack; index++) {
      const guaranteed = index === 0 && pack.pityCount > 0 && pity >= pack.pityCount;
      const choices = guaranteed ? rates.filter(function (item) { return item.rarity === 'SR' || item.rarity === 'SSR'; }) : rates;
      const total = choices.reduce(function (sum, item) { return sum + item.rate; }, 0);
      let roll = Math.random() * total;
      let picked = choices[choices.length - 1];
      for (let n = 0; n < choices.length; n++) { roll -= choices[n].rate; if (roll < 0) { picked = choices[n]; break; } }
      drawn.push(picked.cards[Math.floor(Math.random() * picked.cards.length)]);
    }
    if (drawn.some(function (card) { return card.rarity === 'SR' || card.rarity === 'SSR'; })) pity = 0;
    else pity++;
    const acquired = drawn.map(function (card) { return { ownedId: Utilities.getUuid(), cardId: card.cardId, trainLevel: 0, rarity: card.rarity }; });
    const now = new Date().toISOString();
    const ownedSheet = gcSheet_('OwnedCards');
    ownedSheet.getRange(ownedSheet.getLastRow() + 1, 1, acquired.length, GC_HEADERS.OwnedCards.length).setValues(acquired.map(function (card) { return [card.ownedId, identity.email, card.cardId, 0, 'pack:' + requestId, now, '']; }));
    user.gPoint = Number(user.gPoint || 0) - pack.price;
    user.pityCounter = pity;
    user.updatedAt = now;
    gcWriteUser_(record, user);
    counter.values[5] = Number(counter.values[5] || 0) + 1;
    counter.sheet.getRange(counter.rowNumber, 1, 1, GC_HEADERS.DailyCounters.length).setValues([counter.values]);
    gcPointLog_(identity.email, -pack.price, 'open_pack', requestId, user.gPoint);
    const completedMissions = gcAwardMissions_(identity, user, { open_pack: 1 });
    gcWriteUser_(record, user);
    return gcRememberResult_(identity.email, 'open_pack', requestId, gcState_(identity, { acquired: acquired, completedMissions: completedMissions, pityRemaining: pack.pityCount ? Math.max(0, pack.pityCount - pity) : null }));
  });
}

function gcReportBattle_(token, payload) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  if (typeof payload.battleId !== 'string' || !/^[a-f0-9-]{20,64}$/i.test(payload.battleId) || payload.mode !== 'cpu' ||
      ![1, 2, 3].includes(Number(payload.cpuLevel)) || ['win', 'draw', 'loss'].indexOf(payload.result) < 0 ||
      ['sample', 'owned'].indexOf(payload.deckMode) < 0) gcError_('BAD_REQUEST', '対戦結果を確認できません');
  return gcWithLock_(function () {
    const log = gcSheet_('BattleLog');
    const old = log.getDataRange().getValues().slice(1).find(function (row) { return row[0] === payload.battleId && String(row[1]).toLowerCase() === identity.email; });
    if (old) return gcCachedResult_(identity.email, 'battle', payload.battleId) || gcState_(identity, { awarded: Number(old[7] || 0), duplicate: true });
    const today = gcToday_();
    const counter = gcCounter_(identity.email, today);
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    const remaining = gcNumber_(identity.settings, 'cpuRewardDailyCap', 3, 0, 100) - Number(counter.values[2] || 0);
    let award = 0;
    if (remaining > 0 && payload.result === 'win') {
      award += gcNumber_(identity.settings, 'cpuRewardLv' + Number(payload.cpuLevel), [0, 5, 10, 20][Number(payload.cpuLevel)], 0, 10000);
      counter.values[2] = Number(counter.values[2] || 0) + 1;
    }
    if (payload.result === 'win' && counter.values[4] !== true) {
      award += gcNumber_(identity.settings, 'firstWinBonus', 20, 0, 10000);
      counter.values[4] = true;
    }
    user.gPoint = Number(user.gPoint || 0) + award;
    user.totalEarned = Number(user.totalEarned || 0) + award;
    user.updatedAt = new Date().toISOString();
    gcWriteUser_(record, user);
    counter.sheet.getRange(counter.rowNumber, 1, 1, GC_HEADERS.DailyCounters.length).setValues([counter.values]);
    if (award) gcPointLog_(identity.email, award, 'battle', payload.battleId, user.gPoint);
    const completedMissions = gcAwardMissions_(identity, user, { play_cpu: 1, win_battle: payload.result === 'win' ? 1 : 0 });
    gcWriteUser_(record, user);
    log.appendRow([payload.battleId, identity.email, 'cpu', payload.deckMode, Number(payload.cpuLevel), payload.result, '', award, new Date().toISOString()]);
    return gcRememberResult_(identity.email, 'battle', payload.battleId, gcState_(identity, { awarded: award, completedMissions: completedMissions }));
  });
}

function gcAdminGetEconomy_(token) {
  gcSession_(token, true);
  const settings = gcSettings_();
  return {
    settings: GC_ECONOMY_SETTINGS.map(function (row) { return { key: row[0], value: settings[row[0]] === undefined ? row[1] : settings[row[0]], description: row[2] }; }),
    cards: gcCardMaster_(),
    packs: gcMasterRows_('Packs').filter(function (row) { return row[0]; }).map(function (row) { return { packId: row[0], name: row[1], price: Number(row[2]), cardsPerPack: Number(row[3]), rarityRates: gcRarityRates_(row[4]), cardPool: JSON.parse(row[5] || '[]'), pityCount: Number(row[6] || 0), active: row[9] === true }; }),
    missions: gcMasterRows_('Missions').filter(function (row) { return row[0]; }).map(function (row) { return { missionId: row[0], period: row[1], condition: row[2], targetCount: Number(row[3]), reward: Number(row[4]), label: row[5], active: row[6] === true }; }),
    decks: gcBattleConfigRows_(),
  };
}

function gcAdminSaveDeck_(token, payload) {
  gcSession_(token, true);
  if (['sample', 'cpu-1', 'cpu-2', 'cpu-3'].indexOf(payload.deckId) < 0 || !Array.isArray(payload.cardIds) || payload.cardIds.length < 4 || payload.cardIds.length > 20 || new Set(payload.cardIds).size !== payload.cardIds.length ||
      !Number.isInteger(Number(payload.maxLife)) || Number(payload.maxLife) < 1 || Number(payload.maxLife) > 9999 ||
      !Number.isInteger(Number(payload.rockTrainLevel)) || Number(payload.rockTrainLevel) < 0 || Number(payload.rockTrainLevel) > 99) gcError_('BAD_DECK', 'デッキの設定を確認してください');
  const master = gcCardMaster_();
  if (!payload.cardIds.every(function (id) { return master.some(function (card) { return card.cardId === id && card.active; }); })) gcError_('BAD_DECK', '有効なカードから選んでください');
  if (payload.cardIds.filter(function (id) { return master.some(function (card) { return card.cardId === id && card.rarity === 'SSR'; }); }).length > 1) gcError_('BAD_DECK', 'SSRは候補カードに1枚までです');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Decks');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row) { return row[0] === payload.deckId; });
    if (index < 1) gcError_('NOT_SETUP', 'デッキを初期化してください');
    sheet.getRange(index + 1, 3, 1, 3).setValues([[JSON.stringify(payload.cardIds), Number(payload.maxLife), Number(payload.rockTrainLevel)]]);
    gcClearMasterCache_('Decks');
    return { deckId: payload.deckId };
  });
}

function gcAdminSaveSettings_(token, payload) {
  gcSession_(token, true);
  const definition = GC_ECONOMY_SETTINGS.find(function (row) { return row[0] === payload.key; });
  if (!definition) gcError_('BAD_REQUEST', '変更できない設定です');
  const value = String(payload.value === undefined ? '' : payload.value).trim();
  if (value !== '' && (!/^\d+$/.test(value) || Number(value) > 100000)) gcError_('BAD_REQUEST', '0以上の整数を入力してください');
  if (value === '' && payload.key !== 'maxLifeCap') gcError_('BAD_REQUEST', '数値を入力してください');
  if (['economyEnabled', 'learningEnabled', 'onlineEnabled', 'rankingEnabled'].indexOf(payload.key) >= 0 && value !== '0' && value !== '1') gcError_('BAD_REQUEST', '公開設定は0か1にしてください');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Settings');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row) { return row[0] === payload.key; });
    if (index < 1) gcError_('NOT_SETUP', '設定を初期化してください');
    sheet.getRange(index + 1, 2).setValue(value);
    return { key: payload.key, value: value };
  });
}

function gcAdminSaveCard_(token, payload) {
  gcSession_(token, true);
  const price = payload.shopPrice === '' || payload.shopPrice === null ? '' : Number(payload.shopPrice);
  if (price !== '' && (!Number.isInteger(price) || price < 0 || price > 100000) || typeof payload.active !== 'boolean' || typeof payload.inPack !== 'boolean') gcError_('BAD_REQUEST', 'カードの価格と設定を確認してください');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Cards');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row) { return row[0] === payload.cardId; });
    if (index < 1) gcError_('BAD_REQUEST', 'カードが見つかりません');
    if (rows[index][3] === 'SSR' && price !== '') gcError_('BAD_REQUEST', 'SSRはパック限定です');
    sheet.getRange(index + 1, 9, 1, 3).setValues([[price, payload.inPack, payload.active]]);
    gcClearMasterCache_('Cards');
    return { cardId: payload.cardId, shopPrice: price, inPack: payload.inPack, active: payload.active };
  });
}

function gcAdminSavePack_(token, payload) {
  gcSession_(token, true);
  const rawRates = payload.rarityRates;
  const rates = rawRates && typeof rawRates === 'object' ? Object.fromEntries(Object.entries(rawRates).filter(function (entry) { return Number(entry[1]) > 0; })) : null;
  const pool = payload.cardPool;
  if (typeof payload.packId !== 'string' || !/^[a-z0-9-]{1,32}$/.test(payload.packId) || typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length > 40 ||
      !Number.isInteger(Number(payload.price)) || Number(payload.price) < 0 || Number(payload.price) > 100000 ||
      !Number.isInteger(Number(payload.cardsPerPack)) || Number(payload.cardsPerPack) < 1 || Number(payload.cardsPerPack) > 10 ||
      !Number.isInteger(Number(payload.pityCount)) || Number(payload.pityCount) < 0 || Number(payload.pityCount) > 100 ||
      typeof payload.active !== 'boolean' || !Array.isArray(pool) || !pool.length || !rates || !Object.values(rawRates).every(function (value) { return Number.isFinite(Number(value)) && Number(value) >= 0; })) gcError_('BAD_REQUEST', 'パックの設定を確認してください');
  const master = gcCardMaster_();
  const keys = Object.keys(rates);
  if (!keys.length || keys.some(function (rarity) { return ['N', 'R', 'SR', 'SSR'].indexOf(rarity) < 0 || !Number.isFinite(Number(rates[rarity])) || Number(rates[rarity]) <= 0 || !pool.some(function (id) { return master.some(function (card) { return card.cardId === id && card.rarity === rarity && card.active && card.inPack; }); }); }) ||
      Math.abs(keys.reduce(function (sum, key) { return sum + Number(rates[key]); }, 0) - 100) > .001 ||
      pool.some(function (id) { return !master.some(function (card) { return card.cardId === id && card.active && card.inPack; }); }) ||
      Number(payload.pityCount) > 0 && !keys.some(function (key) { return key === 'SR' || key === 'SSR'; })) gcError_('BAD_PACK', '排出率と収録カードのレア度を確認してください');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Packs');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row) { return row[0] === payload.packId; });
    const existing = index >= 1 ? rows[index] : [];
    const values = [payload.packId, payload.name.trim(), Number(payload.price), Number(payload.cardsPerPack), JSON.stringify(rates), JSON.stringify(pool), Number(payload.pityCount), existing[7] || '', existing[8] || '', payload.active];
    if (index >= 1) sheet.getRange(index + 1, 1, 1, GC_HEADERS.Packs.length).setValues([values]);
    else sheet.appendRow(values);
    gcClearMasterCache_('Packs');
    return { packId: payload.packId };
  });
}

function gcAdminSaveMission_(token, payload) {
  gcSession_(token, true);
  const conditions = ['submit_test', 'perfect_test', 'submit_reflection', 'win_battle', 'play_online', 'play_cpu', 'train', 'open_pack', 'login'];
  if (typeof payload.missionId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(payload.missionId) || ['daily', 'weekly'].indexOf(payload.period) < 0 ||
      conditions.indexOf(payload.condition) < 0 || !Number.isInteger(Number(payload.targetCount)) || Number(payload.targetCount) < 1 || Number(payload.targetCount) > 1000 ||
      !Number.isInteger(Number(payload.reward)) || Number(payload.reward) < 0 || Number(payload.reward) > 100000 ||
      typeof payload.label !== 'string' || !payload.label.trim() || payload.label.length > 80 || typeof payload.active !== 'boolean') gcError_('BAD_REQUEST', 'ミッションの設定を確認してください');
  return gcWithLock_(function () {
    const sheet = gcSheet_('Missions');
    const rows = sheet.getDataRange().getValues();
    const index = rows.findIndex(function (row) { return row[0] === payload.missionId; });
    const values = [payload.missionId, payload.period, payload.condition, Number(payload.targetCount), Number(payload.reward), payload.label.trim(), payload.active, index >= 1 ? rows[index][7] : sheet.getLastRow()];
    if (index >= 1) sheet.getRange(index + 1, 1, 1, GC_HEADERS.Missions.length).setValues([values]);
    else sheet.appendRow(values);
    gcClearMasterCache_('Missions');
    return { missionId: payload.missionId };
  });
}

function gcAdminRows_(name) {
  const sheet = gcSheet_(name);
  const count = sheet.getLastRow() - 1;
  return count > 0 ? sheet.getRange(2, 1, count, GC_HEADERS[name].length).getValues().filter(function (row) { return row[0]; }) : [];
}

function gcAdminDay_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? Utilities.formatDate(date, GC_TZ, 'yyyy-MM-dd') : String(value).slice(0, 10);
}

function gcAdminDashboard_(token) {
  gcSession_(token, true);
  const today = gcToday_();
  const users = gcAdminRows_('Users');
  const tests = gcAdminRows_('TestResponses');
  const reflections = gcAdminRows_('ReflectionResponses');
  const logs = gcAdminRows_('PointLog');
  const todayLogs = logs.filter(function (row) { return gcAdminDay_(row[6]) === today; });
  return {
    date: today,
    students: users.filter(function (row) { return row[1] !== 'admin'; }).length,
    logins: users.filter(function (row) { return gcDateKey_(row[10]) === today; }).length,
    testAttempts: tests.filter(function (row) { return gcAdminDay_(row[11]) === today; }).length,
    reflectionSubmissions: reflections.filter(function (row) { return gcAdminDay_(row[5]) === today; }).length,
    pointsIssued: todayLogs.reduce(function (sum, row) { return sum + Math.max(0, Number(row[2] || 0)); }, 0),
    pointsSpent: todayLogs.reduce(function (sum, row) { return sum + Math.max(0, -Number(row[2] || 0)); }, 0),
  };
}

function gcAdminStudent_(row, identity, ownedCounts) {
  const email = String(row[0]).trim().toLowerCase();
  return {
    email: email, role: String(row[1]), className: String(row[2] || ''), number: String(row[3] || ''),
    name: String(row[4] || ''), nickname: String(row[5] || ''), gPoint: Number(row[6] || 0),
    maxLife: gcNumber_(identity.settings, 'initialLife', 100, 1, 9999) + Number(row[7] || 0) * gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100),
    ownedCount: ownedCounts[email] || 0,
  };
}

function gcAdminListStudents_(token) {
  const identity = gcSession_(token, true);
  const counts = {};
  gcAdminRows_('OwnedCards').forEach(function (row) {
    if (!row[6]) { const email = String(row[1]).toLowerCase(); counts[email] = (counts[email] || 0) + 1; }
  });
  return gcAdminRows_('Users').map(function (row) { return gcAdminStudent_(row, identity, counts); });
}

function gcAdminStudentDetail_(token, payload) {
  const identity = gcSession_(token, true);
  const email = String(payload.email || '').trim().toLowerCase();
  const record = gcFindUser_(email);
  if (!record) gcError_('NOT_FOUND', '利用者が見つかりません');
  const cards = gcCardMaster_();
  const owned = gcAdminRows_('OwnedCards').filter(function (row) { return String(row[1]).toLowerCase() === email && !row[6]; }).map(function (row) {
    const card = cards.find(function (item) { return item.cardId === row[2]; });
    return { ownedId: String(row[0]), cardId: String(row[2]), name: card ? card.name : String(row[2]), trainLevel: Number(row[3] || 0), source: String(row[4] || '') };
  });
  const adjustments = gcAdminRows_('AdminAdjustments');
  const history = gcAdminRows_('PointLog').filter(function (row) { return String(row[1]).toLowerCase() === email; }).slice(-20).reverse().map(function (row) {
    const adjustment = row[3] === 'admin_adjust' ? adjustments.find(function (item) { return item[0] === row[4]; }) : null;
    return { delta: Number(row[2] || 0), reason: String(row[3]), note: adjustment ? String(adjustment[4]) : '', balanceAfter: Number(row[5] || 0), at: row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '') };
  });
  return { student: gcAdminStudent_(record.values, identity, { [email]: owned.length }), ownedCards: owned, pointHistory: history };
}

function gcAdminAdjustPoints_(token, payload, requestId) {
  const identity = gcSession_(token, true);
  const id = gcRequestId_(requestId);
  const email = String(payload.email || '').trim().toLowerCase();
  const delta = Number(payload.delta);
  const reason = String(payload.reason || '').trim();
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000 || reason.length < 5 || reason.length > 200) gcError_('BAD_REQUEST', '増減額と5文字以上の理由を入力してください');
  return gcWithLock_(function () {
    const record = gcFindUser_(email);
    if (!record) gcError_('NOT_FOUND', '利用者が見つかりません');
    const user = gcUserObject_(record);
    const audit = gcSheet_('AdminAdjustments');
    const priorAudit = gcAdminRows_('AdminAdjustments').find(function (row) { return row[0] === id; });
    if (priorAudit) {
      if (String(priorAudit[2]).toLowerCase() !== email || Number(priorAudit[3]) !== delta || String(priorAudit[4]) !== reason) gcError_('BAD_REQUEST', '送信IDの内容が一致しません');
      return { email: email, delta: delta, gPoint: Number(user.gPoint || 0), reason: reason, alreadyApplied: true };
    }
    const priorLog = gcAdminRows_('PointLog').find(function (row) { return row[3] === 'admin_adjust' && row[4] === id; });
    if (priorLog) {
      if (String(priorLog[1]).toLowerCase() !== email || Number(priorLog[2]) !== delta) gcError_('BAD_REQUEST', '送信IDの内容が一致しません');
      const balanceAfter = Number(priorLog[5]);
      if (Number(user.gPoint || 0) === balanceAfter - delta) {
        user.gPoint = balanceAfter;
        if (delta > 0) user.totalEarned = Number(user.totalEarned || 0) + delta;
        user.updatedAt = new Date().toISOString();
        gcWriteUser_(record, user);
      }
      audit.appendRow([id, identity.email, email, delta, reason, balanceAfter, priorLog[6]]);
      return { email: email, delta: delta, gPoint: Number(user.gPoint || 0), reason: reason, alreadyApplied: true };
    }
    const balanceAfter = Number(user.gPoint || 0) + delta;
    if (balanceAfter < 0) gcError_('NOT_ENOUGH_POINTS', '残高を0G未満にはできません');
    const at = new Date().toISOString();
    gcPointLog_(email, delta, 'admin_adjust', id, balanceAfter);
    user.gPoint = balanceAfter;
    if (delta > 0) user.totalEarned = Number(user.totalEarned || 0) + delta;
    user.updatedAt = at;
    gcWriteUser_(record, user);
    audit.appendRow([id, identity.email, email, delta, reason, balanceAfter, at]);
    return { email: email, delta: delta, gPoint: balanceAfter, reason: reason, alreadyApplied: false };
  });
}

function gcAdminResetNickname_(token, payload, requestId) {
  const identity = gcSession_(token, true);
  const id = gcRequestId_(requestId);
  const email = String(payload.email || '').trim().toLowerCase();
  return gcWithLock_(function () {
    const record = gcFindUser_(email);
    if (!record) gcError_('NOT_FOUND', '利用者が見つかりません');
    const user = gcUserObject_(record);
    const audit = gcSheet_('AdminActions');
    const previous = gcAdminRows_('AdminActions').find(function (row) { return row[0] === id; });
    if (previous) return { email: email, nickname: String(user.nickname || ''), alreadyApplied: true };
    const before = String(user.nickname || '');
    if (!before) return { email: email, nickname: '', alreadyApplied: false };
    audit.appendRow([id, identity.email, email, 'reset_nickname', before, '', new Date().toISOString()]);
    user.nickname = ''; user.updatedAt = new Date().toISOString(); gcWriteUser_(record, user);
    return { email: email, nickname: '', alreadyApplied: false };
  });
}

function gcAdminExportData_(token, payload) {
  gcSession_(token, true);
  const table = String(payload.table || '');
  if (!Object.prototype.hasOwnProperty.call(GC_HEADERS, table)) gcError_('BAD_REQUEST', '書き出すデータを選んでください');
  const cursor = Number(payload.cursor || 0);
  if (!Number.isInteger(cursor) || cursor < 0) gcError_('BAD_REQUEST', '書き出し位置を確認してください');
  const sheet = gcSheet_(table);
  const total = Math.max(0, sheet.getLastRow() - 1);
  const count = Math.min(300, Math.max(0, total - cursor));
  const rows = count ? sheet.getRange(cursor + 2, 1, count, GC_HEADERS[table].length).getValues().map(function (row) {
    return row.map(function (value) { return value instanceof Date ? value.toISOString() : value; });
  }) : [];
  return { table: table, headers: GC_HEADERS[table], rows: rows, total: total, nextCursor: cursor + count < total ? cursor + count : null };
}

function gcOnlineAccess_(identity) {
  if (!identity.admin && identity.settings.onlineEnabled !== '1') gcError_('NOT_READY', 'オンライン対戦は準備中です');
}

function gcOnlineMatch_(battleId) {
  const sheet = gcSheet_('OnlineMatches');
  if (sheet.getLastRow() < 2) return null;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const index = ids.findIndex(function (row) { return row[0] === battleId; });
  return index < 0 ? null : { sheet: sheet, rowNumber: index + 2, values: sheet.getRange(index + 2, 1, 1, GC_HEADERS.OnlineMatches.length).getValues()[0] };
}

function gcOnlineJoin_(token, payload) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity); gcOnlineAccess_(identity);
  const battleId = gcRequestId_(payload.battleId);
  const uid = String(payload.uid || '');
  const mode = String(payload.deckMode || '');
  if (!/^[a-zA-Z0-9]{10,128}$/.test(uid) || ['sample', 'owned'].indexOf(mode) < 0) gcError_('BAD_REQUEST', '対戦への参加情報を確認してください');
  return gcWithLock_(function () {
    const found = gcOnlineMatch_(battleId);
    if (!found) {
      gcSheet_('OnlineMatches').appendRow([battleId, mode, identity.email, uid, '', '', '', '', '', '', new Date().toISOString(), 'waiting', '']);
      return { status: 'waiting' };
    }
    const row = found.values;
    if (row[1] !== mode || row[11] === 'invalid' || row[11] === 'complete') gcError_('BAD_REQUEST', 'この対戦には参加できません');
    if (row[2] === identity.email) {
      if (row[3] !== uid) gcError_('BAD_REQUEST', '参加端末が一致しません');
      return { status: String(row[11]) };
    }
    if (row[4] && row[4] !== identity.email || row[5] && row[5] !== uid || row[3] === uid) gcError_('BAD_REQUEST', 'この対戦には参加できません');
    row[4] = identity.email; row[5] = uid; row[11] = 'active';
    found.sheet.getRange(found.rowNumber, 1, 1, GC_HEADERS.OnlineMatches.length).setValues([row]);
    return { status: 'active' };
  });
}

function gcOnlineAwardOne_(row, side) {
  const email = String(row[side === 0 ? 2 : 4]);
  const opponent = String(row[side === 0 ? 4 : 2]);
  const result = String(row[side === 0 ? 6 : 8]);
  const battleId = String(row[0]);
  const log = gcSheet_('BattleLog');
  const existing = log.getDataRange().getValues().slice(1).find(function (item) { return item[0] === battleId && String(item[1]).toLowerCase() === email; });
  if (existing) return;
  const record = gcFindUser_(email);
  const user = gcUserObject_(record);
  const identity = { email: email, settings: gcSettings_() };
  const counter = gcCounter_(email, gcToday_());
  const cap = gcNumber_(identity.settings, 'onlineRewardDailyCap', 3, 0, 100);
  let award = 0;
  if (Number(counter.values[3] || 0) < cap) {
    award += gcNumber_(identity.settings, result === 'win' ? 'onlineRewardWin' : result === 'draw' ? 'onlineRewardDraw' : 'onlineRewardLoss', result === 'win' ? 10 : result === 'draw' ? 5 : 3, 0, 10000);
    counter.values[3] = Number(counter.values[3] || 0) + 1;
  }
  if (result === 'win' && counter.values[4] !== true) {
    award += gcNumber_(identity.settings, 'firstWinBonus', 20, 0, 10000);
    counter.values[4] = true;
  }
  user.gPoint = Number(user.gPoint || 0) + award;
  user.totalEarned = Number(user.totalEarned || 0) + award;
  user.updatedAt = new Date().toISOString();
  gcWriteUser_(record, user);
  counter.sheet.getRange(counter.rowNumber, 1, 1, GC_HEADERS.DailyCounters.length).setValues([counter.values]);
  if (award) gcPointLog_(email, award, 'battle', battleId, user.gPoint);
  gcAwardMissions_(identity, user, { play_online: 1, win_battle: result === 'win' ? 1 : 0 });
  gcWriteUser_(record, user);
  const opponentRecord = gcFindUser_(opponent);
  const opponentName = opponentRecord ? String(opponentRecord.values[5] || '') : '';
  log.appendRow([battleId, email, 'online', row[1], '', result, opponentName, award, new Date().toISOString()]);
}

function gcOnlineValidateDeck_(identity, mode, deck) {
  if (!Array.isArray(deck) || deck.length !== 4) gcError_('BAD_DECK', 'オンライン対戦のカードを確認できません');
  const master = gcCardMaster_();
  if (deck.filter(function (entry) { return master.some(function (card) { return card.cardId === entry.cardId && card.rarity === 'SSR'; }); }).length > 1) gcError_('BAD_DECK', 'SSRはデッキに1枚までです');
  if (mode === 'sample') {
    const sample = gcBattleConfigRows_().find(function (item) { return item.deckId === 'sample'; });
    const ids = deck.map(function (entry) { return String(entry.cardId || ''); });
    if (!sample || new Set(ids).size !== 4 || !ids.every(function (id) { return sample.cardIds.indexOf(id) >= 0; }) ||
        !deck.every(function (entry) { return Number(entry.trainLevel) === 0 && !entry.ownedId; })) gcError_('BAD_DECK', 'サンプルカードを確認できません');
    return;
  }
  const owned = gcOwned_(identity.email);
  const ids = deck.map(function (entry) { return String(entry.ownedId || ''); });
  if (new Set(ids).size !== 4 || !deck.every(function (entry) {
    return owned.some(function (card) { return card.ownedId === entry.ownedId && card.cardId === entry.cardId && Number(card.trainLevel) === Number(entry.trainLevel); });
  })) gcError_('BAD_DECK', '所持カードと筋トレ値を確認できません');
}

function gcOnlineReport_(token, payload) {
  const identity = gcSession_(token, false);
  const battleId = gcRequestId_(payload.battleId);
  const result = String(payload.result || '');
  const hash = String(payload.stateHash || '');
  if (['win', 'draw', 'loss'].indexOf(result) < 0 || !/^[a-f0-9]{64}$/.test(hash)) gcError_('BAD_REQUEST', '対戦結果を確認できません');
  return gcWithLock_(function () {
    const found = gcOnlineMatch_(battleId);
    if (!found) gcError_('NOT_FOUND', '対戦が見つかりません');
    const row = found.values;
    const side = row[2] === identity.email ? 0 : row[4] === identity.email ? 1 : -1;
    if (side < 0) gcError_('FORBIDDEN', 'この対戦には参加していません');
    if (row[11] === 'complete' || row[11] === 'invalid') return gcOnlineResult_(token, { battleId: battleId });
    if (row[11] !== 'active') gcError_('BAD_REQUEST', '相手の参加を待ってください');
    if (payload.suspicious === true) {
      row[11] = 'invalid'; row[12] = new Date().toISOString();
      found.sheet.getRange(found.rowNumber, 1, 1, GC_HEADERS.OnlineMatches.length).setValues([row]);
      return gcOnlineResult_(token, { battleId: battleId });
    }
    gcOnlineValidateDeck_(identity, String(row[1]), payload.deck);
    const resultIndex = side === 0 ? 6 : 8;
    const hashIndex = side === 0 ? 7 : 9;
    if (row[resultIndex] && (row[resultIndex] !== result || row[hashIndex] !== hash)) gcError_('BAD_REQUEST', '送信済みの結果と一致しません');
    row[resultIndex] = result; row[hashIndex] = hash;
    if (row[6] && row[8]) {
      const compatible = row[6] === 'draw' && row[8] === 'draw' || row[6] === 'win' && row[8] === 'loss' || row[6] === 'loss' && row[8] === 'win';
      if (!compatible || row[7] !== row[9]) row[11] = 'invalid';
      else {
        gcOnlineAwardOne_(row, 0);
        gcOnlineAwardOne_(row, 1);
        row[11] = 'complete';
      }
      row[12] = new Date().toISOString();
    }
    found.sheet.getRange(found.rowNumber, 1, 1, GC_HEADERS.OnlineMatches.length).setValues([row]);
    return gcOnlineResult_(token, { battleId: battleId });
  });
}

function gcOnlineResult_(token, payload) {
  const identity = gcSession_(token, false);
  const battleId = gcRequestId_(payload.battleId);
  const found = gcOnlineMatch_(battleId);
  if (!found) gcError_('NOT_FOUND', '対戦が見つかりません');
  const row = found.values;
  const side = row[2] === identity.email ? 0 : row[4] === identity.email ? 1 : -1;
  if (side < 0) gcError_('FORBIDDEN', 'この対戦には参加していません');
  const ownResult = row[side === 0 ? 6 : 8];
  const log = gcSheet_('BattleLog').getDataRange().getValues().slice(1).find(function (item) { return item[0] === battleId && String(item[1]).toLowerCase() === identity.email; });
  return { status: String(row[11]), result: ownResult || '', awarded: log ? Number(log[7] || 0) : 0, gPoint: Number(gcFindUser_(identity.email).values[6] || 0), onlineRewards: Number(gcCounter_(identity.email, gcToday_(), false).values[3] || 0) };
}

function gcGetRanking_(token) {
  const identity = gcSession_(token, false);
  if (identity.settings.rankingEnabled === '0') return { enabled: false, weekStart: gcMissionPeriod_('weekly', gcToday_()), sample: [], owned: [], self: { sample: null, owned: null } };
  const weekStart = gcMissionPeriod_('weekly', gcToday_());
  const counts = { sample: {}, owned: {} };
  gcAdminRows_('BattleLog').forEach(function (row) {
    if (row[2] !== 'online' || row[5] !== 'win' || gcAdminDay_(row[8]) < weekStart || !counts[row[3]]) return;
    const email = String(row[1]).toLowerCase();
    counts[row[3]][email] = (counts[row[3]][email] || 0) + 1;
  });
  const nicknames = {};
  gcAdminRows_('Users').forEach(function (row) { nicknames[String(row[0]).toLowerCase()] = String(row[5] || 'プレイヤー'); });
  const ranking = function (mode) {
    return Object.keys(counts[mode]).map(function (email) { return { email: email, nickname: nicknames[email] || 'プレイヤー', wins: counts[mode][email] }; })
      .sort(function (a, b) { return b.wins - a.wins || a.nickname.localeCompare(b.nickname) || a.email.localeCompare(b.email); })
      .map(function (entry, index) { return { rank: index + 1, email: entry.email, nickname: entry.nickname, wins: entry.wins }; });
  };
  const sample = ranking('sample');
  const owned = ranking('owned');
  const publicRows = function (rows) { return rows.slice(0, 20).map(function (item) { return { rank: item.rank, nickname: item.nickname, wins: item.wins, isSelf: item.email === identity.email }; }); };
  const own = function (rows) { const row = rows.find(function (item) { return item.email === identity.email; }); return row ? { rank: row.rank, nickname: row.nickname, wins: row.wins } : null; };
  return { enabled: true, weekStart: weekStart, sample: publicRows(sample), owned: publicRows(owned), self: { sample: own(sample), owned: own(owned) } };
}
