// Gカード 段階5。学校アカウント所有のスプレッドシートに紐づけて使う。
// 秘密の値と名簿は、このソースではなくスクリプトプロパティとシートに保存する。
const GC_TZ = 'Asia/Tokyo';
const GC_HEADERS = {
  Users: ['email', 'role', 'class', 'number', 'name', 'nickname', 'gPoint', 'runCount', 'totalEarned', 'loginStreak', 'lastLoginDate', 'pityCounter', 'lastDeckJson', 'welcomeGiven', 'createdAt', 'updatedAt'],
  OwnedCards: ['ownedId', 'email', 'cardId', 'trainLevel', 'source', 'acquiredAt', 'soldAt'],
  Cards: ['cardId', 'name', 'type', 'rarity', 'text', 'effects', 'trainingMultiplier', 'image', 'shopPrice', 'inPack', 'active', 'sortOrder', 'flavor'],
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
  DailyCounters: ['email', 'dateKey', 'cpuRewards', 'onlineRewards', 'firstWinGiven', 'packsBought'],
  Settings: ['key', 'value', 'description'],
};

const GC_CARDS = [
  ['G001', 'パンチ', 'rock', 'N', '20のダメージを与える', '[{"type":"damage","amount":20}]', 1, 'G001-front.webp', '', true, true, 1, ''],
  ['G002', 'キック', 'rock', 'N', '20のダメージを与える', '[{"type":"damage","amount":20}]', 1, 'G002-front.webp', '', true, true, 2, ''],
  ['C008', '火縄銃', 'scissors', 'R', '50のダメージを与える', '[{"type":"damage","amount":50}]', 0, 'C008-front.webp', '', true, true, 3, ''],
  ['P001', '手品', 'paper', 'N', '相手のカードを1枚選び、種類を【グー】に変える', '[{"type":"changeOpponentType","to":"rock"}]', 0, 'P001-front.webp', '', true, true, 4, ''],
  ['P003', '救急箱', 'paper', 'N', 'ライフを30回復', '[{"type":"heal","amount":30}]', 0, 'P003-front.webp', '', true, true, 5, ''],
];
const GC_INITIAL_CARDS = ['G001', 'G002', 'C008', 'P001'];

function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Gカード用スプレッドシートから Apps Script を開いてください');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', book.getId());
  Object.keys(GC_HEADERS).forEach(function (name) {
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    const headers = GC_HEADERS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (actual.join('|') !== headers.join('|')) throw new Error(name + ' シートの見出しが異なります');
    }
  });
  const cards = gcSheet_('Cards');
  if (cards.getLastRow() === 1) cards.getRange(2, 1, GC_CARDS.length, GC_HEADERS.Cards.length).setValues(GC_CARDS);
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
  return 'Gカードのシートを用意しました。Settings の schoolDomain と adminEmails を入力してください。';
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
  try { return callback(); } finally { lock.releaseLock(); }
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
  return rows.find(function (row) { return String(row[0]).toLowerCase() === email && row[2] === reason && String(row[3]) === refId; }) || null;
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
function gcDayNumber_(dateText) { return Date.parse(dateText + 'T00:00:00Z') / 86400000; }

function gcCardMaster_() {
  return gcSheet_('Cards').getDataRange().getValues().slice(1).filter(function (row) { return row[0]; }).map(function (row) {
    return { cardId: row[0], name: row[1], type: row[2], rarity: row[3], text: row[4], effects: JSON.parse(row[5] || '[]'), trainingMultiplier: Number(row[6] || 0), image: row[7] };
  });
}

function gcOwned_(email) {
  return gcSheet_('OwnedCards').getDataRange().getValues().slice(1).filter(function (row) { return String(row[1]).toLowerCase() === email && !row[6]; }).map(function (row) {
    return { ownedId: row[0], cardId: row[2], trainLevel: Number(row[3] || 0) };
  });
}

function gcBootstrap_(token) {
  const identity = gcSession_(token, false);
  return gcWithLock_(function () {
    const record = gcFindUser_(identity.email);
    const user = gcUserObject_(record);
    const today = gcToday_();
    const bonus = { awarded: false, amount: 0, streak: Number(user.loginStreak || 0) };
    if (user.nickname && String(user.lastLoginDate || '') !== today) {
      const previous = String(user.lastLoginDate || '');
      const consecutive = previous && gcDayNumber_(today) - gcDayNumber_(previous) === 1;
      const streak = consecutive ? Number(user.loginStreak || 0) + 1 : 1;
      const award = (Number(identity.settings.loginBonus) || 10) + (streak % 7 === 0 ? Number(identity.settings.loginStreakBonus) || 100 : 0);
      const prior = gcPointLogEntry_(identity.email, 'login_bonus', today);
      if (!prior) gcPointLog_(identity.email, award, 'login_bonus', today, Number(user.gPoint || 0) + award);
      user.gPoint = prior ? Number(prior[4]) : Number(user.gPoint || 0) + award;
      user.totalEarned = Number(user.totalEarned || 0) + award;
      user.loginStreak = streak;
      user.lastLoginDate = today;
      user.updatedAt = new Date().toISOString();
      gcWriteUser_(record, user);
      bonus.awarded = !prior;
      bonus.amount = prior ? 0 : award;
      bonus.streak = streak;
    }
    return {
      profile: { nickname: String(user.nickname || ''), role: identity.admin ? 'admin' : 'student', gPoint: Number(user.gPoint || 0), maxLife: Number(identity.settings.initialLife) || 100 },
      needsNickname: !user.nickname,
      loginBonus: bonus,
      ownedCards: gcOwned_(identity.email),
      cardMaster: gcCardMaster_(),
      lastDeck: user.lastDeckJson ? JSON.parse(user.lastDeckJson) : GC_INITIAL_CARDS,
      missions: [], unreadTests: 0, pendingReflections: 0,
    };
  });
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
