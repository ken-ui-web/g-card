import type { Question as PaperQuestion } from './TestPaper';

export type Question = PaperQuestion & {
  options: PaperQuestion['options'] & { normalizeWidth?: boolean; ignoreCase?: boolean };
  answer: unknown;
  shuffleOptions: boolean;
  feedbackCorrect: string;
  feedbackWrong: string;
};

export const isChoice = (type: string) => ['single', 'multi', 'dropdown'].includes(type);
const uniqueNonempty = (values: string[]) => values.every((value) => value.trim()) && new Set(values.map((value) => value.trim())).size === values.length;
const hasSelection = (value: unknown, choices: string[], multi: boolean) => multi
  ? Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every((entry) => choices.includes(entry))
  : typeof value === 'string' && choices.includes(value);

export function questionIssue(q: Question, forPublication = true): string {
  if (forPublication && !q.text.trim()) return '問題文を入力してください';
  if (!Number.isInteger(q.points) || q.points < 0 || q.points > 100) return '配点は0〜100の整数にしてください';
  if (isChoice(q.type)) {
    const choices = q.options.choices ?? [];
    if (choices.length < 2 || choices.length > 20 || !uniqueNonempty(choices) || choices.some((choice) => choice.length > 200)) {
      return '異なる選択肢を2〜20個入力してください（各200文字以内）';
    }
    if (forPublication && q.points > 0 && !hasSelection(q.answer, choices, q.type === 'multi')) return '正解を選んでください';
  }
  if (forPublication && q.type === 'short' && q.points > 0) {
    const keys = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (!keys.some((value) => typeof value === 'string' && value.trim())) return '正解を入力してください';
  }
  if (q.type.startsWith('grid')) {
    const { rows = [], columns = [] } = q.options;
    if (!rows.length || columns.length < 2 || !uniqueNonempty(rows) || !uniqueNonempty(columns)) return '重複のない行と列を入力してください（列は2つ以上）';
    const key = q.answer as Record<string, unknown> | null;
    if (forPublication && q.points > 0 && !rows.every((row) => hasSelection(key?.[row], columns, q.type === 'gridMulti'))) return 'すべての行の正解を選んでください';
  }
  if (q.type === 'scale') {
    const { min = 1, max = 5 } = q.options;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max || max - min > 10) return '目盛は整数で、最小と最大の差を1〜10にしてください';
  }
  if (q.imageUrl?.trim() && (!/^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com)\//i.test(q.imageUrl.trim()) || q.imageUrl.trim().length > 2000)) return '学校で共有したGoogleドライブの画像URLを入力してください';
  return '';
}

export type ImportRow = { text: string; choices: string; key: string; points: string; extra?: boolean; sourceRow?: number };

// Excel とスプレッドシートが複数行セルを引用符で囲む形式にも対応する。
export function readQuestionTable(input: string): ImportRow[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"' && (quoted || !cell)) quoted = !quoted;
    else if (!quoted && (char === '\t' || char === '\n')) {
      row.push(cell); cell = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) throw new Error('閉じていない引用符があります。表の範囲をコピーし直してください。');
  rows.push([...row, cell]);
  return rows.filter((cells, index) => cells.some((value) => value.trim()) && !(index === 0 && cells[0].trim() === '問題文' && cells[1]?.trim() === '選択肢'))
    .map(([text, choices = '', key = '', points = '', ...extra]) => ({ text, choices, key, points, extra: extra.some((value) => value.trim()) }));
}

export function convertImportRow(row: ImportRow, sectionId: string): Omit<Question, 'questionId'> {
  if (row.extra) throw new Error('5列目以降に入力があります。4列にそろえてください');
  const choices = row.choices.split(/[|\n]/).map((value) => value.trim()).filter(Boolean);
  const keys = row.key.split(choices.length ? /[,、|\n]/ : /[|\n]/).map((value) => value.trim()).filter(Boolean);
  const selected = choices.length ? keys.map((value) => /^\d+$/.test(value) ? choices[Number(value) - 1] : undefined) : keys;
  if (selected.includes(undefined)) throw new Error('正解は選択肢の番号で入力してください');
  const type = choices.length ? keys.length > 1 ? 'multi' : 'single' : 'short';
  const question = {
    text: row.text.trim(), type, sectionId, options: choices.length ? { choices } : {},
    answer: type === 'single' ? selected[0] ?? null : selected, points: row.points.trim() ? Number(row.points) : 1,
    required: true, shuffleOptions: false, feedbackCorrect: '', feedbackWrong: '', imageUrl: '',
  };
  const issue = questionIssue(question as Question);
  if (issue) throw new Error(issue);
  if (question.text.length > 2000) throw new Error('問題文は2000文字以内にしてください');
  return question;
}
