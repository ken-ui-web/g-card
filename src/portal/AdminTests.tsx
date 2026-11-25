import { useEffect, useRef, useState } from 'react';
import { TestAuthorDialog, TestImportDialog, TestPreviewDialog } from './TestAuthorDialogs';
import { TestChoiceEditor } from './TestChoiceEditor';
import { isChoice, questionIssue, type Question } from './testAuthoring';
import { callApi } from './api';
import { LoadingState } from '../components/LoadingState';
import './testAuthor.css';

type Section = { sectionId: string; title: string; description: string };
type Settings = { startAt: string; endAt: string; targetClasses: string[]; attemptLimit: number; resultRelease: 'immediate' | 'teacher'; resultDetail: 'score' | 'correctness' | 'full'; pointMultiplier: number; shuffleQuestions: boolean; resultsPublished: boolean };
type Test = { testId: string; title: string; description: string; sections: Section[]; settings: Settings; published: boolean; responses?: number };
type Summary = { count: number; histogram: number[]; responses: { responseId: string; email: string; className: string; number: string; name: string; attemptNo: number; score: number; maxScore: number; gAwarded: number; submittedAt: string }[] };

const labels: Record<string, string> = { single: 'ラジオボタン（1つ選ぶ）', multi: 'チェックボックス（複数選ぶ）', dropdown: 'プルダウン', short: '記述式（短文）', paragraph: '段落（長文・採点なし）', scale: '均等目盛（採点なし）', gridSingle: '選択式グリッド', gridMulti: 'チェックボックスグリッド' };
const uid = () => crypto.randomUUID();
function freshTest(): Test { return { testId: uid(), title: '', description: '', sections: [{ sectionId: uid(), title: 'セクション1', description: '' }], settings: { startAt: '', endAt: '', targetClasses: [], attemptLimit: 0, resultRelease: 'immediate', resultDetail: 'score', pointMultiplier: 1, shuffleQuestions: false, resultsPublished: false }, published: false }; }
function freshQuestion(sectionId: string): Question { return { questionId: uid(), sectionId, type: 'single', text: '', options: { choices: ['選択肢1', '選択肢2'] }, answer: null, points: 1, required: true, shuffleOptions: false, feedbackCorrect: '', feedbackWrong: '' }; }
function csvCell(value: unknown) { const text = String(value ?? ''); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; }
function downloadCsv(name: string, rows: unknown[][]) { const content = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function AdminTests({ session }: { session: string }) {
  const [list, setList] = useState<Test[] | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tab, setTab] = useState<'questions' | 'responses' | 'settings'>('questions');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [dialog, setDialog] = useState<'import' | 'excel' | 'preview' | 'publish' | null>(null);
  const [previewPaper, setPreviewPaper] = useState<import('./TestPaper').Paper | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const attemptedRevision = useRef(-1);
  const editor = useRef<HTMLElement>(null);
  const focusQuestion = useRef(false);
  const dragIndex = useRef<number | null>(null);
  const question = questions.find((item) => item.questionId === activeId);
  const activeSection = test?.sections.find((part) => part.sectionId === (question?.sectionId ?? sectionId)) ?? test?.sections[0];
  const locked = Boolean(test?.responses);
  const orderedQuestions = test?.sections.flatMap((part) => questions.filter((q) => q.sectionId === part.sectionId)) ?? [];
  const questionNumbers = new Map(orderedQuestions.map((q, index) => [q.questionId, index + 1]));
  const issues = new Map(questions.map((q) => [q.questionId, questionIssue(q)]));
  const maxScore = questions.reduce((total, q) => total + q.points, 0);
  const firstIssue = orderedQuestions.find((q) => issues.get(q.questionId));
  const publicationIssue = !test?.title.trim() ? 'テスト名を入力してください。'
    : !questions.length ? '問題を1問以上追加してください。'
    : firstIssue ? `問題 ${questionNumbers.get(firstIssue.questionId)} · ${issues.get(firstIssue.questionId)}`
    : test.settings.startAt && test.settings.endAt && Date.parse(test.settings.startAt) >= Date.parse(test.settings.endAt) ? '公開終了を公開開始より後にしてください。' : '';
  useEffect(() => { let active = true; callApi<Test[]>('adminListTests', session).then((value) => { if (active) setList(value); }).catch((failure: Error & { code?: string }) => { if (active) setMessage(failure.code === 'NOT_IMPLEMENTED' ? '先生によるサーバー更新後に使えます。' : failure.message); }); return () => { active = false; }; }, [session]);
  useEffect(() => {
    if (!test || !dirty || busy || saving || test.published || !test.title.trim() || attemptedRevision.current === revision.current || questions.some((q) => questionIssue(q, false))) return;
    const timer = window.setTimeout(() => { void save(false); }, 5000);
    return () => window.clearTimeout(timer);
  }, [test, questions, dirty, busy, saving, dialog]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (focusQuestion.current && activeId) editor.current?.querySelector<HTMLTextAreaElement>('[data-author-question-text]')?.focus();
    focusQuestion.current = false;
  }, [activeId]);
  const markDirty = () => { revision.current++; setDirty(true); };
  const changeTest = (update: Partial<Test>) => { setTest((current) => current ? { ...current, ...update } : current); markDirty(); };
  const changeSettings = (update: Partial<Settings>) => { setTest((current) => current ? { ...current, settings: { ...current.settings, ...update } } : current); markDirty(); };
  const changeQuestion = (index: number, update: Partial<Question>) => { setQuestions((current) => current.map((q, i) => i === index ? { ...q, ...update } : q)); markDirty(); };
  const save = async (announce = true, published = test?.published) => {
    if (!test || busy || inFlight.current) return;
    const structuralIssue = questions.find((q) => questionIssue(q, false));
    if (structuralIssue) { setMessage(`問題 ${questionNumbers.get(structuralIssue.questionId)} · ${questionIssue(structuralIssue, false)}`); return; }
    if (published && publicationIssue) { setMessage(publicationIssue); return; }
    const next = { ...test, published: published === true };
    const sentRevision = revision.current;
    inFlight.current = true;
    attemptedRevision.current = sentRevision;
    setSaving(true);
    if (announce) setMessage('');
    try {
      await callApi('adminSaveTest', session, { test: next, questions });
      if (revision.current === sentRevision) setDirty(false);
      if (test.published !== next.published) setTest((current) => current ? { ...current, published: next.published } : current);
      if (announce) setMessage(next.published !== test.published ? next.published ? '生徒に公開しました。' : '公開を停止しました。' : '保存しました。');
      setList((current) => current?.some((item) => item.testId === next.testId)
        ? current.map((item) => item.testId === next.testId ? { ...item, ...next } : item)
        : [next, ...(current ?? [])]);
    }
    catch (failure) { setMessage((failure as Error).message); }
    finally { inFlight.current = false; setSaving(false); }
  };
  const open = async (id: string, copy = false) => {
    setBusy(true); setMessage('');
    try {
      const data = await callApi<{ test: Test; questions: Question[] }>('adminGetTest', session, { testId: id });
      if (copy) duplicate(data.test, data.questions);
      else loadEditor(data.test, data.questions);
    }
    catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!test || !window.confirm(`「${test.title}」を削除しますか？`)) return;
    setBusy(true);
    try { await callApi('adminDeleteTest', session, { testId: test.testId }); setTest(null); setList(await callApi<Test[]>('adminListTests', session)); setMessage('削除しました。'); }
    catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const showResponses = async () => {
    if (!test) return; setTab('responses'); setBusy(true);
    try { setSummary(await callApi<Summary>('adminTestResponses', session, { testId: test.testId })); }
    catch (failure) { setMessage((failure as Error).message); }
    finally { setBusy(false); }
  };
  const loadEditor = (item: Test, entries: Question[]) => {
    const first = entries.find((q) => q.sectionId === item.sections[0]?.sectionId);
    setTest(item); setQuestions(entries); setSectionId(item.sections[0]?.sectionId ?? '');
    setActiveId(first?.questionId ?? null); setTab('questions'); setDirty(false); setSummary(null);
  };
  const duplicate = (source: Test, entries: Question[]) => {
    const copied = freshTest();
    const sectionMap = new Map(source.sections.map((part) => [part.sectionId, uid()]));
    copied.title = `${source.title.slice(0, 115)} のコピー`;
    copied.description = source.description;
    copied.sections = source.sections.map((part) => ({ ...part, sectionId: sectionMap.get(part.sectionId)! }));
    copied.settings = { ...source.settings, startAt: '', endAt: '', resultsPublished: false };
    loadEditor(copied, entries.map((q) => ({ ...q, questionId: uid(), sectionId: sectionMap.get(q.sectionId)! })));
    markDirty();
    setMessage('公開日時を空欄にしたコピーを作成しました。対象クラスは公開前に確認できます。');
  };
  const selectQuestion = (item: Question, focus = false) => {
    focusQuestion.current = focus; setActiveId(item.questionId); setSectionId(item.sectionId);
  };
  const addQuestion = (source?: Question) => {
    if (!activeSection || locked || questions.length >= 100) return;
    const item = source ? { ...source, questionId: uid() } : freshQuestion(activeSection.sectionId);
    const next = [...questions];
    next.splice(source ? questions.indexOf(source) + 1 : next.length, 0, item);
    setQuestions(next); markDirty(); selectQuestion(item, true);
  };
  const removeQuestion = (item: Question) => {
    if (item.text.trim() && !window.confirm('この問題を削除しますか？')) return;
    const next = questions.filter((q) => q.questionId !== item.questionId);
    setQuestions(next); markDirty();
    setActiveId(next.find((q) => q.sectionId === item.sectionId)?.questionId ?? null);
  };
  const updateSection = (change: Partial<Section>) => {
    if (test && activeSection) changeTest({ sections: test.sections.map((part) => part.sectionId === activeSection.sectionId ? { ...part, ...change } : part) });
  };
  const addSection = () => {
    if (!test) return;
    const part = { sectionId: uid(), title: `セクション${test.sections.length + 1}`, description: '' };
    changeTest({ sections: [...test.sections, part] }); setSectionId(part.sectionId); setActiveId(null);
  };
  const removeSection = () => {
    if (!test || !activeSection) return;
    const remaining = test.sections.filter((part) => part.sectionId !== activeSection.sectionId);
    changeTest({ sections: remaining }); setSectionId(remaining[0].sectionId);
  };
  const neighbor = (index: number, direction: number) => {
    for (let i = index + direction; i >= 0 && i < questions.length; i += direction) {
      if (questions[i].sectionId === questions[index].sectionId) return i;
    }
    return -1;
  };
  const move = (from: number, to: number) => {
    if (locked || from === to || to < 0 || questions[from]?.sectionId !== questions[to]?.sectionId) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setQuestions(next); markDirty();
  };
  const showPreview = () => {
    if (!test || !questions.length) return;
    const shuffle = <T,>(items: T[]) => {
      const next = [...items];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    };
    const entries = (test.settings.shuffleQuestions ? shuffle(questions) : questions).map((q) =>
      q.shuffleOptions && q.options.choices ? { ...q, options: { ...q.options, choices: shuffle(q.options.choices) } } : q);
    setPreviewPaper({ ...test, title: test.title || '無題のテスト', attemptNo: 1, questions: entries });
    setDialog('preview');
  };
  return <section ref={editor} className="admin-tests panel">
    <header className="test-author-heading">
      <div><h2>テストの作成・集計</h2>{!test && <p>新しいテストを作成するか、過去のテストを開いてください。</p>}</div>
      {!test && <button type="button" className="button button--primary" disabled={busy} onClick={() => {
        loadEditor(freshTest(), []); markDirty(); setMessage('');
      }}>＋ 新しいテスト</button>}
    </header>
    {!test ? <>
      <div className="learning-list test-author-list">{list?.map((item) => <article key={item.testId}>
        <div><strong>{item.title}</strong><small>{item.published ? '公開設定済み' : '下書き'} · 受験 {item.responses ?? 0} 件</small></div>
        <div className="test-author-actions">
          <button type="button" className="test-author-link" disabled={busy} onClick={() => { void open(item.testId, true); }}>複製</button>
          <button type="button" className="button button--ghost" disabled={busy} onClick={() => { void open(item.testId); }}>編集する</button>
        </div>
      </article>)}</div>
      {list?.length === 0 && <p>テストはまだありません。</p>}
      {(!list && !message || busy) && <LoadingState text="テストを読み込み中" />}
    </> : <>
      <div className="admin-tests-top">
        <button type="button" className="test-author-link" disabled={busy || saving} onClick={() => {
          if (!dirty || window.confirm('未保存の変更があります。一覧へ戻りますか？')) { setTest(null); setDirty(false); setMessage(''); }
        }}>← 一覧へ戻る</button>
        <span role="status">{saving ? '保存中…' : dirty ? '未保存の変更あり' : test.published ? '公開設定済み' : '下書き保存済み'}</span>
        <div className="test-author-actions">
          <button type="button" className="button button--ghost" disabled={!questions.length} onClick={showPreview}>プレビュー</button>
          <button type="button" className="button button--ghost" disabled={busy || saving || !dirty || !test.title.trim()} onClick={() => { void save(); }}>{test.published ? '変更を保存' : '下書きを保存'}</button>
          {!test.published && <button type="button" className="button button--primary" disabled={busy || saving} onClick={() => setDialog('publish')}>公開前の確認</button>}
        </div>
      </div>
      <div className="test-author-info">
        <label className="admin-tests-title">テスト名<input value={test.title} maxLength={120} placeholder="例：情報セキュリティの確認テスト" onChange={(event) => changeTest({ title: event.target.value })} /></label>
        <label>説明<textarea rows={2} maxLength={2000} value={test.description} onChange={(event) => changeTest({ description: event.target.value })} /></label>
      </div>
      <nav className="admin-tests-tabs" aria-label="テストの編集内容">
        <button type="button" className={tab === 'questions' ? 'is-active' : ''} aria-pressed={tab === 'questions'} onClick={() => setTab('questions')}>問題</button>
        <button type="button" className={tab === 'settings' ? 'is-active' : ''} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>公開設定</button>
        <button type="button" className={tab === 'responses' ? 'is-active' : ''} aria-pressed={tab === 'responses'} disabled={busy || saving || dirty && !list?.some((item) => item.testId === test.testId)} onClick={() => { void showResponses(); }}>回答・集計</button>
      </nav>

        {tab === 'questions' && activeSection && <div className="test-editor-layout">
          <nav className="test-editor-nav" aria-label="問題一覧">
            <div className="test-editor-nav-head"><h3>問題一覧</h3><span>{questions.length}問 · {maxScore}点</span></div>
            <div className="test-editor-nav-scroll">
              {test.sections.map((part, partIndex) => <div className="test-editor-nav-group" key={part.sectionId}>
                <button type="button" className="test-editor-section-link" aria-current={sectionId === part.sectionId && !question ? 'true' : undefined} onClick={() => { setActiveId(null); setSectionId(part.sectionId); }}>
                  {part.title || `セクション ${partIndex + 1}`}
                </button>
                {questions.filter((q) => q.sectionId === part.sectionId).map((q) => <button
                  type="button" key={q.questionId} className="test-editor-nav-question"
                  aria-current={question?.questionId === q.questionId ? 'true' : undefined}
                  draggable={!locked} onDragStart={(event) => { dragIndex.current = questions.indexOf(q); event.dataTransfer.setData('text/plain', q.questionId); }}
                  onDragEnd={() => { dragIndex.current = null; }}
                  onDragOver={(event) => { if (dragIndex.current !== null && questions[dragIndex.current]?.sectionId === q.sectionId) event.preventDefault(); }}
                  onDrop={(event) => { event.preventDefault(); if (dragIndex.current !== null) move(dragIndex.current, questions.indexOf(q)); dragIndex.current = null; }}
                  onClick={() => selectQuestion(q)}>
                  <span>{questionNumbers.get(q.questionId)}. {q.text.trim() || '問題文未入力'}</span><small>{issues.get(q.questionId) ? '要確認' : `${q.points}点`}</small>
                </button>)}
              </div>)}
            </div>
            <button type="button" className="test-author-link" disabled={locked || test.sections.length >= 30} onClick={addSection}>＋ セクションを追加</button>
          </nav>
          <div className="test-editor-main">
            <div className="test-editor-toolbar">
              <strong>{activeSection.title || 'セクション'}</strong>
              <button type="button" className="test-author-link" disabled={locked || questions.length >= 100} onClick={() => setDialog('excel')}>Excelで一括作成</button>
              <button type="button" className="test-author-link" disabled={locked || questions.length >= 100} onClick={() => setDialog('import')}>一括貼り付け</button>
              <button type="button" className="button button--primary" disabled={locked || questions.length >= 100} onClick={() => addQuestion()}>＋ 問題を追加</button>
            </div>
            {locked && <p className="test-author-warning">受験記録のあるテストです。問題を編集するには「テストを複製」を選んでください。</p>}
            {!question ? <div className="test-editor-empty">
              <h3>セクションの設定</h3>
              <label>セクション名<input maxLength={120} value={activeSection.title} onChange={(event) => updateSection({ title: event.target.value })} /></label>
              <label>説明<textarea rows={2} maxLength={1000} value={activeSection.description} onChange={(event) => updateSection({ description: event.target.value })} /></label>
              {test.sections.length > 1 && <button type="button" className="test-author-link" disabled={questions.some((q) => q.sectionId === activeSection.sectionId)} onClick={removeSection}>空のセクションを削除</button>}
              {!questions.some((q) => q.sectionId === activeSection.sectionId) && <p>「問題を追加」または「一括貼り付け」から始めてください。</p>}
            </div> : ((q, index) => <fieldset className="admin-question-card test-editor-question" disabled={locked} key={q.questionId}>
              <div className="admin-question-head">
                <span>問題 {questionNumbers.get(q.questionId)}</span>
                <button type="button" disabled={neighbor(index, -1) < 0} onClick={() => move(index, neighbor(index, -1))} aria-label="上へ移動">↑</button>
                <button type="button" disabled={neighbor(index, 1) < 0} onClick={() => move(index, neighbor(index, 1))} aria-label="下へ移動">↓</button>
                <button type="button" disabled={questions.length >= 100} onClick={() => addQuestion(q)}>複製</button>
                <button type="button" onClick={() => removeQuestion(q)}>削除</button>
              </div>
              <label>問題文<textarea data-author-question-text rows={3} maxLength={2000} value={q.text} placeholder="生徒に出す問題を入力" onChange={(event) => changeQuestion(index, { text: event.target.value })} /></label>
              <div className="test-editor-fields">
                <label>形式<select value={q.type} onChange={(event) => {
                  const type = event.target.value;
                  const keptChoices = isChoice(type) && isChoice(q.type);
                  const answer = keptChoices ? type === 'multi' ? typeof q.answer === 'string' && q.answer ? [q.answer] : q.answer : Array.isArray(q.answer) ? q.answer.length === 1 ? q.answer[0] : null : q.answer : null;
                  const options = keptChoices ? q.options : isChoice(type) ? { choices: ['選択肢1', '選択肢2'] } : type.startsWith('grid') ? { rows: ['行1'], columns: ['列1', '列2'] } : type === 'scale' ? { min: 1, max: 5 } : {};
                  changeQuestion(index, { type, points: ['paragraph', 'scale'].includes(type) ? 0 : q.points, options, answer });
                }}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>配点<input type="number" min={0} max={100} disabled={['paragraph', 'scale'].includes(q.type)} value={q.points} onChange={(event) => changeQuestion(index, { points: Number(event.target.value) })} /></label>
                {test.sections.length > 1 && <label>セクション<select value={q.sectionId} onChange={(event) => { changeQuestion(index, { sectionId: event.target.value }); setSectionId(event.target.value); }}>{test.sections.map((part) => <option value={part.sectionId} key={part.sectionId}>{part.title}</option>)}</select></label>}
              </div>
              {isChoice(q.type) && <TestChoiceEditor question={q} onChange={(change) => changeQuestion(index, change)} />}
              {issues.get(q.questionId) && <p className="test-author-warning">{issues.get(q.questionId)}</p>}
              <details className="test-editor-media"><summary>問題画像</summary><label>問題画像のURL（学校で共有したGoogleドライブ）<input type="url" value={q.imageUrl ?? ''} placeholder="https://drive.google.com/file/d/..." onChange={(event) => changeQuestion(index, { imageUrl: event.target.value })} /></label>
                </details>
              {q.type.startsWith('grid') && <div className="admin-question-main"><label>行（改行で区切る）<textarea value={(q.options.rows ?? []).join('\n')} onChange={(event) => changeQuestion(index, { options: { ...q.options, rows: event.target.value.split('\n') } })} /></label><label>列（改行で区切る）<textarea value={(q.options.columns ?? []).join('\n')} onChange={(event) => changeQuestion(index, { options: { ...q.options, columns: event.target.value.split('\n') } })} /></label></div>}
                {q.type === 'scale' && <div className="admin-question-main"><label>最小<input type="number" value={q.options.min ?? 1} onChange={(event) => changeQuestion(index, { options: { ...q.options, min: Number(event.target.value) } })} /></label><label>最大<input type="number" value={q.options.max ?? 5} onChange={(event) => changeQuestion(index, { options: { ...q.options, max: Number(event.target.value) } })} /></label></div>}
                <details className="admin-answer-key" open={q.type === 'short' || q.type.startsWith('grid') ? true : undefined}><summary>正解・解説の詳細</summary>{q.type === 'short' && <><label>正解（1行に1つ）<textarea value={Array.isArray(q.answer) ? q.answer.join('\n') : String(q.answer ?? '')} onChange={(event) => changeQuestion(index, { answer: event.target.value.split('\n').filter(Boolean) })} /></label><label><input type="checkbox" checked={q.options.normalizeWidth !== false} onChange={(event) => changeQuestion(index, { options: { ...q.options, normalizeWidth: event.target.checked } })} />全角・半角を同じとする</label><label><input type="checkbox" checked={q.options.ignoreCase !== false} onChange={(event) => changeQuestion(index, { options: { ...q.options, ignoreCase: event.target.checked } })} />大文字・小文字を同じとする</label></>}{q.type.startsWith('grid') && (q.options.rows ?? []).map((row) => <label key={row}>{row} の正解{q.type === 'gridSingle' ? <select value={String((q.answer as Record<string, unknown> | null)?.[row] ?? '')} onChange={(event) => changeQuestion(index, { answer: { ...(q.answer && typeof q.answer === 'object' ? q.answer as object : {}), [row]: event.target.value } })}><option value="">選ぶ</option>{(q.options.columns ?? []).map((column) => <option key={column}>{column}</option>)}</select> : <div className="learning-options">{(q.options.columns ?? []).map((column) => <label key={column}><input type="checkbox" checked={Array.isArray((q.answer as Record<string, unknown> | null)?.[row]) && ((q.answer as Record<string, string[]>)[row]).includes(column)} onChange={(event) => { const current = q.answer && typeof q.answer === 'object' ? q.answer as Record<string, string[]> : {}; const values = current[row] ?? []; changeQuestion(index, { answer: { ...current, [row]: event.target.checked ? [...values, column] : values.filter((x) => x !== column) } }); }} />{column}</label>)}</div>}</label>)}<label>正解時のコメント<textarea value={q.feedbackCorrect} onChange={(event) => changeQuestion(index, { feedbackCorrect: event.target.value })} /></label><label>不正解時の解説<textarea value={q.feedbackWrong} onChange={(event) => changeQuestion(index, { feedbackWrong: event.target.value })} /></label></details><div className="admin-question-foot"><label><input type="checkbox" checked={q.required} onChange={(event) => changeQuestion(index, { required: event.target.checked })} />必須</label><label><input type="checkbox" checked={q.shuffleOptions} onChange={(event) => changeQuestion(index, { shuffleOptions: event.target.checked })} />選択肢をシャッフル</label></div>
              <button type="button" className="test-author-link test-editor-next" disabled={questions.length >= 100} onClick={() => addQuestion()}>＋ 次の問題を追加</button>
            </fieldset>)(question, questions.indexOf(question))}
          </div>
        </div>}

        {tab === 'responses' && <><h3>回答の集計</h3><p>提出 {summary?.count ?? 0} 件。回答本文は保存していません。</p>{summary && <><div className="learning-histogram">{summary.histogram.map((count, i) => <div key={i}><span>{i * 20}～{i === 4 ? 100 : i * 20 + 19}%</span><div><i style={{ width: `${summary.count ? count / summary.count * 100 : 0}%` }} /></div><strong>{count}件</strong></div>)}</div><button className="button button--ghost" onClick={() => downloadCsv(`${test.title}-結果.csv`, [['クラス', '番号', '氏名', 'メール', '回数', '得点', '満点', '獲得G', '受験日時'], ...summary.responses.map((r) => [r.className, r.number, r.name, r.email, r.attemptNo, r.score, r.maxScore, r.gAwarded, r.submittedAt])])}>結果をCSV保存</button><div className="learning-table-wrap"><table><thead><tr><th>クラス</th><th>番号</th><th>氏名</th><th>回</th><th>得点</th><th>獲得G</th></tr></thead><tbody>{summary.responses.map((r) => <tr key={r.responseId}><td>{r.className}</td><td>{r.number}</td><td>{r.name}</td><td>{r.attemptNo}</td><td>{r.score}/{r.maxScore}</td><td>{r.gAwarded}</td></tr>)}</tbody></table></div></>}</>}
        {tab === 'settings' && <div className="admin-tests-settings"><label>公開開始<input type="datetime-local" value={test.settings.startAt ? test.settings.startAt.slice(0, 16) : ''} onChange={(event) => changeSettings({ startAt: event.target.value })} /></label><label>公開終了<input type="datetime-local" value={test.settings.endAt ? test.settings.endAt.slice(0, 16) : ''} onChange={(event) => changeSettings({ endAt: event.target.value })} /></label><label>対象クラス（空欄なら全クラス、複数はカンマ区切り）<input key={test.testId} defaultValue={test.settings.targetClasses.join(', ')} onChange={(event) => changeSettings({ targetClasses: event.target.value.split(/[,、]/).map((x) => x.trim()).filter(Boolean) })} /></label><label>受験できる回数（0なら何回でも）<input type="number" min={0} max={100} value={test.settings.attemptLimit} onChange={(event) => changeSettings({ attemptLimit: Number(event.target.value) })} /></label><label>結果の公開<select value={test.settings.resultRelease} onChange={(event) => changeSettings({ resultRelease: event.target.value as Settings['resultRelease'] })}><option value="immediate">送信後すぐ</option><option value="teacher">先生が公開したら</option></select></label>{test.settings.resultRelease === 'teacher' && <label><input type="checkbox" checked={test.settings.resultsPublished} onChange={(event) => changeSettings({ resultsPublished: event.target.checked })} />結果を公開する</label>}<label>生徒に見せる内容<select value={test.settings.resultDetail} onChange={(event) => changeSettings({ resultDetail: event.target.value as Settings['resultDetail'] })}><option value="score">得点のみ</option><option value="correctness">得点と問題別の正誤（送信直後のみ）</option><option value="full">得点・正解・解説（送信直後のみ）</option></select></label><label>Gポイント倍率<input type="number" min={0} max={10} step={0.1} value={test.settings.pointMultiplier} onChange={(event) => changeSettings({ pointMultiplier: Number(event.target.value) })} /></label><label><input type="checkbox" checked={test.settings.shuffleQuestions} onChange={(event) => changeSettings({ shuffleQuestions: event.target.checked })} />問題の順番をシャッフル</label></div>}
      {tab === 'settings' && test.published && <button type="button" className="button button--ghost" disabled={busy || saving} onClick={() => {
        if (window.confirm('このテストの公開を停止しますか？')) void save(true, false);
      }}>公開を停止する</button>}
      <footer className="test-author-actions test-author-footer">
        <button type="button" className="test-author-link" disabled={busy || saving} onClick={() => duplicate(test, questions)}>テストを複製</button>
        <button type="button" className="test-author-link" disabled={busy || saving || locked} onClick={() => { void remove(); }}>テストを削除</button>
      </footer>
      {test.published && !dirty && <label>生徒向けのテストリンク<input readOnly value={`${window.location.origin}${window.location.pathname}#/tests?testId=${encodeURIComponent(test.testId)}`} onFocus={(event) => event.currentTarget.select()} /></label>}
      {(dialog === 'import' || dialog === 'excel') && activeSection && <TestImportDialog initialMode={dialog === 'excel' ? 'excel' : 'paste'} sectionId={activeSection.sectionId} capacity={100 - questions.length} onClose={() => setDialog(null)} onImport={(entries) => {
        setQuestions([...questions, ...entries]); markDirty(); setDialog(null); selectQuestion(entries[0], true); setMessage(`${entries.length}問を追加しました。`);
      }} />}
      {dialog === 'preview' && previewPaper && <TestPreviewDialog session={session} paper={previewPaper} questions={orderedQuestions} onClose={() => setDialog(null)} />}
      {dialog === 'publish' && <TestAuthorDialog title="公開前の確認" onClose={() => setDialog(null)}>
        <h3>{test.title || '無題のテスト'}</h3>
        <dl className="test-publication-summary">
          <div><dt>問題数・満点</dt><dd>{questions.length}問 · {maxScore}点</dd></div>
          <div><dt>対象</dt><dd>{test.settings.targetClasses.join('、') || '全クラス'}</dd></div>
          <div><dt>公開開始</dt><dd>{test.settings.startAt.replace('T', ' ') || '保存後すぐ'}</dd></div>
          <div><dt>公開終了</dt><dd>{test.settings.endAt.replace('T', ' ') || '期限なし'}</dd></div>
        </dl>
        {publicationIssue && <p className="test-author-warning" role="alert">{publicationIssue}</p>}
        <div className="test-author-actions">
          {publicationIssue && firstIssue && <button type="button" className="button button--ghost" onClick={() => { setDialog(null); setTab('questions'); selectQuestion(firstIssue); }}>問題を確認</button>}
          <button type="button" className="button button--primary" disabled={Boolean(publicationIssue) || busy || saving} onClick={() => { setDialog(null); void save(true, true); }}>この設定で公開する</button>
        </div>
      </TestAuthorDialog>}
    </>}

    {message && <p role="status" className="economy-message">{message}</p>}
  </section>;
}
