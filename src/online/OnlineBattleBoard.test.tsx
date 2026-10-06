import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnlineBattleBoard } from './OnlineBattleBoard';
import type { OnlineEntry, OnlineView } from './protocol';

const entries: OnlineEntry[] = ['G001', 'G002', 'C008', 'P001'].map((cardId) => ({ cardId, trainLevel: 0 }));
const view: OnlineView = {
  phase: 'select', round: 1, life: [100, 100], maxLife: [100, 100],
  types: [['rock', 'rock', 'scissors', 'paper'], ['rock', 'scissors', 'paper', 'rock']],
  ssr: [[false, false, false, false], [false, false, false, false]],
  used: [[], []], events: [], outcome: null,
};

describe('オンライン対戦画面', () => {
  it('オフラインと同じ配置で相手の裏面4枚と自分の選択カードを表示する', () => {
    const html = renderToStaticMarkup(<OnlineBattleBoard view={view} side={0} entries={entries} opponentName="相手" busy={false} waiting={false} onPick={() => {}} />);
    expect(html).toContain('class="selection-board panel"');
    expect(html).toContain('class="back-row"');
    expect((html.match(/card--back/g) ?? [])).toHaveLength(4);
    expect((html.match(/class="select-card"/g) ?? [])).toHaveLength(4);
    expect(html.indexOf('class="back-row"')).toBeLessThan(html.indexOf('class="select-grid"'));
  });

  it('残り1枚でも裏面を表示し、自分の最後のカードを出せる', () => {
    const finalView: OnlineView = { ...view, round: 4, used: [[0, 1, 2], [0, 1, 2]] };
    const html = renderToStaticMarkup(<OnlineBattleBoard view={finalView} side={0} entries={entries} opponentName="相手" busy={false} waiting={false} onPick={() => {}} />);
    expect((html.match(/card--back/g) ?? [])).toHaveLength(1);
    expect(html).toContain('最後の1枚');
    expect(html).toContain('オープン！');
  });
});
