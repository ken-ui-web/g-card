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
  deleteRow(row) { this.rows.splice(row - 1, 1); }
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
vm.runInContext(fs.readFileSync('gas/Learning.gs', 'utf8'), context);
const call = (name, ...args) => vm.runInContext(name, context)(...args);
call('setup');
assert.equal(sheets.get('Cards').getLastRow(), 41);
assert.equal(call('gcCardMaster_').filter((card) => !card.text || !card.image || !card.effects.length).length, 0, '40枚すべてに画像と効果を設定する');
assert.equal(call('gcCardMaster_').find((card) => card.cardId === 'C014').rarity, 'SSR');
assert.equal(call('gcPackMaster_').find((pack) => pack.packId === 'first-wave').rarityRates.SSR, 1.5);
assert.equal(call('gcPackMaster_').find((pack) => pack.packId === 'all-cards').cardPool.length, 40);
// Upgrade a school sheet created by the previous version without deleting purchases or custom settings.
sheets.get('Cards').rows = sheets.get('Cards').rows.slice(0, 6).map((row) => row.slice(0, 13));
sheets.get('OwnedCards').rows[0] = sheets.get('OwnedCards').rows[0].slice(0, 7);
sheets.get('Packs').rows = sheets.get('Packs').rows.filter((row) => row[0] !== 'first-wave');
call('setup');
assert.equal(sheets.get('Cards').getLastRow(), 41);
assert.equal(sheets.get('Cards').rows[0][13], 'trainingBonus');
assert.equal(sheets.get('OwnedCards').rows[0][7], 'trainingSpent', '既存の学校シートに筋トレ累計列を追加する');
assert.equal(call('gcPackMaster_').filter((pack) => pack.packId === 'first-wave').length, 1);
call('setup');
assert.equal(sheets.get('Cards').getLastRow(), 41);
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
const sample = call('gcBattleConfigRows_').find((deck) => deck.deckId === 'sample');
const inactiveCard = 'P014';
const inactiveRow = sheets.get('Cards').rows.findIndex((row) => row[0] === inactiveCard);
sheets.get('Cards').getRange(inactiveRow + 1, 11).setValue(false);
call('gcClearMasterCache_', 'Cards');
assert.equal(call('gcCardMaster_').find((card) => card.cardId === inactiveCard).active, false);
assert.doesNotThrow(() => call('gcAdminSaveDeck_', token, { ...sample, cardIds: ['G001', 'G002', 'C008', inactiveCard] }), '販売停止中のカードもサンプル候補に保存できる');
assert.equal(call('gcDispatch_', { action: 'getBattleConfig', session: token }).find((deck) => deck.deckId === 'sample').cardIds.length, 4, '対戦専用APIは管理者が保存した最新の4枚を返す');
call('gcAdminSaveDeck_', token, sample);
sheets.get('Cards').getRange(inactiveRow + 1, 11).setValue(true);
call('gcClearMasterCache_', 'Cards');
assert.throws(() => call('gcBuyCard_', token, { cardId: 'C014' }, id()), /購入できません/);
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
assert.equal(call('gcOwned_', email).find((card) => card.ownedId === firstCard.ownedId).trainingSpent, 42, '筋トレに実際に使ったGをカードに記録する');

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
const testId = id();
call('gcAdminSaveSettings_', token, { key: 'learningEnabled', value: '1' });
const sectionId = id();
const singleId = id();
const shortId = id();
const testDefinition = { testId, title: '確認テスト', description: '', sections: [{ sectionId, title: '問題', description: '' }], settings: { startAt: '', endAt: '', targetClasses: [], attemptLimit: 0, resultRelease: 'immediate', resultDetail: 'full', pointMultiplier: 1, shuffleQuestions: false, resultsPublished: false }, published: true };
const questions = [
  { questionId: singleId, sectionId, type: 'single', text: '正しいもの', options: { choices: ['A', 'B'] }, answer: 'A', points: 5, required: true, shuffleOptions: false, feedbackCorrect: '正解', feedbackWrong: 'もう一度' },
  { questionId: shortId, sectionId, type: 'short', text: '名前', options: {}, answer: ['ABC'], points: 5, required: true, shuffleOptions: false, feedbackCorrect: '', feedbackWrong: '' },
];
call('gcAdminSaveTest_', token, { test: testDefinition, questions });
const studentPaper = call('gcGetTest_', studentToken, { testId });
assert.equal(JSON.stringify(studentPaper).includes('answer'), false, '受験データに正解を含めない');
assert.equal(JSON.stringify(studentPaper).includes('feedback'), false, '受験データに解説を含めない');
const firstTestId = id();
const firstTest = call('gcSubmitTest_', studentToken, { testId, answers: { [singleId]: 'A', [shortId]: 'wrong' } }, firstTestId);
assert.equal(firstTest.score, 5);
assert.equal(firstTest.gAwarded, 50);
assert.equal(sheets.get('TestResponses').rows[1][4], '', '回答本文はシートへ保存しない');
assert.equal(call('gcSubmitTest_', studentToken, { testId, answers: { [singleId]: 'A', [shortId]: 'wrong' } }, firstTestId).gAwarded, 50, '同じ送信IDは前回結果を返す');
assert.equal(sheets.get('TestResponses').rows.length, 2, '同じ送信IDで行を増やさない');
const secondTest = call('gcSubmitTest_', studentToken, { testId, answers: { [singleId]: 'A', [shortId]: 'ａｂｃ' } }, id());
assert.equal(secondTest.score, 10);
assert.equal(secondTest.gAwarded, 100, '自己ベスト差額50Gと初回満点50G');
const thirdTest = call('gcSubmitTest_', studentToken, { testId, answers: { [singleId]: 'B', [shortId]: 'wrong' } }, id());
assert.equal(thirdTest.gAwarded, 0, '自己ベストを超えない再受験は付与しない');
assert.equal(sheets.get('PointLog').rows.filter((row) => row[1] === student && row[3] === 'test_perfect').length, 1, '満点ボーナスは1度だけ');
assert.throws(() => call('gcAdminSaveTest_', studentToken, { test: testDefinition, questions }), /管理者のみ/);
const externalRoster = book.insertSheet('名簿');
const externalTopics = book.insertSheet('題材');
const externalLessons = book.insertSheet('授業');
const externalReflections = book.insertSheet('振り返り');
externalRoster.appendRow(['生徒コード', '学年', 'クラス', '番号', '名前', 'Googleアカウント', '有効']);
externalRoster.appendRow(['S001', '3', '1', '1', '生徒', student, true]);
externalTopics.appendRow(['題材ID', '学年', '題材名', '表示順', '有効']);
externalTopics.appendRow(['T001', '3', '題材', 1, true]);
externalLessons.appendRow(['授業ID', '題材ID', '授業名', '表示順', 'サムネURL', 'PDF URL', 'テストURL', '有効']);
externalLessons.appendRow(['L001', 'T001', '授業1', 1, '', '', '', true]);
externalReflections.appendRow(['キー', '生徒コード', '授業ID', '本文', '初回送信日時', '最終更新日時', '版', '評価', '評価済み版', '評価日時', '評価者']);
externalReflections.appendRow(['S001::L001', 'S001', 'L001', 'ここに本文', new Date().toISOString(), '', 1, '', '', '', '']);
properties.set('REFLECTION_REWARD_START_AT', new Date(Date.now() - 60000).toISOString());
properties.set('REFLECTION_SOURCE_ID', 'school-owned-test-sheet');
properties.set('REFLECTION_APP_URL', 'https://script.google.com/macros/s/test/exec');
const listed = call('gcListReflections_', studentToken);
assert.equal(listed.lessons[0].submitted, true);
assert.equal(JSON.stringify(listed).includes('ここに本文'), false, '既存の振り返り本文はGカードへ返さない');
const beforeReflection = call('gcFindUser_', student).values[6];
const reflection = call('gcSyncReflections_', studentToken);
assert.equal(reflection.awarded, 20);
assert.equal(call('gcSyncReflections_', studentToken).awarded, 0, '同じ授業の再確認では付与しない');
assert.equal(call('gcFindUser_', student).values[6], beforeReflection + 20);
assert.equal(sheets.get('ReflectionResponses').rows[1][3], '', '本文をGカードに複製しない');
const dashboard = call('gcAdminDashboard_', token);
assert.equal(dashboard.testAttempts, 3, '今日のテスト受験回数を集計する');
assert.equal(dashboard.reflectionSubmissions, 1, '振り返りの初回提出を集計する');
assert.ok(dashboard.pointsIssued > 0 && dashboard.pointsSpent > 0, '発行と消費を分けて集計する');
assert.ok(call('gcAdminListStudents_', token).some((user) => user.email === student));
assert.throws(() => call('gcAdminListStudents_', studentToken), /管理者のみ/);
const adjustmentId = id();
const beforeAdjustment = call('gcFindUser_', student).values[6];
const adjusted = call('gcAdminAdjustPoints_', token, { email: student, delta: 25, reason: '授業内の特別報酬' }, adjustmentId);
assert.equal(adjusted.gPoint, beforeAdjustment + 25);
assert.equal(call('gcAdminAdjustPoints_', token, { email: student, delta: 25, reason: '授業内の特別報酬' }, adjustmentId).alreadyApplied, true);
assert.equal(call('gcFindUser_', student).values[6], beforeAdjustment + 25, '同じIDの再送で二重加算しない');
assert.equal(sheets.get('PointLog').rows.filter((row) => row[4] === adjustmentId).length, 1);
assert.equal(sheets.get('AdminAdjustments').rows[1][4], '授業内の特別報酬', '調整理由を監査行に残す');
assert.throws(() => call('gcAdminAdjustPoints_', studentToken, { email: student, delta: 1, reason: '権限のない調整' }, id()), /管理者のみ/);
assert.throws(() => call('gcAdminAdjustPoints_', token, { email: student, delta: -100000, reason: '残高を超える調整' }, id()), /0G未満/);
const detail = call('gcAdminStudentDetail_', token, { email: student });
assert.ok(detail.pointHistory.some((entry) => entry.reason === 'admin_adjust' && entry.note === '授業内の特別報酬'));
const resetId = id();
call('gcAdminResetNickname_', token, { email: student }, resetId);
call('gcAdminResetNickname_', token, { email: student }, resetId);
assert.equal(call('gcFindUser_', student).values[5], '');
assert.equal(sheets.get('AdminActions').rows.length, 2, 'ニックネームのリセットを一度だけ記録する');
const exported = call('gcAdminExportData_', token, { table: 'TestResponses', cursor: 0 });
assert.equal(exported.total, 3);
assert.equal(exported.rows[0][4], '', 'CSVにもテスト回答本文を含めない');
assert.throws(() => call('gcAdminExportData_', studentToken, { table: 'Users' }), /管理者のみ/);
assert.throws(() => call('gcAdminExportData_', token, { table: 'Unknown' }), /書き出すデータ/);
call('gcAdminSaveSettings_', token, { key: 'onlineEnabled', value: '1' });
const onlineBattle = id();
const onlineDeck = ['G001', 'G002', 'C008', 'P001'].map((cardId) => ({ cardId, trainLevel: 0 }));
assert.equal(call('gcOnlineJoin_', studentToken, { battleId: onlineBattle, uid: 'studentfirebaseuid123', deckMode: 'sample' }).status, 'waiting');
assert.equal(call('gcOnlineJoin_', token, { battleId: onlineBattle, uid: 'teacherfirebaseuid123', deckMode: 'sample' }).status, 'active');
assert.throws(() => call('gcOnlineJoin_', token, { battleId: onlineBattle, uid: 'differentfirebaseuid', deckMode: 'sample' }), /参加できません/);
const onlineHash = 'a'.repeat(64);
assert.throws(() => call('gcOnlineReport_', studentToken, { battleId: onlineBattle, result: 'win', stateHash: onlineHash, deck: onlineDeck.map((card) => ({ ...card, trainLevel: 99 })) }), /サンプルカード/);
assert.equal(call('gcOnlineReport_', studentToken, { battleId: onlineBattle, result: 'win', stateHash: onlineHash, deck: onlineDeck }).status, 'active');
const onlineComplete = call('gcOnlineReport_', token, { battleId: onlineBattle, result: 'loss', stateHash: onlineHash, deck: onlineDeck });
assert.equal(onlineComplete.status, 'complete');
assert.equal(call('gcOnlineResult_', studentToken, { battleId: onlineBattle }).awarded, 30, '勝利10Gと初勝利20G');
assert.equal(call('gcOnlineResult_', token, { battleId: onlineBattle }).awarded, 3, '敗北でも3G');
call('gcOnlineReport_', studentToken, { battleId: onlineBattle, result: 'win', stateHash: onlineHash, deck: onlineDeck });
assert.equal(sheets.get('BattleLog').rows.filter((row) => row[0] === onlineBattle).length, 2, '結果再送で二重記録しない');
const ranking = call('gcGetRanking_', studentToken);
assert.equal(ranking.sample[0].wins, 1);
assert.equal(ranking.sample[0].nickname, 'プレイヤー');
assert.equal(JSON.stringify(ranking).includes(student), false, 'ランキングに学校メールを返さない');
const invalidBattle = id();
call('gcOnlineJoin_', studentToken, { battleId: invalidBattle, uid: 'studentfirebaseuid123', deckMode: 'sample' });
call('gcOnlineJoin_', token, { battleId: invalidBattle, uid: 'teacherfirebaseuid123', deckMode: 'sample' });
call('gcOnlineReport_', studentToken, { battleId: invalidBattle, result: 'win', stateHash: onlineHash, deck: onlineDeck });
assert.equal(call('gcOnlineReport_', token, { battleId: invalidBattle, result: 'loss', stateHash: 'b'.repeat(64), deck: onlineDeck }).status, 'invalid');
assert.equal(sheets.get('BattleLog').rows.filter((row) => row[0] === invalidBattle).length, 0, '状態不一致の試合に報酬を付けない');
const ssrOwned = [id(), id()];
ssrOwned.forEach((ownedId) => sheets.get('OwnedCards').appendRow([ownedId, email, 'C014', 0, 'pack', new Date().toISOString(), '']));
assert.throws(() => call('gcSaveDeck_', token, { ownedIds: [ssrOwned[0], ssrOwned[1], firstCard.ownedId, call('gcOwned_', email).find((card) => card.cardId === 'G002').ownedId] }), /SSRはデッキに1枚まで/);
assert.throws(() => call('gcOnlineValidateDeck_', call('gcSession_', token, false), 'sample', ['C014', 'C014', 'G001', 'P001'].map((cardId) => ({ cardId, trainLevel: 0 }))), /SSRはデッキに1枚まで/);
const beforeTrainedSale = call('gcState_', call('gcSession_', token, false)).gPoint;
const trainedSale = call('gcSellCard_', token, { ownedId: firstCard.ownedId }, id());
assert.equal(trainedSale.gPoint, beforeTrainedSale + 10 + 42, '筋トレ費用を売却額に加える');
assert.equal(call('gcOwned_', email).some((card) => card.ownedId === firstCard.ownedId), false);
const legacyOwnedId = id();
sheets.get('OwnedCards').appendRow([legacyOwnedId, email, 'G002', 2, 'initial', new Date().toISOString(), '']);
const beforeLegacySale = call('gcState_', call('gcSession_', token, false)).gPoint;
assert.equal(call('gcSellCard_', token, { ownedId: legacyOwnedId }, id()).gPoint, beforeLegacySale + 52, '以前から筋トレしたカードも売却額に反映する');
console.log('GAS economy and admin: rewards, duplicate requests, access, audit, export OK');
