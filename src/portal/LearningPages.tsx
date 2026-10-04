import { useEffect, useRef, useState } from 'react';
import { callApi } from './api';
import { LoadingState } from '../components/LoadingState';

type TestListItem = { testId: string; title: string; description: string; endAt: string; attempts: number; attemptLimit: number; bestScore: number | null; available: boolean; lastResponseId: string };
type Question = { questionId: string; sectionId: string; type: string; text: string; imageUrl?: string; options: { choices?: string[]; rows?: string[]; columns?: string[]; min?: number; max?: number }; points: number; required: boolean };
type Paper = { testId: string; title: string; description: string; sections: { sectionId: string; title: string; description: string }[]; questions: Question[]; attemptNo: number };
type Result = { responseId: string; title: string; released: boolean; score?: number; maxScore?: number; gAwarded: number; gPoint: number; details?: { questionId: string; text: string; earned: number; points: number; answer?: unknown; feedback?: string }[]; completedMissions?: { label: string; reward: number }[] };
type ReflectionList = { appUrl: string; reward: number; lessons: { lessonId: string; title: string; submitted: boolean; rewarded: boolean }[] };

function answerPresent(question: Question, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (question.type.startsWith('grid')) return (question.options.rows ?? []).every((row) => answerPresent({ ...question, type: question.type === 'gridSingle' ? 'single' : 'multi' }, (value as Record<string, unknown>)[row]));
  return true;
}
function displayImageUrl(url: string) { const match = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/); return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1280` : url; }
function OptionInput({ question, answer, onChange }: { question: Question; answer: unknown; onChange: (value: unknown) => void }) {
  const choices = question.options.choices ?? [];
  if (question.type === 'single' || question.type === 'multi') return <div className="learning-options">{choices.map((choice) => <label key={choice}><input type={question.type === 'single' ? 'radio' : 'checkbox'} name={question.questionId} checked={question.type === 'single' ? answer === choice : Array.isArray(answer) && answer.includes(choice)} onChange={(event) => { if (question.type === 'single') onChange(choice); else { const selected = Array.isArray(answer) ? answer as string[] : []; onChange(event.target.checked ? [...selected, choice] : selected.filter((item) => item !== choice)); } }} />{choice}</label>)}</div>;
  if (question.type === 'dropdown') return <select value={String(answer ?? '')} onChange={(event) => onChange(event.target.value)}><option value="">選んでください</option>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select>;
  if (question.type === 'short') return <input type="text" maxLength={500} value={String(answer ?? '')} onChange={(event) => onChange(event.target.value)} />;
  if (question.type === 'paragraph') return <textarea rows={5} maxLength={5000} value={String(answer ?? '')} onChange={(event) => onChange(event.target.value)} />;
  if (question.type === 'scale') return <div className="learning-options learning-options--inline">{Array.from({ length: Number(question.options.max ?? 5) - Number(question.options.min ?? 1) + 1 }, (_, i) => i + Number(question.options.min ?? 1)).map((value) => <label key={value}><input type="radio" name={question.questionId} checked={Number(answer) === value} onChange={() => onChange(value)} />{value}</label>)}</div>;
  if (question.type === 'gridSingle' || question.type === 'gridMulti') return <div className="learning-grid">{(question.options.rows ?? []).map((row) => <fieldset key={row}><legend>{row}</legend>{(question.options.columns ?? []).map((column) => { const values = (answer && typeof answer === 'object' ? answer as Record<string, unknown> : {}); const selected = values[row]; return <label key={column}><input type={question.type === 'gridSingle' ? 'radio' : 'checkbox'} name={`${question.questionId}-${row}`} checked={question.type === 'gridSingle' ? selected === column : Array.isArray(selected) && selected.includes(column)} onChange={(event) => onChange({ ...values, [row]: question.type === 'gridSingle' ? column : event.target.checked ? [...(Array.isArray(selected) ? selected : []), column] : (Array.isArray(selected) ? selected : []).filter((item) => item !== column) })} />{column}</label>; })}</fieldset>)}</div>;
  return <p>この問題形式は表示できません。</p>;
}

export function LearningPages({ page, session, onPoints }: { page: 'tests' | 'reflections'; session: string; onPoints: (gPoint: number, kind: 'test' | 'reflection') => void }) {
  const [tests, setTests] = useState<TestListItem[] | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [section, setSection] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [reflections, setReflections] = useState<ReflectionList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const submitId = useRef<string | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    const action = page === 'tests' ? 'listTests' : 'listReflections';
    callApi<TestListItem[] | ReflectionList>(action, session).then((data) => { if (!active) return; if (page === 'tests') setTests(data as TestListItem[]); else setReflections(data as ReflectionList); }).catch((failure: Error & { code?: string }) => { if (active) setError(failure.code === 'NOT_IMPLEMENTED' ? '先生によるサーバー更新後に使えます。' : failure.message); });
    return () => { active = false; };
  }, [page, session]);
  useEffect(() => {
    if (page !== 'tests') return;
    const testId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('testId');
    if (testId) void openTest(testId);
  }, [page, session]);
  useEffect(() => {
    if (!paper) return;
    try { localStorage.setItem(`g-card-draft-${paper.testId}`, JSON.stringify({ answers, section })); } catch { /* 端末が保存を拒否しても受験は続けられる。 */ }
  }, [answers, paper, section]);
  const openTest = async (testId: string) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await callApi<Paper>('getTest', session, { testId });
      let draft: { answers?: Record<string, unknown>; section?: number } = {};
      try { draft = JSON.parse(localStorage.getItem(`g-card-draft-${testId}`) || '{}'); } catch { /* 保存された下書きが読めなくても開始できる。 */ }
      setPaper(data); setAnswers(draft.answers ?? {}); setSection(Math.min(data.sections.length - 1, Math.max(0, draft.section ?? 0))); submitId.current = null;
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    const firstMissing = paper?.questions.find((question) => question.required && !answerPresent(question, answers[question.questionId]));
    if (firstMissing && paper) {
      setSection(Math.max(0, paper.sections.findIndex((item) => item.sectionId === firstMissing.sectionId)));
      setError('必須の問題に回答してください。');
      return;
    }
    if (!paper || sending.current || !window.confirm('この回答を送信しますか？ 送信後は修正できません。')) return;
    sending.current = true; setBusy(true); setError('');
    if (!submitId.current) submitId.current = crypto.randomUUID();
    try {
      const response = await callApi<Result>('submitTest', session, { testId: paper.testId, answers }, submitId.current);
      localStorage.removeItem(`g-card-draft-${paper.testId}`);
      setResult(response); setPaper(null); onPoints(response.gPoint, 'test');
      setTests(await callApi<TestListItem[]>('listTests', session));
    } catch (failure) { setError((failure as Error).message); }
    finally { sending.current = false; setBusy(false); }
  };
  const viewResult = async (responseId: string) => {
    setBusy(true); setError('');
    try { setResult(await callApi<Result>('getTestResult', session, { responseId })); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const outcome = await callApi<{ awarded: number; newSubmissions: number; gPoint: number; completedMissions?: { label: string; reward: number }[] }>('syncReflections', session);
      onPoints(outcome.gPoint, 'reflection');
      setNote(outcome.newSubmissions ? `${outcome.newSubmissions}件の新しい提出を確認し、${outcome.awarded}Gを受け取りました。` : '新しくポイントを受け取る提出はありません。提出直後は少し待ってから再確認してください。');
      setReflections(await callApi<ReflectionList>('listReflections', session));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const activeSection = paper?.sections[section];
  const currentQuestions = paper?.questions.filter((q) => q.sectionId === activeSection?.sectionId) ?? [];
  const missing = currentQuestions.filter((q) => q.required && !answerPresent(q, answers[q.questionId]));
  return <section className="learning-page panel"><p className="eyebrow">{page === 'tests' ? 'LEARNING TEST' : 'LESSON REFLECTION'}</p>
    {page === 'reflections' ? <>
      <h1>授業の振り返り</h1>
      <p>提出と修正は、これまで使っている「振り返りアプリ」で行います。Gカードに本文は保存しません。</p>
      {reflections?.appUrl ? <a className="button button--primary" href={reflections.appUrl} target="_blank" rel="noopener noreferrer">振り返りアプリを開く</a> : <LoadingState text="振り返りの情報を読み込み中" />}
      <p>初めて提出した授業ごとに{reflections ? `${reflections.reward}G` : '設定されたGポイント'}を受け取れます。修正では追加されません。戻ってきたら、下のボタンを押してください。</p>
      <button className="button button--ghost" disabled={busy || !reflections} onClick={() => { void sync(); }}>{busy ? '提出を確認中…' : '提出記録を確認してGを受け取る'}</button>
      {reflections && <div className="learning-list">{reflections.lessons.map((item) => <article key={item.lessonId}><strong>{item.title}</strong><span>{item.submitted ? item.rewarded ? '提出済み・G受取済み' : '提出済み' : '未提出'}</span></article>)}</div>}
    </>
      : result ? <><h1>{result.released ? 'テスト結果' : '回答を受け付けました'}</h1><p>{result.title}</p>{result.released ? <div className="learning-score">{result.score} / {result.maxScore} 点</div> : <p>先生が結果を公開すると、得点を見られます。</p>}<p className="learning-reward">今回獲得したGポイント：+{result.gAwarded}G</p>{result.completedMissions?.map((mission) => <p key={mission.label}>ミッション達成：{mission.label} +{mission.reward}G</p>)}{result.details?.map((detail) => <article className="learning-result-question" key={detail.questionId}><strong>{detail.text}</strong><p>{detail.earned} / {detail.points} 点</p>{detail.answer !== undefined && <p>正解：{Array.isArray(detail.answer) ? detail.answer.join('、') : typeof detail.answer === 'object' ? JSON.stringify(detail.answer) : String(detail.answer)}</p>}{detail.feedback && <p>{detail.feedback}</p>}</article>)}<button className="button button--ghost" onClick={() => setResult(null)}>テスト一覧へ</button></>
      : paper ? <><h1>{paper.title}</h1><p>{paper.description}</p><div className="learning-progress">{section + 1} / {paper.sections.length} ページ <div><span style={{ width: `${(section + 1) / paper.sections.length * 100}%` }} /></div></div><h2>{activeSection?.title || `ページ ${section + 1}`}</h2><p>{activeSection?.description}</p>{currentQuestions.map((q, i) => <article className="learning-question" key={q.questionId}><h3>{i + 1}. {q.text} {q.required && <small>必須</small>}</h3>{q.imageUrl && <img className="learning-question-image" src={displayImageUrl(q.imageUrl)} alt="問題の画像" />}<p>{q.points} 点</p><OptionInput question={q} answer={answers[q.questionId]} onChange={(value) => setAnswers((current) => ({ ...current, [q.questionId]: value }))} /></article>)}{missing.length > 0 && <p className="learning-hint">必須の問題に回答すると、次へ進めます。</p>}<div className="button-row"><button className="button button--ghost" disabled={section === 0 || busy} onClick={() => setSection(section - 1)}>戻る</button>{section < paper.sections.length - 1 ? <button className="button button--primary" disabled={missing.length > 0} onClick={() => setSection(section + 1)}>次へ</button> : <button className="button button--primary" disabled={missing.length > 0 || busy} onClick={() => { void submit(); }}>{busy ? '採点中…' : '回答を送信'}</button>}</div></>
      : <><h1>テストを受ける</h1><p>回答は採点時にだけ送信され、学校のシートには得点と獲得Gだけを記録します。</p>{!tests && !error && <LoadingState text="テストを読み込み中" />}<div className="learning-list">{tests?.map((item) => <article key={item.testId}><div><h2>{item.title}</h2><p>{item.description}</p><small>{item.endAt ? `期限：${new Date(item.endAt).toLocaleString('ja-JP')}` : '期限なし'} · {item.attempts ? `受験済み・ベスト${item.bestScore}点` : '未受験'}</small></div><div className="learning-actions"><button className="button button--primary" disabled={!item.available || busy} onClick={() => { void openTest(item.testId); }}>{item.available ? item.attempts ? 'もう一度受ける' : '受ける' : '受験できません'}</button>{item.lastResponseId && <button className="button button--ghost" disabled={busy} onClick={() => { void viewResult(item.lastResponseId); }}>結果を見る</button>}</div></article>)}</div>{tests?.length === 0 && <p>現在受けられるテストはありません。</p>}</>}
    {busy && <LoadingState text={page === 'tests' ? 'テストの情報を確認中' : '提出記録を確認中'} />}
    {note && <p role="status" className="economy-message">{note}</p>}{error && <p role="alert" className="portal-error">{error}</p>}<a className="button button--ghost" href="#/home">ホームへ戻る</a>
  </section>;
}
