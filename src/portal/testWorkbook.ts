import { read, utils, type CellObject, type WorkBook } from 'xlsx';
import type { ImportRow } from './testAuthoring';

export const questionWorkbookName = 'g-card-test-template.xlsx';
const headers = ['問題文', '選択肢', '正解', '配点'];
export const maxWorkbookBytes = 5 * 1024 * 1024;

function textValue(cell: CellObject | undefined, address: string): string {
  if (!cell) return '';
  if (cell.f || cell.t === 'd' || cell.t === 'e') throw new Error(`${address} の値を文字または数字で入力してください。数式・日付は使用できません。`);
  const value = cell.v;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).replace(/\r\n?/g, '\n');
  throw new Error(`${address} の値を文字または数字で入力してください。数式・日付は使用できません。`);
}

export async function parseQuestionWorkbook(buffer: ArrayBuffer, capacity: number): Promise<ImportRow[]> {
  if (!buffer.byteLength || buffer.byteLength > maxWorkbookBytes) throw new Error('5MB以内のExcelファイルを選択してください。');
  if (capacity <= 0) throw new Error('追加できる問題がありません。1つのテストは100問までです。');
  const signature = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error('.xlsx形式のExcelファイルを選択してください。');
  let workbook: WorkBook;
  try { workbook = read(buffer, { type: 'array', cellDates: true, cellFormula: true, sheets: '問題入力' }); }
  catch { throw new Error('Excelファイルを読み込めませんでした。.xlsx形式で保存し直してください。'); }
  const sheet = workbook.Sheets['問題入力'];
  if (!sheet) throw new Error('「問題入力」シートが見つかりません。テンプレートをダウンロードして入力してください。');
  let headerRow = 0;
  for (let row = 0; row < 20; row++) {
    if (headers.every((label, col) => String(sheet[utils.encode_cell({ r: row, c: col })]?.v ?? '').trim() === label)) {
      headerRow = row + 1;
      break;
    }
  }
  if (!headerRow) throw new Error('見出しの「問題文・選択肢・正解・配点」を確認してください。');
  const imported: ImportRow[] = [];
  const populatedRows = new Set<number>();
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const cell = sheet[address] as CellObject;
    if (!cell.f && (cell.v == null || cell.v === '')) continue;
    const position = utils.decode_cell(address);
    if (position.r < headerRow) continue;
    if (position.c > 3) throw new Error(`${position.r + 1}行目のE列以降に入力があります。A〜D列に入力してください。`);
    populatedRows.add(position.r);
  }
  for (const row of [...populatedRows].sort((a, b) => a - b)) {
    const values = headers.map((_, col) => {
      const address = utils.encode_cell({ r: row, c: col });
      return textValue(sheet[address], address);
    });
    if (!values.some((value) => value.trim())) continue;
    if (imported.length >= capacity) throw new Error(`ファイルの問題数が追加できる残り${capacity}問を超えています。`);
    if (values.some((value) => value.length > 10000)) throw new Error(`${row + 1}行目の入力が長すぎます。`);
    imported.push({ text: values[0], choices: values[1], key: values[2], points: values[3], sourceRow: row + 1 });
  }
  if (!imported.length) throw new Error('「問題入力」シートに問題がありません。見出しの下に入力して保存してください。');
  return imported;
}
