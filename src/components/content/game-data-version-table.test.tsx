import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameDataVersionTable } from './game-data-version-table';

describe('GameDataVersionTable', () => {
  it('集中顯示資料目錄中的所有 dataset 版本與來源', () => {
    const markup = renderToStaticMarkup(<GameDataVersionTable locale="zh-tw" />);
    const markupWithoutWrapOpportunities = markup.replaceAll('<wbr/>', '');

    expect(markup).toContain('目前 Game Data 版本');
    expect(markupWithoutWrapOpportunities).toContain('search-rewards');
    expect(markupWithoutWrapOpportunities).toContain('progression');
    expect(markupWithoutWrapOpportunities).toContain('economy');
    expect(markupWithoutWrapOpportunities).toContain('effects');
    expect(markupWithoutWrapOpportunities).toContain('black-market');
    expect(markupWithoutWrapOpportunities).toContain('dungeon');
    expect(markup).toContain('cco-found-initial-snapshot');
    expect(markup).toContain('CCO Found');
    expect(markup).toContain(
      'href="https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4"',
    );
  });

  it('提供英文表頭', () => {
    const markup = renderToStaticMarkup(<GameDataVersionTable locale="en" />);

    expect(markup).toContain('Current Game Data versions');
    expect(markup).toContain('<th scope="col"');
    expect(markup).toContain('Data version');
    expect(markup).toContain('Updated');
  });

  it('提供簡中表頭與資料集內容', () => {
    const markup = renderToStaticMarkup(<GameDataVersionTable locale="zh-cn" />);

    expect(markup).toContain('当前 Game Data 版本');
    expect(markup).toContain('数据集');
    expect(markup).toContain('数据来源');
  });

  it('設定各欄寬，並只在資料集 ID 的連字號處提供換行點', () => {
    const markup = renderToStaticMarkup(<GameDataVersionTable locale="en" />);
    const widths = Array.from(
      markup.matchAll(/<col style="width:([^\"]+)"/g),
      ([, width]) => width,
    );

    expect(markup).toContain('data-game-data-version-table=""');
    expect(widths).toEqual(['150px', '132px', '136px', '224px', '120px', '194px']);
    expect(
      widths.reduce((total, width) => total + Number.parseInt(width ?? '0', 10), 0),
    ).toBe(956);
    expect(markup).toContain('backpack-<wbr/>progression');
    expect(markup).toContain('search-<wbr/>rewards');
    expect(markup).not.toContain('progre<wbr/>ssion');
    expect(markup).not.toContain('reward<wbr/>s');
  });
});
