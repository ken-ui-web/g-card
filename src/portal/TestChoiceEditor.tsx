import { useState } from 'react';
import type { Question } from './testAuthoring';

export function TestChoiceEditor({ question, onChange }: { question: Question; onChange: (update: Partial<Question>) => void }) {
  const [batch, setBatch] = useState<string | null>(null);
  const choices = question.options.choices ?? [];
  const multiple = question.type === 'multi';
  const selected = multiple && Array.isArray(question.answer) ? question.answer as string[] : [];
  function replaceChoices(next: string[], renamed?: [string, string]) {
    const preserve = (value: unknown) => renamed && value === renamed[0] ? renamed[1] : value;
    const answer = preserve(question.answer);
    onChange({
      options: { ...question.options, choices: next },
      answer: multiple ? selected.map((value) => preserve(value) as string).filter((value) => value && next.includes(value))
        : typeof answer === 'string' && answer && next.includes(answer) ? answer : null,
    });
  }
  const lines = batch?.split('\n').map((value) => value.trim()).filter(Boolean) ?? [];
  const canApply = lines.length >= 2 && lines.length <= 20 && new Set(lines).size === lines.length && lines.every((line) => line.length <= 200);
  return <fieldset className="test-choice-editor">
    <legend>選択肢と正解</legend>
    <p>{multiple ? '正解にする選択肢をすべて選んでください。' : '正解にする選択肢を1つ選んでください。'}{question.points === 0 && ' この問題は0点です。'}</p>
    {choices.map((choice, index) => {
      const correct = Boolean(choice) && (multiple ? selected.includes(choice) : question.answer === choice);
      return <div className={`test-choice-row${correct ? ' is-correct' : ''}`} key={index}>
        <input type={multiple ? 'checkbox' : 'radio'} name={`correct-${question.questionId}`} aria-label={`選択肢${index + 1}を正解にする`}
          disabled={!choice.trim()} checked={correct} onChange={(event) => onChange({ answer: multiple
            ? event.target.checked ? [...selected, choice] : selected.filter((value) => value !== choice)
            : choice })} />
        <input aria-label={`選択肢${index + 1}`} value={choice} maxLength={200} placeholder={`選択肢 ${index + 1}`} onChange={(event) => {
          const next = choices.map((value, i) => i === index ? event.target.value : value);
          replaceChoices(next, [choice, event.target.value]);
        }} onPaste={(event) => {
          const pasted = event.clipboardData.getData('text');
          if (!/[\r\n]/.test(pasted.trim())) return;
          event.preventDefault();
          setBatch(pasted.replace(/\r\n?/g, '\n'));
        }} />
        <button type="button" className="test-author-link" aria-label={`選択肢${index + 1}を削除`} disabled={choices.length <= 2}
          onClick={() => replaceChoices(choices.filter((_, i) => i !== index))}>削除</button>
      </div>;
    })}
    <div className="test-author-actions">
      <button type="button" className="test-author-link" disabled={choices.length >= 20} onClick={() => replaceChoices([...choices, ''])}>＋ 選択肢</button>
      {batch === null && <button type="button" className="test-author-link" onClick={() => setBatch('')}>まとめ貼り</button>}
    </div>
    {batch !== null && <div className="test-choice-batch">
      <label>選択肢を1行ずつ貼り付け<textarea autoFocus rows={4} value={batch} onChange={(event) => setBatch(event.target.value)} /></label>
      <small>異なる選択肢を2〜20個入力すると、今の選択肢を置き換えられます。</small>
      <div className="test-author-actions">
        <button type="button" className="test-author-link" onClick={() => setBatch(null)}>キャンセル</button>
        <button type="button" className="button button--primary" disabled={!canApply} onClick={() => { replaceChoices(lines); setBatch(null); }}>反映する</button>
      </div>
    </div>}
  </fieldset>;
}
