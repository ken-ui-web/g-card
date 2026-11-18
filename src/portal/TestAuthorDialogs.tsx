import { useEffect, useRef, useState, type ReactNode } from 'react';
import { callApi } from './api';
import { TestPaper, type Paper } from './TestPaper';
import { convertImportRow, readQuestionTable, type ImportRow, type Question } from './testAuthoring';

export function TestAuthorDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="test-author-dialog panel" aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><h2>{title}</h2><button className="test-author-link" type="button" onClick={onClose}>閉じる</button></header>
    {children}
  </dialog>;
}

const example = '問題文\t選択肢\t正解\t配点\n都道府県の数は？\t45|46|47|48\t3\t1';
const importColumns = [['text', '問題文'], ['choices', '選択肢'], ['key', '正解'], ['points', '配点']] as const;

export function TestImportDialog({ sectionId, capacity, onImport, onClose }: {
  sectionId: string; capacity: number; onImport: (questions: Question[]) => void; onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState('');
  const entries = rows?.map((row) => {
    try { return { question: convertImportRow(row, sectionId), issue: '' }; }
    catch (failure) { return { question: null, issue: (failure as Error).message }; }
  }) ?? [];
  const invalidCount = entries.filter((entry) => entry.issue).length;
  const inspect = () => {
    try {
      const parsed = readQuestionTable(input);
      if (!parsed.length || parsed.length > capacity) throw new Error(`追加できる問題は1〜${capacity}問です。`);
      setRows(parsed); setError('');
    } catch (failure) { setError((failure as Error).message); }
  };
  return <TestAuthorDialog title="問題を一括で貼り付け" onClose={onClose}>
    {rows === null ? <>
      <p>表の4列をコピーして貼り付けてください。左から「問題文・選択肢・正解・配点」です。</p>
      <p>選択肢は「|」で区切り、正解には左から数えた番号を入れます。複数正解は「1,3」のように入力します。選択肢を空欄にすると短文問題になります。配点の空欄は1点です。</p>
      <label>貼り付ける表<textarea autoFocus rows={7} maxLength={250000} value={input} onChange={(event) => setInput(event.target.value)} /></label>
      <div className="test-author-actions">
        <button className="button button--ghost" type="button" onClick={() => { setInput(example); setError(''); }}>入力例を入れる</button>
        <button className="button button--primary" type="button" onClick={inspect} disabled={!input.trim()}>取り込み内容を確認</button>
      </div>
    </> : <>
      <p role="status">{rows.length}問を検出しました。{invalidCount ? `修正が必要な問題が${invalidCount}問あります。` : 'このまま追加できます。'}</p>
      <ol className="test-import-rows">{rows.map((row, index) => <li key={index}>
        <strong>{index + 1}問目</strong>
        <div>{importColumns.map(([key, label]) => <label key={key}>{label}
          <textarea rows={key === 'text' ? 2 : 1} value={row[key]} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} />
        </label>)}</div>
        {entries[index].issue && <small className="test-author-warning">{entries[index].issue}</small>}
        {row.extra && <button type="button" className="test-author-link" onClick={() => setRows(rows.map((item, i) => i === index ? { ...item, extra: false } : item))}>余分な列を取り込まない</button>}
      </li>)}</ol>
      <div className="test-author-actions">
        <button className="button button--ghost" type="button" onClick={() => setRows(null)}>貼り付けに戻る</button>
        <button className="button button--primary" type="button" disabled={invalidCount > 0} onClick={() => onImport(entries.flatMap(({ question }) => question ? [{ ...question, questionId: crypto.randomUUID() }] : []))}>{rows.length}問を追加</button>
      </div>
    </>}
    {error && <p role="alert" className="test-author-warning">{error}</p>}
  </TestAuthorDialog>;
}

type Grade = { score: number; maxScore: number; details: { questionId: string; text: string; earned: number; points: number; answer: unknown; feedback: string }[] };

export function TestPreviewDialog({ session, paper, questions, onClose }: { session: string; paper: Paper; questions: Question[]; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [section, setSection] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(false);
  const gradeAnswers = async () => {
    if (request.current) return;
    request.current = true; setBusy(true); setError('');
    try { setGrade(await callApi<Grade>('adminPreviewTest', session, { questions, answers })); }
    catch (failure) {
      const issue = failure as Error & { code?: string };
      setError(issue.code === 'NOT_IMPLEMENTED' ? '試し採点は Apps Script の更新後に使えます。' : issue.message);
    } finally { request.current = false; setBusy(false); }
  };
  return <TestAuthorDialog title="生徒画面のプレビュー" onClose={onClose}>
    <p className="test-author-preview-note">先生用の試し受験です。成績やGは記録されません。</p>
    {grade ? <div aria-live="polite"><h3>試し採点の結果</h3><p className="learning-score">{grade.score} / {grade.maxScore} 点</p>
      {grade.details.map((item) => <article className="learning-result-question" key={item.questionId}>
        <strong>{item.text}</strong><p>{item.earned} / {item.points} 点</p>
        {item.points > 0 && item.answer != null && <p>正解　{typeof item.answer === 'object' && !Array.isArray(item.answer) ? Object.entries(item.answer).map(([row, value]) => `${row}：${value}`).join(' ／ ') : Array.isArray(item.answer) ? item.answer.join('、') : String(item.answer)}</p>}
        {item.feedback && <p>{item.feedback}</p>}
      </article>)}
      <button type="button" className="button button--ghost" onClick={() => { setGrade(null); setAnswers({}); setSection(0); }}>最初から試す</button>
    </div> : <TestPaper {...{ paper, answers, setAnswers, section, setSection, busy }} onSubmit={() => { void gradeAnswers(); }} submitLabel="試し採点する" />}
    {error && <p role="alert" className="test-author-warning">{error}</p>}
  </TestAuthorDialog>;
}
