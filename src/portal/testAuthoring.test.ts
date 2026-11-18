import { describe, expect, it } from 'vitest';
import { convertImportRow, readQuestionTable } from './testAuthoring';

describe('テストの一括取り込み', () => {
  it('表計算の複数行セルを保ち、複数選択と短文を取り込む', () => {
    const rows = readQuestionTable('問題文\t選択肢\t正解\t配点\r\n"読みなさい。\r\n「""例""」"\t"A\r\nB\r\nC"\t1,3\t2\r\n名称は？\t\t別名|正式名\t');
    expect(convertImportRow(rows[0], 'section')).toMatchObject({ text: '読みなさい。\n「"例"」', type: 'multi', answer: ['A', 'C'], points: 2 });
    expect(convertImportRow(rows[1], 'section')).toMatchObject({ type: 'short', answer: ['別名', '正式名'], points: 1 });
  });

  it('正解が抜けた行と、存在しない選択肢を指定した行を修正できる', () => {
    const [row] = readQuestionTable('問題文\tA|B\t\t2');
    expect(() => convertImportRow(row, 'section')).toThrow('正解を選んでください');
    expect(() => convertImportRow({ ...row, key: '3' }, 'section')).toThrow('選択肢の番号');
    expect(convertImportRow({ ...row, key: '2' }, 'section').answer).toBe('B');
  });
});
