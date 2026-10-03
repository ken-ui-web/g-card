// Code.gs と同じ Apps Script プロジェクトで使う段階7の処理。
const GC_Q_TYPES = ['single', 'multi', 'dropdown', 'short', 'paragraph', 'scale', 'gridSingle', 'gridMulti'];

function gcLearnRows_(name) {
  return gcSheet_(name).getDataRange().getValues().slice(1).filter(function (row) { return row[0]; });
}
function gcLearnJson_(value, fallback) {
  try { return JSON.parse(value || ''); } catch (_) { return fallback; }
}
function gcLearnDate_(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }
function gcLearnText_(value, max) { return String(value || '').trim().slice(0, max); }
function gcLearnSafeCell_(value) { const text = String(value || ''); return /^[=+\-@]/.test(text) ? "'" + text : text; }
function gcLearnWindow_(start, end) {
  const now = Date.now();
  return (!start || Date.parse(gcLearnDate_(start)) <= now) && (!end || Date.parse(gcLearnDate_(end)) >= now);
}
function gcLearnClass_(classes, user) { return !Array.isArray(classes) || !classes.length || classes.indexOf(String(user.class || '')) >= 0; }
function gcLearnTest_(row) {
  return { testId: String(row[0]), title: String(row[1]), description: String(row[2] || ''), sections: gcLearnJson_(row[3], []), settings: gcLearnJson_(row[4], {}), published: row[5] === true, createdAt: gcLearnDate_(row[6]), updatedAt: gcLearnDate_(row[7]) };
}
function gcLearnReflection_(row) {
  return { reflectionId: String(row[0]), title: String(row[1]), prompt: String(row[2] || ''), targetClasses: gcLearnJson_(row[3], []), startAt: gcLearnDate_(row[4]), endAt: gcLearnDate_(row[5]), gPoint: Number(row[6] || 0), active: row[7] === true };
}
function gcLearnTestById_(testId) {
  const row = gcLearnRows_('Tests').find(function (entry) { return String(entry[0]) === testId; });
  if (!row) gcError_('NOT_FOUND', 'テストが見つかりません');
  return gcLearnTest_(row);
}
function gcLearnQuestions_(testId, includeAnswer) {
  return gcLearnRows_('Questions').filter(function (row) { return row[0] === testId; }).sort(function (a, b) { return Number(a[3]) - Number(b[3]); }).map(function (row) {
    const q = { questionId: String(row[1]), sectionId: String(row[2]), order: Number(row[3]), type: String(row[4]), text: String(row[5]), imageUrl: String(row[6] || ''), options: gcLearnJson_(row[7], {}), points: Number(row[9] || 0), required: row[10] === true, shuffleOptions: row[11] === true };
    if (includeAnswer) { q.answer = gcLearnJson_(row[8], null); q.feedbackCorrect = String(row[12] || ''); q.feedbackWrong = String(row[13] || ''); }
    return q;
  });
}
function gcLearnResponses_(email, testId) {
  return gcLearnRows_('TestResponses').filter(function (row) { return (!email || String(row[2]).toLowerCase() === email) && (!testId || row[1] === testId); });
}
function gcLearningAccess_(identity) {
  if (!identity.admin && identity.settings.learningEnabled !== '1') gcError_('NOT_READY', 'この機能は準備中です');
}
function gcLearnAvailable_(test, user) {
  return test.published && gcLearnClass_(test.settings.targetClasses, user) && gcLearnWindow_(test.settings.startAt, test.settings.endAt);
}
function gcLearnReflectionAvailable_(item, user) {
  return item.active && gcLearnClass_(item.targetClasses, user) && gcLearnWindow_(item.startAt, item.endAt);
}
function gcListTests_(token) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const user = gcUserObject_(identity.record); const all = gcLearnResponses_(identity.email, '');
  return gcLearnRows_('Tests').map(gcLearnTest_).filter(function (test) { return test.published && gcLearnClass_(test.settings.targetClasses, user); }).map(function (test) {
    const own = all.filter(function (row) { return row[1] === test.testId; });
    const limit = Number(test.settings.attemptLimit || 0);
    return { testId: test.testId, title: test.title, description: test.description, startAt: test.settings.startAt || '', endAt: test.settings.endAt || '', attempts: own.length, attemptLimit: limit, bestScore: own.length ? Math.max.apply(null, own.map(function (row) { return Number(row[7] || 0); })) : null, available: gcLearnAvailable_(test, user) && (!limit || own.length < limit), lastResponseId: own.length ? own[own.length - 1][0] : '' };
  });
}
function gcGetTest_(token, payload) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const test = gcLearnTestById_(String(payload.testId || '')); const user = gcUserObject_(identity.record);
  if (!gcLearnAvailable_(test, user)) gcError_('NOT_AVAILABLE', 'このテストは受けられません');
  const attempts = gcLearnResponses_(identity.email, test.testId).length;
  if (Number(test.settings.attemptLimit || 0) && attempts >= Number(test.settings.attemptLimit)) gcError_('LIMIT_REACHED', '受験回数の上限です');
  const questions = gcLearnQuestions_(test.testId, false);
  if (!questions.length) gcError_('NOT_AVAILABLE', 'このテストには問題がありません');
  if (test.settings.shuffleQuestions) questions.sort(function () { return Math.random() - .5; });
  questions.forEach(function (q) { if (q.shuffleOptions && Array.isArray(q.options.choices)) q.options.choices.sort(function () { return Math.random() - .5; }); });
  return { testId: test.testId, title: test.title, description: test.description, sections: test.sections, questions: questions, attemptNo: attempts + 1 };
}
function gcLearnNormalize_(value, options) {
  let text = String(value || '').trim();
  if (options.normalizeWidth !== false) text = text.normalize('NFKC');
  if (options.ignoreCase !== false) text = text.toLocaleLowerCase();
  return text;
}
function gcLearnSameSet_(answer, key) {
  return Array.isArray(answer) && Array.isArray(key) && answer.length === key.length && new Set(answer).size === answer.length && answer.every(function (value) { return key.indexOf(value) >= 0; });
}
function gcLearnAutoScore_(q, answer) {
  if (!q.points || q.type === 'paragraph' || q.type === 'scale') return 0;
  if (q.type === 'single' || q.type === 'dropdown') return answer === q.answer ? q.points : 0;
  if (q.type === 'multi') return gcLearnSameSet_(answer, q.answer) ? q.points : 0;
  if (q.type === 'short') { const keys = Array.isArray(q.answer) ? q.answer : [q.answer]; return keys.some(function (key) { return gcLearnNormalize_(answer, q.options) === gcLearnNormalize_(key, q.options); }) ? q.points : 0; }
  if (q.type === 'gridSingle' || q.type === 'gridMulti') return (q.options.rows || []).every(function (row) { return q.type === 'gridSingle' ? answer && answer[row] === q.answer[row] : answer && gcLearnSameSet_(answer[row], q.answer[row]); }) ? q.points : 0;
  return 0;
}
function gcLearnAnswered_(q, answer) {
  if (answer === null || answer === undefined || answer === '') return false;
  if (Array.isArray(answer)) return answer.length > 0;
  if (q.type === 'gridSingle' || q.type === 'gridMulti') return (q.options.rows || []).every(function (row) { return gcLearnAnswered_({ type: q.type === 'gridSingle' ? 'single' : 'multi' }, answer[row]); });
  return true;
}
function gcLearnValidAnswer_(q, answer) {
  if (!gcLearnAnswered_(q, answer)) return !q.required;
  const choices = q.options.choices || [];
  if (q.type === 'single' || q.type === 'dropdown') return typeof answer === 'string' && choices.indexOf(answer) >= 0;
  if (q.type === 'multi') return Array.isArray(answer) && new Set(answer).size === answer.length && answer.every(function (x) { return choices.indexOf(x) >= 0; });
  if (q.type === 'short' || q.type === 'paragraph') return typeof answer === 'string' && answer.length <= (q.type === 'paragraph' ? 5000 : 500);
  if (q.type === 'scale') return Number.isInteger(Number(answer)) && Number(answer) >= q.options.min && Number(answer) <= q.options.max;
  if (q.type === 'gridSingle' || q.type === 'gridMulti') return answer && typeof answer === 'object' && (q.options.rows || []).every(function (row) { const v = answer[row]; return q.type === 'gridSingle' ? q.options.columns.indexOf(v) >= 0 : Array.isArray(v) && new Set(v).size === v.length && v.every(function (x) { return q.options.columns.indexOf(x) >= 0; }); });
  return false;
}
function gcLearnBest_(email, testId) {
  const sheet = gcSheet_('TestBest'); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(function (row, i) { return i > 0 && String(row[0]).toLowerCase() === email && row[1] === testId; });
  return index < 0 ? null : { sheet: sheet, rowNumber: index + 1, values: rows[index] };
}
function gcLearnAward_(identity, user, test, best, score, maxScore, responseId) {
  const multiplier = Number(test.settings.pointMultiplier === undefined ? 1 : test.settings.pointMultiplier);
  const candidate = maxScore ? Math.round(score / maxScore * 100 * multiplier) : 0;
  const delta = Math.max(0, candidate - (best ? Number(best.values[3] || 0) : 0));
  const firstPerfect = score === maxScore && maxScore > 0 && !(best && best.values[4] === true);
  const perfect = firstPerfect ? gcNumber_(identity.settings, 'perfectBonus', 50, 0, 100000) : 0;
  if (delta) { user.gPoint = Number(user.gPoint || 0) + delta; user.totalEarned = Number(user.totalEarned || 0) + delta; gcPointLog_(identity.email, delta, 'test_score', responseId, user.gPoint); }
  if (perfect) { user.gPoint = Number(user.gPoint || 0) + perfect; user.totalEarned = Number(user.totalEarned || 0) + perfect; gcPointLog_(identity.email, perfect, 'test_perfect', responseId, user.gPoint); }
  return { awarded: delta + perfect, candidate: candidate, perfect: perfect, firstPerfect: firstPerfect };
}
function gcLearnUpdateBest_(identity, test, best, score, candidate, perfect, attempts) {
  const row = [identity.email, test.testId, Math.max(best ? Number(best.values[2] || 0) : 0, score), Math.max(best ? Number(best.values[3] || 0) : 0, candidate), Boolean(perfect || best && best.values[4] === true), attempts];
  if (best) best.sheet.getRange(best.rowNumber, 1, 1, row.length).setValues([row]); else gcSheet_('TestBest').appendRow(row);
}
function gcLearnResult_(identity, test, row) {
  const released = String(row[10]) === 'complete' && (test.settings.resultRelease !== 'teacher' || test.settings.resultsPublished === true);
  const result = { responseId: String(row[0]), testId: test.testId, title: test.title, attemptNo: Number(row[3]), gradingStatus: String(row[10]), released: released, gAwarded: Number(row[9] || 0), gPoint: Number(gcUserObject_(gcFindUser_(identity.email)).gPoint || 0) };
  if (!released) return result;
  result.score = Number(row[7] || 0); result.maxScore = Number(row[8] || 0);
  // 回答は保存しない。問題別の結果は提出直後の応答だけで返す。
  return result;
}
function gcSubmitTest_(token, payload, requestId) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const id = gcRequestId_(requestId); const testId = String(payload.testId || '');
  if (!payload.answers || typeof payload.answers !== 'object' || JSON.stringify(payload.answers).length > 100000) gcError_('BAD_REQUEST', '回答を確認してください');
  return gcWithLock_(function () {
    const test = gcLearnTestById_(testId); const own = gcLearnResponses_(identity.email, testId);
    const old = own.find(function (row) { return row[0] === id; }); if (old) return gcLearnResult_(identity, test, old);
    const record = gcFindUser_(identity.email); const user = gcUserObject_(record);
    if (!gcLearnAvailable_(test, user)) gcError_('NOT_AVAILABLE', 'このテストは受けられません');
    if (Number(test.settings.attemptLimit || 0) && own.length >= Number(test.settings.attemptLimit)) gcError_('LIMIT_REACHED', '受験回数の上限です');
    const questions = gcLearnQuestions_(testId, true); if (!questions.length) gcError_('NOT_AVAILABLE', '問題がありません');
    let auto = 0; let maxScore = 0;
    questions.forEach(function (q) {
      const answer = payload.answers[q.questionId];
      if (!gcLearnValidAnswer_(q, answer)) gcError_('BAD_ANSWER', '未回答または形式の違う答えがあります');
      if (q.type === 'paragraph' && q.points > 0) gcError_('BAD_TEST', '長文問題の配点を0にしてください');
      auto += gcLearnAutoScore_(q, answer); maxScore += q.points;
    });
    const best = gcLearnBest_(identity.email, testId);
    const award = gcLearnAward_(identity, user, test, best, auto, maxScore, id);
    const response = [id, testId, identity.email, own.length + 1, '', auto, 0, auto, maxScore, award.awarded, 'complete', new Date().toISOString()];
    gcSheet_('TestResponses').appendRow(response);
    gcLearnUpdateBest_(identity, test, best, auto, award.candidate, award.firstPerfect, own.length + 1);
    const missions = gcAwardMissions_(identity, user, { submit_test: 1, perfect_test: award.firstPerfect ? 1 : 0 });
    user.updatedAt = new Date().toISOString(); gcWriteUser_(record, user);
    const result = gcLearnResult_(identity, test, response);
    if (result.released && test.settings.resultDetail !== 'score') result.details = questions.map(function (q) {
      const earned = gcLearnAutoScore_(q, payload.answers[q.questionId]);
      const detail = { questionId: q.questionId, text: q.text, earned: earned, points: q.points };
      if (test.settings.resultDetail === 'full') { detail.answer = q.answer; detail.feedback = earned === q.points ? q.feedbackCorrect : q.feedbackWrong; }
      return detail;
    });
    result.completedMissions = missions; return result;
  });
}
function gcGetTestResult_(token, payload) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const response = gcLearnResponses_(identity.email, '').find(function (row) { return row[0] === payload.responseId; });
  if (!response) gcError_('NOT_FOUND', '結果が見つかりません');
  return gcLearnResult_(identity, gcLearnTestById_(String(response[1])), response);
}

// 既存の「授業振り返りシステム」のシートを読み取り、本文はGカードへ複製しない。
// シートは教師のみ共有。学校固有の参照先はスクリプトプロパティに置く。
function gcExternalSheet_(name) {
  const sourceId = PropertiesService.getScriptProperties().getProperty('REFLECTION_SOURCE_ID');
  if (!sourceId) gcError_('REFLECTION_LINK', '振り返りシステムの接続先が未設定です。先生に伝えてください');
  try { const sheet = SpreadsheetApp.openById(sourceId).getSheetByName(name); if (sheet) return sheet; }
  catch (_) { /* 以下の共通エラーを返す。 */ }
  gcError_('REFLECTION_LINK', '振り返りシステムに接続できません。先生に伝えてください');
}
function gcExternalRows_(name, columns, ttl) {
  const key = 'gc-reflection:' + name;
  try { const cached = CacheService.getScriptCache().get(key); if (cached) return JSON.parse(cached); } catch (_) { /* 直接読む。 */ }
  const sheet = gcExternalSheet_(name);
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, columns).getValues();
  try { CacheService.getScriptCache().put(key, JSON.stringify(rows), ttl); } catch (_) { /* キャッシュがなくても続ける。 */ }
  return rows;
}
function gcExternalSubmissionRows_() {
  const cache = CacheService.getScriptCache();
  const key = 'gc-reflection:submission-metadata';
  try { const cached = cache.get(key); if (cached) return JSON.parse(cached); } catch (_) { /* 直接読む。 */ }
  const sheet = gcExternalSheet_('振り返り'); const count = sheet.getLastRow() - 1;
  if (count < 1) return [];
  const keys = sheet.getRange(2, 1, count, 3).getValues();
  const dates = sheet.getRange(2, 5, count, 1).getValues();
  const rows = keys.map(function (row, index) { return { key: String(row[0]), code: String(row[1]), lessonId: String(row[2]), createdAt: gcLearnDate_(dates[index][0]) }; });
  try { cache.put(key, JSON.stringify(rows), 15); } catch (_) { /* キャッシュ容量を超えても続ける。 */ }
  return rows;
}
function gcExternalSnapshot_(email) {
  const roster = gcExternalRows_('名簿', 7, 60);
  const matches = roster.filter(function (row) { return String(row[5] || '').trim().toLowerCase() === email && row[6] !== false && String(row[6]).toUpperCase() !== 'FALSE'; });
  if (matches.length !== 1) gcError_('REFLECTION_ROSTER', '振り返りシステムの名簿に、この学校アカウントがありません');
  const code = String(matches[0][0]).trim(); const grade = String(matches[0][1]).replace(/[年\s]/g, '');
  const topics = gcExternalRows_('題材', 5, 60).filter(function (row) { return row[4] !== false && String(row[4]).toUpperCase() !== 'FALSE' && String(row[1]).replace(/[年\s]/g, '') === grade; }).map(function (row) { return String(row[0]); });
  const lessons = gcExternalRows_('授業', 8, 60).filter(function (row) { return row[7] !== false && String(row[7]).toUpperCase() !== 'FALSE' && topics.indexOf(String(row[1])) >= 0; }).map(function (row) { return { lessonId: String(row[0]), title: String(row[2]), order: Number(row[3] || 0) }; }).sort(function (a, b) { return a.order - b.order; });
  const submissions = gcExternalSubmissionRows_().filter(function (row) { return row.code === code && row.key === code + '::' + row.lessonId; });
  return { code: code, lessons: lessons, submissions: submissions };
}
function gcListReflections_(token) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const source = gcExternalSnapshot_(identity.email);
  const rewarded = new Set(gcLearnRows_('ReflectionResponses').filter(function (row) { return String(row[2]).toLowerCase() === identity.email; }).map(function (row) { return String(row[1]); }));
  return { appUrl: PropertiesService.getScriptProperties().getProperty('REFLECTION_APP_URL') || '', reward: gcNumber_(identity.settings, 'defaultReflectionPoint', 20, 0, 100000), lessons: source.lessons.map(function (lesson) { return { lessonId: lesson.lessonId, title: lesson.title, submitted: source.submissions.some(function (row) { return row.lessonId === lesson.lessonId; }), rewarded: rewarded.has(lesson.lessonId) }; }) };
}
function gcSyncReflections_(token) {
  const identity = gcSession_(token, false); gcLearningAccess_(identity); const source = gcExternalSnapshot_(identity.email);
  const properties = PropertiesService.getScriptProperties(); let start = properties.getProperty('REFLECTION_REWARD_START_AT');
  if (!start) { start = new Date().toISOString(); properties.setProperty('REFLECTION_REWARD_START_AT', start); }
  const valid = new Set(source.lessons.map(function (lesson) { return lesson.lessonId; }));
  const fresh = source.submissions.filter(function (row) { return valid.has(row.lessonId) && Date.parse(row.createdAt) >= Date.parse(start); });
  if (!fresh.length) return { awarded: 0, newSubmissions: 0, gPoint: Number(gcUserObject_(identity.record).gPoint || 0) };
  return gcWithLock_(function () {
    const ledger = gcSheet_('ReflectionResponses');
    const prior = new Set(gcLearnRows_('ReflectionResponses').filter(function (row) { return String(row[2]).toLowerCase() === identity.email; }).map(function (row) { return String(row[1]); }));
    const logs = new Set(gcLearnRows_('PointLog').filter(function (row) { return String(row[1]).toLowerCase() === identity.email && row[3] === 'reflection'; }).map(function (row) { return String(row[4]); }));
    const record = gcFindUser_(identity.email); const user = gcUserObject_(record);
    const reward = gcNumber_(identity.settings, 'defaultReflectionPoint', 20, 0, 100000);
    let count = 0; let awarded = 0;
    fresh.forEach(function (item) {
      if (prior.has(item.lessonId)) return;
      const refId = source.code + '::' + item.lessonId;
      if (!logs.has(refId)) {
        user.gPoint = Number(user.gPoint || 0) + reward;
        user.totalEarned = Number(user.totalEarned || 0) + reward;
        if (reward) gcPointLog_(identity.email, reward, 'reflection', refId, user.gPoint);
        awarded += reward; count++;
      }
      ledger.appendRow([Utilities.getUuid(), item.lessonId, identity.email, '', reward, item.createdAt]);
      prior.add(item.lessonId);
    });
    const missions = count ? gcAwardMissions_(identity, user, { submit_reflection: count }) : [];
    if (count) { user.updatedAt = new Date().toISOString(); gcWriteUser_(record, user); }
    return { awarded: awarded, newSubmissions: count, gPoint: Number(user.gPoint || 0), completedMissions: missions };
  });
}

function gcAdminListTests_(token) {
  gcSession_(token, true);
  const responses = gcLearnRows_('TestResponses');
  return gcLearnRows_('Tests').map(gcLearnTest_).map(function (test) {
    test.responses = responses.filter(function (row) { return row[1] === test.testId; }).length;
    return test;
  });
}
function gcAdminGetTest_(token, payload) {
  gcSession_(token, true);
  const test = gcLearnTestById_(String(payload.testId || ''));
  return { test: test, questions: gcLearnQuestions_(test.testId, true) };
}
function gcLearnQuestionRow_(testId, q, order, sectionIds, published) {
  if (!q || !/^[a-zA-Z0-9-]{8,80}$/.test(String(q.questionId || '')) || sectionIds.indexOf(q.sectionId) < 0 || GC_Q_TYPES.indexOf(q.type) < 0) gcError_('BAD_TEST', '問題のID・形式・セクションを確認してください');
  const text = gcLearnText_(q.text, 2000); const points = Number(q.points || 0); const options = q.options || {};
  if (!Number.isInteger(points) || points < 0 || points > 100 || ['paragraph', 'scale'].indexOf(q.type) >= 0 && points !== 0) gcError_('BAD_TEST', '配点を確認してください。長文と目盛は0点です');
  if (published && !text) gcError_('BAD_TEST', '問題文を入力してください');
  if (['single', 'multi', 'dropdown'].indexOf(q.type) >= 0 && (!Array.isArray(options.choices) || options.choices.length < 2 || options.choices.length > 20 || options.choices.some(function (x) { return !String(x).trim() || String(x).length > 200; }) || new Set(options.choices).size !== options.choices.length)) gcError_('BAD_TEST', '選択肢を2〜20個入力してください');
  if (['gridSingle', 'gridMulti'].indexOf(q.type) >= 0 && (!Array.isArray(options.rows) || !options.rows.length || !Array.isArray(options.columns) || options.columns.length < 2)) gcError_('BAD_TEST', 'グリッドの行と列を入力してください');
  if (q.type === 'scale' && (!Number.isInteger(Number(options.min)) || !Number.isInteger(Number(options.max)) || Number(options.min) >= Number(options.max) || Number(options.max) - Number(options.min) > 10)) gcError_('BAD_TEST', '目盛の範囲を確認してください');
  if (published && points > 0 && (q.answer === null || q.answer === undefined || q.answer === '' || Array.isArray(q.answer) && !q.answer.length)) gcError_('BAD_TEST', '配点のある問題には正解を設定してください');
  if (published && points > 0 && ['single', 'dropdown'].indexOf(q.type) >= 0 && options.choices.indexOf(q.answer) < 0) gcError_('BAD_TEST', '正解を選択肢から選んでください');
  if (published && points > 0 && q.type === 'multi' && (!Array.isArray(q.answer) || !q.answer.length || !q.answer.every(function (x) { return options.choices.indexOf(x) >= 0; }))) gcError_('BAD_TEST', '正解の組み合わせを確認してください');
  if (published && points > 0 && q.type === 'short' && (!Array.isArray(q.answer) || !q.answer.some(function (x) { return String(x).trim(); }))) gcError_('BAD_TEST', '短文の正解を入力してください');
  if (published && points > 0 && ['gridSingle', 'gridMulti'].indexOf(q.type) >= 0 && !(options.rows || []).every(function (r) { const answer = q.answer && q.answer[r]; return q.type === 'gridSingle' ? options.columns.indexOf(answer) >= 0 : Array.isArray(answer) && answer.length && answer.every(function (x) { return options.columns.indexOf(x) >= 0; }); })) gcError_('BAD_TEST', 'グリッドの各行に正解を設定してください');
  const imageUrl = String(q.imageUrl || '').trim();
  if (imageUrl && (!/^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com)\//i.test(imageUrl) || imageUrl.length > 2000)) gcError_('BAD_TEST', '問題画像は学校で共有したGoogleドライブのURLを指定してください');
  const row = [testId, String(q.questionId), q.sectionId, order + 1, q.type, gcLearnSafeCell_(text), imageUrl, JSON.stringify(options), JSON.stringify(q.answer === undefined ? null : q.answer), points, q.required === true, q.shuffleOptions === true, gcLearnSafeCell_(gcLearnText_(q.feedbackCorrect, 1000)), gcLearnSafeCell_(gcLearnText_(q.feedbackWrong, 1000))];
  if (JSON.stringify(row).length > 40000) gcError_('BAD_TEST', '問題の入力が長すぎます');
  return row;
}
function gcAdminSaveTest_(token, payload) {
  gcSession_(token, true);
  const test = payload.test || {}; const questions = payload.questions;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(String(test.testId || '')) || !Array.isArray(test.sections) || !test.sections.length || test.sections.length > 30 || !Array.isArray(questions) || questions.length > 100) gcError_('BAD_TEST', 'テストの構成を確認してください');
  const title = gcLearnText_(test.title, 120); if (!title) gcError_('BAD_TEST', 'タイトルを入力してください');
  const sections = test.sections.map(function (section) { return { sectionId: String(section.sectionId || ''), title: gcLearnText_(section.title, 120), description: gcLearnText_(section.description, 1000) }; });
  const sectionIds = sections.map(function (section) { return section.sectionId; });
  if (sectionIds.some(function (id) { return !/^[a-zA-Z0-9-]{8,80}$/.test(id); }) || new Set(sectionIds).size !== sectionIds.length || new Set(questions.map(function (q) { return q.questionId; })).size !== questions.length) gcError_('BAD_TEST', 'セクションまたは問題が重複しています');
  const settings = test.settings || {}; const limit = Number(settings.attemptLimit || 0); const multiplier = Number(settings.pointMultiplier === undefined ? 1 : settings.pointMultiplier);
  if (!Number.isInteger(limit) || limit < 0 || limit > 100 || !Number.isFinite(multiplier) || multiplier < 0 || multiplier > 10 || ['immediate', 'teacher'].indexOf(settings.resultRelease) < 0 || ['score', 'correctness', 'full'].indexOf(settings.resultDetail) < 0 || !Array.isArray(settings.targetClasses) || settings.targetClasses.length > 20) gcError_('BAD_TEST', 'テストの設定を確認してください');
  if (settings.startAt && !Number.isFinite(Date.parse(settings.startAt)) || settings.endAt && !Number.isFinite(Date.parse(settings.endAt))) gcError_('BAD_TEST', '公開期間を確認してください');
  const rows = questions.map(function (q, i) { return gcLearnQuestionRow_(test.testId, q, i, sectionIds, test.published === true); });
  if (test.published === true && !rows.length) gcError_('BAD_TEST', '公開するテストに問題を追加してください');
  const savedSettings = { startAt: String(settings.startAt || ''), endAt: String(settings.endAt || ''), targetClasses: settings.targetClasses.map(String), attemptLimit: limit, resultRelease: settings.resultRelease, resultDetail: settings.resultDetail, pointMultiplier: multiplier, shuffleQuestions: settings.shuffleQuestions === true, resultsPublished: settings.resultsPublished === true };
  return gcWithLock_(function () {
    const sheet = gcSheet_('Tests'); const all = sheet.getDataRange().getValues(); const index = all.findIndex(function (row, i) { return i > 0 && row[0] === test.testId; });
    if (index >= 0 && gcLearnResponses_('', test.testId).length) {
      const old = gcLearnQuestions_(test.testId, true); const keys = ['questionId', 'sectionId', 'type', 'text', 'imageUrl', 'options', 'answer', 'points'];
      const pick = function (q) { const item = {}; keys.forEach(function (key) { item[key] = q[key]; }); return item; };
      if (JSON.stringify(questions.map(pick)) !== JSON.stringify(old.map(pick))) gcError_('TEST_LOCKED', '受験済みのテストの問題は変更できません。複製して作成してください');
    }
    const now = new Date().toISOString(); const row = [test.testId, gcLearnSafeCell_(title), gcLearnSafeCell_(gcLearnText_(test.description, 2000)), JSON.stringify(sections), JSON.stringify(savedSettings), test.published === true, index >= 0 ? all[index][6] : now, now];
    if (index >= 0) sheet.getRange(index + 1, 1, 1, 8).setValues([row]); else sheet.appendRow(row);
    const qSheet = gcSheet_('Questions'); const oldRows = qSheet.getDataRange().getValues();
    for (let i = oldRows.length - 1; i >= 1; i--) if (oldRows[i][0] === test.testId) qSheet.deleteRow(i + 1);
    if (rows.length) qSheet.getRange(qSheet.getLastRow() + 1, 1, rows.length, 14).setValues(rows);
    return { testId: test.testId, saved: true };
  });
}
function gcAdminDeleteTest_(token, payload) {
  gcSession_(token, true); const id = String(payload.testId || '');
  return gcWithLock_(function () {
    if (gcLearnResponses_('', id).length) gcError_('TEST_LOCKED', '受験済みのテストは削除できません。非公開にしてください');
    ['Questions', 'Tests'].forEach(function (name) { const sheet = gcSheet_(name); const rows = sheet.getDataRange().getValues(); for (let i = rows.length - 1; i >= 1; i--) if (rows[i][0] === id) sheet.deleteRow(i + 1); });
    return { deleted: true };
  });
}
function gcAdminTestResponses_(token, payload) {
  gcSession_(token, true); const id = String(payload.testId || ''); gcLearnTestById_(id);
  const users = gcLearnRows_('Users'); const rows = gcLearnResponses_('', id);
  const responses = rows.map(function (row) { const user = users.find(function (u) { return String(u[0]).toLowerCase() === String(row[2]).toLowerCase(); }); return { responseId: String(row[0]), email: String(row[2]), className: user ? String(user[2]) : '', number: user ? String(user[3]) : '', name: user ? String(user[4]) : '', attemptNo: Number(row[3]), score: Number(row[7] || 0), maxScore: Number(row[8] || 0), gAwarded: Number(row[9] || 0), submittedAt: gcLearnDate_(row[11]) }; });
  const histogram = [0, 0, 0, 0, 0]; responses.forEach(function (r) { histogram[Math.min(4, Math.floor((r.maxScore ? r.score / r.maxScore : 0) * 5))]++; });
  return { responses: responses, histogram: histogram, count: responses.length };
}
