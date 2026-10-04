import { describe, expect, it } from 'vitest';

import {
  assertContentDataReferenceConsistency,
  getContentDataReferenceIssues,
} from './content-data-consistency';

const validPage = {
  locale: 'zh-tw',
  slugs: ['blog', 'data-analysis'],
  data: { dataReferences: ['search-rewards'] },
};

describe('Content Game Data references', () => {
  it('接受已發布 dataset ID，並允許沒有資料依賴的內容', () => {
    expect(getContentDataReferenceIssues([validPage, {
      locale: 'zh-tw',
      slugs: ['guides', 'intro'],
      data: { dataReferences: [] },
    }])).toEqual([]);
    expect(() => assertContentDataReferenceConsistency([validPage])).not.toThrow();
  });

  it('定位不存在的 dataset ID', () => {
    const issues = getContentDataReferenceIssues([{
      ...validPage,
      data: { dataReferences: ['missing-data'] },
    }]);

    expect(issues).toEqual([
      '內容 [zh-tw] blog/data-analysis 引用了不存在的 Game Data dataset：missing-data',
    ]);
    expect(() => assertContentDataReferenceConsistency([{
      ...validPage,
      data: { dataReferences: ['missing-data'] },
    }])).toThrow('內容 Game Data 引用檢查失敗');
  });

  it('拒絕 registry prototype 上的非 own dataset ID', () => {
    const issues = getContentDataReferenceIssues([{
      ...validPage,
      data: { dataReferences: ['constructor'] },
    }]);

    expect(issues).toEqual([
      '內容 [zh-tw] blog/data-analysis 引用了不存在的 Game Data dataset：constructor',
    ]);
  });

});
