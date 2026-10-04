import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameDataReference } from './game-data-reference';

describe('GameDataReference', () => {
  it('從資料目錄顯示版本、更新日期與可追溯來源', () => {
    const markup = renderToStaticMarkup(
      <GameDataReference datasetId="search-rewards" title="Search Reward 資料版本與來源" />,
    );

    expect(markup).toContain('data-game-data-reference="search-rewards"');
    expect(markup).toContain('data-game-data-version="cco-found-initial-snapshot"');
    expect(markup).toContain('data-game-data-updated-at="2026-08-27"');
    expect(markup).toContain('Search Reward 資料版本與來源');
    expect(markup).toContain('CCO Found');
    expect(markup).toContain(
      'href="https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4"',
    );
    expect(markup).toContain('rel="noopener noreferrer"');
  });
});
