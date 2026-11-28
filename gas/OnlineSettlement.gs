// Private deck snapshots and authoritative replay. Firebase ID tokens are used
// only during this request; never store them in Sheets, properties, or logs.
const GC_FIREBASE = {
  apiKey: 'AIzaSyD9xMZ2ghoYxihCdjaFAixGZtLJzJU6P8I',
  databaseURL: 'https://g-card-a8611-default-rtdb.asia-southeast1.firebasedatabase.app',
};

function gcOnlineEvidence_(payload) {
  const battleId = gcRequestId_(payload.battleId);
  const token = String(payload.firebaseToken || '');
  if (!token || token.length > 4096) gcError_('LOGIN_REQUIRED', '対戦への接続を確認してください');
  const cacheKey = 'gc-online-auth:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  let uid = CacheService.getScriptCache().get(cacheKey);
  if (!uid) {
    const lookup = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + GC_FIREBASE.apiKey, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true,
    });
    if (lookup.getResponseCode() !== 200) gcError_('LOGIN_REQUIRED', '対戦への接続を確認してください');
    const user = (JSON.parse(lookup.getContentText()).users || [])[0];
    if (!user || !user.localId) gcError_('LOGIN_REQUIRED', '対戦への接続を確認してください');
    uid = user.localId;
    CacheService.getScriptCache().put(cacheKey, uid, 300);
  }
  // A token from a different Firebase project cannot read this participant-only path.
  const response = UrlFetchApp.fetch(GC_FIREBASE.databaseURL + '/rooms/' + encodeURIComponent(battleId) + '.json?auth=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) gcError_('RETRY', '対戦記録を確認できません。接続後にもう一度試してください');
  const room = JSON.parse(response.getContentText());
  if (!room || !room.meta || room.meta.battleId !== battleId || room.meta.guestBattle || room.meta.teacherTest || room.meta.deckMode !== 'owned' ||
      [room.meta.hostUid, room.meta.guestUid].indexOf(uid) < 0) gcError_('BAD_REQUEST', '学校アカウントの対戦記録を確認できません');
  return { uid: uid, room: room };
}

function gcOnlineSide_(row, email, uid) {
  const side = row[2] === email ? 0 : row[4] === email ? 1 : -1;
  if (side < 0 || row[side === 0 ? 3 : 5] !== uid) gcError_('FORBIDDEN', '対戦への参加情報が一致しません');
  return side;
}

function gcOnlineDeck_(token, payload) {
  const identity = gcSession_(token, false);
  gcEconomyAccess_(identity);
  const evidence = gcOnlineEvidence_(payload);
  const battleId = gcRequestId_(payload.battleId);
  return gcWithLock_(function () {
    const found = gcOnlineMatch_(battleId);
    if (!found) gcError_('NOT_FOUND', '対戦が見つかりません');
    const row = found.values;
    const side = gcOnlineSide_(row, identity.email, evidence.uid);
    if (row[11] === 'complete' || row[11] === 'invalid') gcError_('BAD_REQUEST', 'この対戦は終了しました');
    const column = side === 0 ? 13 : 14;
    const old = row[column] ? JSON.parse(row[column]) : null;
    if (old) {
      if (payload.deck && (JSON.stringify(payload.deck) !== JSON.stringify(old.entries) || payload.salt !== old.salt)) gcError_('BAD_DECK', '登録済みのカードは変更できません');
    } else {
      gcOnlineValidateDeck_(identity, 'owned', payload.deck);
      if (!/^[a-f0-9]{32}$/.test(String(payload.salt || ''))) gcError_('BAD_DECK', 'カードの登録情報を確認してください');
    }
    const user = gcUserObject_(gcFindUser_(identity.email));
    const maxLife = gcNumber_(identity.settings, 'initialLife', 100, 1, 9999) + Number(user.runCount || 0) * gcNumber_(identity.settings, 'lifePerRun', 5, 1, 100);
    const proof = old || { entries: payload.deck, salt: payload.salt, maxLife: maxLife, encryptProofs: [] };
    const additions = payload.encryptProofs || [];
    if (!Array.isArray(additions) || additions.length > 4) gcError_('BAD_REQUEST', '暗号化の記録を確認してください');
    additions.forEach(function (item) {
      if (!Number.isInteger(item.round) || item.round < 1 || item.round > 4 || !Number.isInteger(item.index) || item.index < -1 || item.index > 3 ||
          ['rock', 'scissors', 'paper'].indexOf(item.to) < 0 || !/^[a-f0-9]{32}$/.test(String(item.salt || ''))) gcError_('BAD_REQUEST', '暗号化の記録を確認してください');
      const previous = proof.encryptProofs.find(function (entry) { return entry.round === item.round; });
      if (previous && JSON.stringify(previous) !== JSON.stringify(item)) gcError_('BAD_REQUEST', '登録済みの暗号化は変更できません');
      if (!previous) proof.encryptProofs.push(item);
    });
    row[column] = JSON.stringify(proof);
    found.sheet.getRange(found.rowNumber, 1, 1, GC_HEADERS.OnlineMatches.length).setValues([row]);
    return { status: 'registered' };
  });
}

// Fill verification hashes locally to replay independently of the other browser.
// All revealed cards, choices, commitments and encrypted types are still checked
// against both private, ownership-validated starting decks by the shared engine.
function gcOnlineReplay_(room, proofByUid) {
  const replay = JSON.parse(JSON.stringify(room));
  delete replay.forfeit;
  replay.final = {};
  [room.meta.hostUid, room.meta.guestUid].forEach(function (uid) {
    const proof = proofByUid[uid];
    if (proof) replay.final[uid] = proof;
  });
  let view;
  for (let i = 0; i < 5; i++) {
    view = GC_ONLINE_ENGINE.deriveView(replay);
    if (view.phase !== 'verify') return view;
    const hash = GC_ONLINE_ENGINE.stateDigest(view);
    const record = replay.rounds[String(view.round)];
    const hashes = record.stateHash || {};
    if ([room.meta.hostUid, room.meta.guestUid].some(function (uid) { return hashes[uid] && hashes[uid] !== hash; })) return { phase: 'invalid', outcome: null };
    record.stateHash = {};
    record.stateHash[room.meta.hostUid] = hash;
    record.stateHash[room.meta.guestUid] = hash;
  }
  return { phase: 'invalid', outcome: null };
}

function gcOnlineSettle_(token, payload) {
  const identity = gcSession_(token, false);
  const battleId = gcRequestId_(payload.battleId);
  const initial = gcOnlineMatch_(battleId);
  if (!initial) gcError_('NOT_FOUND', '対戦が見つかりません');
  if (initial.values[2] !== identity.email && initial.values[4] !== identity.email) gcError_('FORBIDDEN', 'この対戦には参加していません');
  if (initial.values[11] === 'complete' || initial.values[11] === 'invalid') return gcOnlineResult_(token, { battleId: battleId });
  // Fetch outside the Sheets lock: a slow external request must not block the class.
  const evidence = gcOnlineEvidence_(payload);
  return gcWithLock_(function () {
    const found = gcOnlineMatch_(battleId);
    const row = found.values;
    gcOnlineSide_(row, identity.email, evidence.uid);
    if (row[11] === 'complete' || row[11] === 'invalid') return gcOnlineResult_(token, { battleId: battleId });
    const room = evidence.room;
    const uids = [room.meta.hostUid, room.meta.guestUid];
    if (uids.length !== 2 || !uids[1] || [row[3], row[5]].some(function (uid) { return uids.indexOf(uid) < 0; })) return gcOnlineResult_(token, { battleId: battleId });
    const proofs = {};
    if (row[13]) proofs[row[3]] = JSON.parse(row[13]);
    if (row[14]) proofs[row[5]] = JSON.parse(row[14]);
    const ready = uids.every(function (uid) { return proofs[uid] && room.decks && room.decks[uid]; });
    let reason = '', outcome = null, hash = '';
    if (ready) {
      const master = gcCardMaster_();
      const validDecks = uids.every(function (uid) {
        const player = room.players && room.players[uid];
        const deck = room.decks[uid];
        return player && Number(player.maxLife) === proofs[uid].maxLife && GC_ONLINE_ENGINE.deckCommit(proofs[uid].entries, proofs[uid].salt) === deck.commit &&
          Array.isArray(deck.types) && Array.isArray(deck.ssr) && deck.types.length === 4 && deck.ssr.length === 4 && proofs[uid].entries.every(function (entry, index) {
            const card = master.find(function (item) { return item.cardId === entry.cardId; });
            return card && card.type === deck.types[index] && (card.rarity === 'SSR') === deck.ssr[index];
          });
      });
      const view = validDecks ? gcOnlineReplay_(room, proofs) : { phase: 'invalid' };
      if (view.phase === 'finished') { reason = 'normal'; outcome = view.outcome; hash = GC_ONLINE_ENGINE.stateDigest(view); }
      else if (view.phase === 'invalid') reason = 'invalid';
    }
    const now = Date.now();
    const last = uids.map(function (uid) { return Number(room.players && room.players[uid] && room.players[uid].lastSeen || room.meta.createdAt || now); });
    // An already-decided normal result takes priority over any later disconnect.
    if (!reason && room.forfeit) {
      const winner = uids.indexOf(room.forfeit.winnerUid);
      const loser = uids.indexOf(room.forfeit.loserUid);
      const at = Number(room.forfeit.at);
      // Firebase rules prove the opponent was absent for 30s at write time.
      // The winner must also have been alive at that moment (not both absent).
      if (winner >= 0 && loser >= 0 && winner !== loser && at <= now + 10000 && at >= Number(room.meta.createdAt) && last[winner] >= at - 10000) {
        reason = ready ? 'forfeit' : 'cancelled'; outcome = winner;
      }
    }
    if (!reason && last.every(function (seen) { return now - seen >= 30000; })) reason = 'cancelled';
    if (!reason && ready) {
      const winner = last.findIndex(function (seen, side) { return now - seen <= 10000 && now - last[1 - side] >= 30000 && room.players[uids[side]].connected === true; });
      if (winner >= 0) { reason = 'forfeit'; outcome = winner; }
    }
    if (!reason) return gcOnlineResult_(token, { battleId: battleId });
    row[15] = reason; row[12] = new Date().toISOString();
    if (reason === 'normal' || reason === 'forfeit') {
      const hostIsA = room.meta.hostUid === row[3];
      const aWins = outcome === (hostIsA ? 0 : 1);
      row[6] = outcome === 'draw' ? 'draw' : aWins ? 'win' : 'loss';
      row[8] = outcome === 'draw' ? 'draw' : aWins ? 'loss' : 'win';
      row[7] = hash; row[9] = hash;
      gcOnlineAwardOne_(row, 0, reason === 'forfeit');
      gcOnlineAwardOne_(row, 1, reason === 'forfeit');
      row[11] = 'complete';
    } else { row[11] = 'invalid'; row[6] = ''; row[8] = ''; }
    found.sheet.getRange(found.rowNumber, 1, 1, GC_HEADERS.OnlineMatches.length).setValues([row]);
    return gcOnlineResult_(token, { battleId: battleId });
  });
}
