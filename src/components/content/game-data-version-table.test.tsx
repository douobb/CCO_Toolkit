import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameDataVersionTable } from './game-data-version-table';

describe('GameDataVersionTable', () => {
  it('集中顯示資料目錄中的所有 dataset 版本與來源', () => {
    const markup = renderToStaticMarkup(<GameDataVersionTable locale="zh-tw" />);

    expect(markup).toContain('目前 Game Data 版本');
    expect(markup).toContain('search-rewards');
    expect(markup).toContain('progression');
    expect(markup).toContain('economy');
    expect(markup).toContain('effects');
    expect(markup).toContain('black-market');
    expect(markup).toContain('dungeon');
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
});
