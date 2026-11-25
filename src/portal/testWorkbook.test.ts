import { readFileSync } from 'node:fs';
import { read, write, utils, type WorkBook } from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseQuestionWorkbook } from './testWorkbook';
import { convertImportRow } from './testAuthoring';

const template = readFileSync('public/templates/g-card-test-template.xlsx');
function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
async function editedTemplate(edit: (workbook: WorkBook) => void): Promise<ArrayBuffer> {
  const workbook = read(template, { type: 'buffer', cellDates: true });
  edit(workbook);
  return write(workbook, { type: 'array', bookType: 'xlsx', cellDates: true });
}

describe('Excelテンプレートの取り込み', () => {
  it('配布テンプレートの記入例と空行を取り込まない', async () => {
    await expect(parseQuestionWorkbook(arrayBuffer(template), 100)).rejects.toThrow('問題がありません');
  });

  it('入力用シートの単一選択・複数選択・短文を読み込み、Excelの行番号を保持する', async () => {
    const file = await editedTemplate((book) => {
      const sheet = book.Sheets['問題入力'];
      utils.sheet_add_aoa(sheet, [['都道府県の数は？', '45|46|47|48', 3, 2]], { origin: 'A7' });
      utils.sheet_add_aoa(sheet, [['入力装置を選ぶ', 'キーボード\nマウス\nディスプレイ', '1,2', 0]], { origin: 'A9' });
      utils.sheet_add_aoa(sheet, [['CPUの略称は？', '', 'CPU|cpu', '']], { origin: 'A10' });
    });
    const rows = await parseQuestionWorkbook(file, 3);
    expect(rows.map((row) => row.sourceRow)).toEqual([7, 9, 10]);
    expect(rows.map((row) => convertImportRow(row, 'section'))).toMatchObject([
      { type: 'single', answer: '47', points: 2 },
      { type: 'multi', answer: ['キーボード', 'マウス'], points: 0 },
      { type: 'short', answer: ['CPU', 'cpu'], points: 1 },
    ]);
    await expect(parseQuestionWorkbook(file, 2)).rejects.toThrow('残り2問');
  });

  it('誤って数式や日付になった値、列のはみ出しを場所付きで知らせる', async () => {
    for (const [value, expected] of [
      [{ t: 'n', f: '1+1', v: 2 }, 'C7'],
      [{ t: 'd', v: new Date('2026-11-25') }, 'C7'],
    ] as const) {
      const file = await editedTemplate((book) => {
        const sheet = book.Sheets['問題入力'];
        utils.sheet_add_aoa(sheet, [['問題', 'A|B', '', 1]], { origin: 'A7' });
        sheet.C7 = value;
      });
      await expect(parseQuestionWorkbook(file, 100)).rejects.toThrow(expected);
    }
    const file = await editedTemplate((book) => {
      utils.sheet_add_aoa(book.Sheets['問題入力'], [['問題', 'A|B', '1', 1, '余分な入力']], { origin: 'A7' });
    });
    await expect(parseQuestionWorkbook(file, 100)).rejects.toThrow('7行目のE列');
  });
});
