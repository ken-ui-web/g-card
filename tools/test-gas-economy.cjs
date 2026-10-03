const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  setFrozenRows() {}
  appendRow(row) { this.rows.push([...row]); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.rows.length), Math.max(1, ...this.rows.map((row) => row.length))); }
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => this.rows[row + y - 1]?.[column + x - 1] ?? '')),
      setValues: (values) => { for (let y = 0; y < height; y++) { const line = this.rows[row + y - 1] ?? []; for (let x = 0; x < width; x++) line[column + x - 1] = values[y][x]; this.rows[row + y - 1] = line; } },
      setValue: (value) => { const line = this.rows[row - 1] ?? []; line[column - 1] = value; this.rows[row - 1] = line; },
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
  SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  CacheService: { getScriptCache: () => ({ get: (key) => cache.get(key), put: (key, value) => cache.set(key, value) }) },
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
call('gcAdminSaveSettings_', token, { key: 'economyEnabled', value: '1' });
assert.equal(call('gcBootstrap_', studentToken).economy.enabled, true);
console.log('GAS economy: purchase, training, battle cap, pack, duplicate requests OK');
