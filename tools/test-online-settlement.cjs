const assert = require('node:assert/strict');

module.exports = ({ call, context, sheets, token, studentToken, email, student, id }) => {
  const engine = context.GC_ONLINE_ENGINE;
  const evidence = context.gcOnlineEvidence_;
  let currentRoom, currentUid;
  context.gcOnlineEvidence_ = () => ({ room: currentRoom, uid: currentUid });
  const host = 'studentfirebaseuid123', guest = 'teacherfirebaseuid123';
  const fixture = (register = true) => {
    const battleId = id(), now = Date.now();
    const decks = [ ['G001', 'G002', 'C008', 'P003'], ['C008', 'G001', 'P003', 'G002'] ].map((ids, side) => ids.map((cardId) => {
      const ownedId = id();
      sheets.get('OwnedCards').appendRow([ownedId, side === 0 ? student : email, cardId, 0, 'test', new Date().toISOString(), '', 0]);
      return { cardId, ownedId, trainLevel: 0 };
    }));
    const salts = ['a'.repeat(32), 'b'.repeat(32)];
    const master = call('gcCardMaster_');
    currentRoom = { meta: { battleId, deckMode: 'owned', hostUid: host, guestUid: guest, protocolVersion: 2, seed: 1, createdAt: now - 60000, expiresAt: now + 600000 },
      players: {}, decks: {}, rounds: {} };
    for (const [side, uid] of [host, guest].entries()) {
      const userToken = side === 0 ? studentToken : token;
      currentUid = uid;
      const maxLife = call('gcState_', call('gcSession_', userToken, false)).maxLife;
      currentRoom.players[uid] = { nickname: 'テスト', maxLife, connected: true, lastSeen: now };
      call('gcOnlineJoin_', userToken, { battleId, uid, deckMode: 'owned' });
      if (register) call('gcOnlineDeck_', userToken, { battleId, deck: decks[side], salt: salts[side] });
      currentRoom.decks[uid] = { types: decks[side].map((e) => master.find((c) => c.cardId === e.cardId).type), ssr: [false, false, false, false], commit: engine.deckCommit(decks[side], salts[side]) };
    }
    const round = (number) => {
      const index = number - 1, a = 'c'.repeat(32), b = 'd'.repeat(32);
      const digest = (uid, salt) => require('node:crypto').createHash('sha256').update(`${battleId}:${number}:${index}:${salt}`).digest('hex');
      currentRoom.rounds[number] = { commit: { [host]: digest(host, a), [guest]: digest(guest, b) }, reveal: {
        [host]: { index, salt: a, card: decks[0][index] }, [guest]: { index, salt: b, card: decks[1][index] },
      } };
    };
    const settle = (side = 0) => { currentUid = side === 0 ? host : guest; return call('gcOnlineSettle_', side === 0 ? studentToken : token, { battleId }); };
    return { battleId, decks, round, settle, row: () => sheets.get('OnlineMatches').rows.find((r) => r[0] === battleId), logs: () => sheets.get('BattleLog').rows.filter((r) => r[0] === battleId) };
  };
  try {
    const normal = fixture();
    for (let r = 1; r <= 4; r++) normal.round(r);
    const result = normal.settle();
    assert.equal(result.status, 'complete', '敗者の結果送信も最終デッキ公開も待たず確定する');
    assert.equal(result.reason, 'normal');
    assert.equal(result.result, 'win');
    assert.equal(normal.logs().length, 2, '勝敗を両者へ記録する');
    normal.settle(1); normal.settle();
    assert.equal(normal.logs().length, 2, '双方から再送されても勝利は1回');
    const forfeit = fixture();
    currentRoom.players[guest].lastSeen -= 45000;
    currentRoom.forfeit = { winnerUid: host, loserUid: guest, at: Date.now() };
    const gBefore = call('gcFindUser_', student).values[6];
    const forfeited = forfeit.settle();
    assert.equal(forfeited.status, 'complete'); assert.equal(forfeited.reason, 'forfeit'); assert.equal(forfeited.result, 'win');
    assert.equal(forfeited.awarded, 0); assert.equal(forfeited.gPoint, gBefore, '不戦勝ではミッションを含めGを増やさない');
    assert.equal(forfeit.logs().filter((r) => r[5] === 'win').length, 1, '不戦勝もランキングの勝利に残る');
    currentRoom.players[guest].lastSeen = Date.now();
    assert.equal(forfeit.settle(1).result, 'loss', '切断者が戻っても確定済みの敗北を変えない');
    const noNotice = fixture();
    currentRoom.players[guest].lastSeen -= 45000;
    assert.equal(noNotice.settle().reason, 'forfeit', 'Firebaseの不戦勝通知が失敗してもサーバーで切断を判定する');
    const longGap = fixture();
    currentRoom.players[guest].lastSeen -= 10000;
    assert.equal(longGap.settle().status, 'active', '10秒の一時切断では勝敗を付けない');
    const both = fixture();
    for (const uid of [host, guest]) { currentRoom.players[uid].lastSeen -= 45000; currentRoom.players[uid].connected = false; }
    assert.equal(both.settle().reason, 'cancelled', '両者中断は無効試合');
    assert.equal(both.logs().length, 0, '両者中断では誰にも勝利を加算しない');
    const queued = fixture();
    for (const uid of [host, guest]) currentRoom.players[uid].lastSeen -= 45000;
    currentRoom.forfeit = { winnerUid: host, loserUid: guest, at: Date.now() };
    assert.equal(queued.settle().reason, 'cancelled', '両者不在の後から送られた不戦勝を受け付けない');
    const beforeStart = fixture(false);
    currentRoom.players[guest].lastSeen -= 45000;
    currentRoom.forfeit = { winnerUid: host, loserUid: guest, at: Date.now() };
    assert.equal(beforeStart.settle().reason, 'cancelled', 'デッキ未登録の準備中は不戦勝にしない');
    const priority = fixture();
    for (let r = 1; r <= 4; r++) priority.round(r);
    currentRoom.forfeit = { winnerUid: guest, loserUid: host, at: Date.now() };
    assert.equal(priority.settle().result, 'win', '決着済みなら後の切断より通常の勝敗を優先する');
    const modified = fixture(); modified.round(1);
    currentRoom.rounds[1].reveal[host].card = { ...modified.decks[0][0], trainLevel: 99 };
    for (let r = 2; r <= 4; r++) modified.round(r);
    assert.equal(modified.settle().status, 'invalid', '開始デッキと違う筋トレ値は無効');
    assert.equal(modified.logs().length, 0);
    const stolen = fixture();
    currentUid = guest;
    assert.throws(() => call('gcOnlineSettle_', studentToken, { battleId: stolen.battleId }), /参加情報/, '別のFirebase UIDを学校セッションに結びつけられない');
    const changedDeck = fixture(); currentUid = host;
    assert.throws(() => call('gcOnlineDeck_', studentToken, { battleId: changedDeck.battleId, deck: [...changedDeck.decks[0]].reverse(), salt: 'a'.repeat(32) }), /変更できません/);
    let lookups = 0;
    context.UrlFetchApp = { fetch: (url) => {
      const lookup = url.includes('accounts:lookup');
      if (lookup) lookups++;
      const foreign = !lookup && url.includes('foreign-token');
      return { getResponseCode: () => foreign ? 403 : 200, getContentText: () => JSON.stringify(lookup ? { users: [{ localId: host }] } : currentRoom) };
    } };
    for (let i = 0; i < 2; i++) assert.equal(evidence({ battleId: changedDeck.battleId, firebaseToken: 'test-token' }).uid, host);
    assert.equal(lookups, 1, 'UID確認を短期キャッシュし、外部通信を減らす');
    assert.throws(() => evidence({ battleId: changedDeck.battleId, firebaseToken: 'foreign-token' }), /対戦記録/, '別プロジェクト・参加権限のないトークンを拒否');
    assert.equal(JSON.stringify([...sheets.values()].map(s => s.rows)).includes('test-token'), false, 'Firebaseトークンをシートに保存しない');
    delete context.UrlFetchApp;
  } finally { context.gcOnlineEvidence_ = evidence; }
};
