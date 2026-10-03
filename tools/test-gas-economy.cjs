const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.coerceDates = false; }
  cell(value) { return this.coerceDates && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : value; }
  getLastRow() { return this.rows.length; }
  setFrozenRows() {}
  appendRow(row) { this.rows.push(row.map((value) => this.cell(value))); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.rows.length), Math.max(1, ...this.rows.map((row) => row.length))); }
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => this.rows[row + y - 1]?.[column + x - 1] ?? '')),
      setValues: (values) => { for (let y = 0; y < height; y++) { const line = this.rows[row + y - 1] ?? []; for (let x = 0; x < width; x++) line[column + x - 1] = this.cell(values[y][x]); this.rows[row + y - 1] = line; } },
      setValue: (value) => { const line = this.rows[row - 1] ?? []; line[column - 1] = this.cell(value); this.rows[row - 1] = line; },
      clearContent: () => { for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (this.rows[row + y - 1]) this.rows[row + y - 1][column + x - 1] = ''; },
    };
  }
}

const sheets = new Map();
const book = {
  getId: () => 'test-book',
  getSheetByName: (name) => sheets.get(name) ?? null,
  insertSheet: (name) => { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; },
};
const properties = new Map();
const cache = new Map();
let lockCalls = 0;
const base64 = (value) => Buffer.from(value).toString('base64url');
const Utilities = {
  Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' },
  getUuid: () => crypto.randomUUID(),
  base64EncodeWebSafe: base64,
  base64DecodeWebSafe: (value) => Buffer.from(value, 'base64url'),
  computeDigest: (_algorithm, value) => crypto.createHash('sha256').update(value).digest(),
  computeHmacSha256Signature: (body, secret) => crypto.createHmac('sha256', secret).update(body).digest(),
  newBlob: (value) => ({ getDataAsString: () => Buffer.from(value).toString('utf8') }),
  formatDate: (date) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10),
};
const context = vm.createContext({
  Date, Math, JSON, Number, String, Array, Object, Set, Utilities,
  SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book, flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => { lockCalls++; return true; }, releaseLock: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: (key) => cache.get(key), put: (key, value) => cache.set(key, value), remove: (key) => cache.delete(key) }) },
});
vm.runInContext(fs.readFileSync('gas/Code.gs', 'utf8'), context);
const call = (name, ...args) => vm.runInContext(name, context)(...args);
call('setup');
const domain = 'school.example.jp';
const email = `teacher@${domain}`;
const settings = sheets.get('Settings');
settings.getRange(2, 2).setValue(domain);
settings.getRange(3, 2).setValue(email);
const today = Utilities.formatDate(new Date());
sheets.get('Users').appendRow([email, 'admin', '', '', '', '先生', 500, 0, 500, 1, today, 0, '', true, new Date().toISOString(), new Date().toISOString()]);
for (const cardId of ['G001', 'G002', 'C008', 'P001']) sheets.get('OwnedCards').appendRow([crypto.randomUUID(), email, cardId, 0, 'initial', new Date().toISOString(), '']);
const token = call('gcSignSession_', email, 'admin', call('gcSettings_'));
const id = () => crypto.randomUUID();
assert.throws(() => call('gcSellCard_', token, { ownedId: call('gcOwned_', email)[0].ownedId }, id()), /4枚以上/);

const buyId = id();
const firstBuy = call('gcBuyCard_', token, { cardId: 'P003' }, buyId);
const repeatedBuy = call('gcBuyCard_', token, { cardId: 'P003' }, buyId);
assert.equal(firstBuy.gPoint, 450);
assert.equal(repeatedBuy.gPoint, firstBuy.gPoint);
assert.equal(call('gcOwned_', email).length, 5);
assert.equal(sheets.get('PointLog').rows.filter((row) => row[4] === buyId).length, 1);

const firstCard = call('gcOwned_', email).find((card) => card.cardId === 'G001');
const trainId = id();
const trained = call('gcTrain_', token, { items: [{ kind: 'muscle', ownedId: firstCard.ownedId, count: 2 }] }, trainId);
const repeatedTrain = call('gcTrain_', token, { items: [{ kind: 'muscle', ownedId: firstCard.ownedId, count: 2 }] }, trainId);
assert.equal(trained.trained, 2);
assert.equal(trained.gPoint, 450 - 20 - 22 + 10); // デイリートレーニング達成
assert.equal(repeatedTrain.gPoint, trained.gPoint);
assert.equal(call('gcOwned_', email).find((card) => card.ownedId === firstCard.ownedId).trainLevel, 2);

const battleId = id();
const battle = call('gcReportBattle_', token, { battleId, mode: 'cpu', deckMode: 'owned', cpuLevel: 1, result: 'win' });
const repeatedBattle = call('gcReportBattle_', token, { battleId, mode: 'cpu', deckMode: 'owned', cpuLevel: 1, result: 'win' });
assert.equal(battle.awarded, 25); // 勝利5G＋本日の初勝利20G
assert.equal(repeatedBattle.gPoint, battle.gPoint);
assert.equal(sheets.get('BattleLog').rows.filter((row) => row[0] === battleId).length, 1);
for (let round = 0; round < 4; round++) call('gcReportBattle_', token, { battleId: id(), mode: 'cpu', deckMode: 'sample', cpuLevel: 1, result: 'win' });
assert.equal(call('gcCounter_', email, today).values[2], 3);

const packId = id();
const pack = call('gcOpenPack_', token, { packId: 'starter' }, packId);
const repeatedPack = call('gcOpenPack_', token, { packId: 'starter' }, packId);
assert.equal(pack.acquired.length, 3);
assert.equal(repeatedPack.acquired.length, 3);
assert.equal(call('gcCounter_', email, today).values[5], 1);
assert.equal(call('gcOwned_', email).length, 8);
const soldId = id();
const sold = call('gcSellCard_', token, { ownedId: firstBuy.acquired[0].ownedId }, soldId);
assert.equal(call('gcSellCard_', token, { ownedId: firstBuy.acquired[0].ownedId }, soldId).gPoint, sold.gPoint);
assert.equal(call('gcOwned_', email).length, 7);
const packLimitSetting = settings.rows.findIndex((row) => row[0] === 'packDailyLimit') + 1;
settings.getRange(packLimitSetting, 2).setValue('1');
assert.throws(() => call('gcOpenPack_', token, { packId: 'starter' }, id()), /上限/);
const student = `student@${domain}`;
sheets.get('Users').appendRow([student, 'student', '', '', '', '生徒', 0, 0, 0, 0, today, 0, '', true, '', '']);
const studentToken = call('gcSignSession_', student, 'student', call('gcSettings_'));
assert.throws(() => call('gcAdminSaveSettings_', studentToken, { key: 'muscleCostBase', value: '1' }), /管理者のみ/);
assert.throws(() => call('gcBuyCard_', studentToken, { cardId: 'P003' }, id()), /準備中/);
const returning = `returning@${domain}`;
sheets.get('Users').appendRow([returning, 'student', '', '', '', '利用者', 100, 0, 100, 0, '', 0, '', true, '', '']);
// Google Sheets は yyyy-MM-dd の書き込みを日付セルに自動変換することがある。
sheets.get('Users').coerceDates = true;
sheets.get('PointLog').coerceDates = true;
sheets.get('DailyCounters').coerceDates = true;
sheets.get('MissionProgress').coerceDates = true;
const returningToken = call('gcSignSession_', returning, 'student', call('gcSettings_'));
const beforeBootstrapLocks = lockCalls;
call('gcBootstrap_', returningToken);
call('gcBootstrap_', returningToken);
assert.equal(lockCalls - beforeBootstrapLocks, 1, '同日2回目のホーム表示は全体ロックを取らない');
assert.equal(sheets.get('PointLog').rows.filter((row) => row[1] === returning && row[3] === 'login_bonus' && (row[4] instanceof Date ? row[4].toISOString().slice(0, 10) : row[4]) === today).length, 1, '同じ日のログインボーナスは一度だけ');
assert.equal(call('gcFindUser_', returning).values[6], 110, '二度目のホーム表示で残高が増えない');
assert.equal(sheets.get('DailyCounters').rows.filter((row) => row[0] === returning).length, 0, 'ホーム表示だけでは日次カウンターを書かない');
call('gcAdminSaveSettings_', token, { key: 'economyEnabled', value: '1' });
sheets.get('OwnedCards').appendRow([id(), returning, 'G001', 0, 'initial', '', '']);
const returningCard = call('gcOwned_', returning)[0];
call('gcTrain_', returningToken, { items: [{ kind: 'muscle', ownedId: returningCard.ownedId, count: 1 }] }, id());
call('gcTrain_', returningToken, { items: [{ kind: 'muscle', ownedId: returningCard.ownedId, count: 1 }] }, id());
assert.equal(sheets.get('PointLog').rows.filter((row) => row[1] === returning && row[3] === 'mission' && String(row[4]).startsWith('daily-train:')).length, 1, '日次ミッションは一度だけ付与する');
assert.equal(sheets.get('DailyCounters').rows.filter((row) => row[0] === returning).length, 1, '日次カウンターは同じ行を使う');
assert.equal(call('gcBootstrap_', studentToken).economy.enabled, true);
call('gcAdminSaveCard_', token, { cardId: 'P003', shopPrice: 75, inPack: true, active: true });
assert.equal(call('gcCardMaster_').find((card) => card.cardId === 'P003').shopPrice, 75, 'カード変更後はマスターのキャッシュを更新する');
console.log('GAS economy: purchase, training, battle cap, pack, duplicate requests OK');
