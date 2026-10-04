import { describe, expect, it } from 'vitest';

import {
  blogFrontmatterSchema,
  contentStatusSchema,
  guideFrontmatterSchema,
  toolFrontmatterSchema,
} from './content-schema';

const sharedFields = {
  title: '測試內容',
  description: '測試內容摘要。',
  category: 'overview',
  tags: ['test'],
  order: 1,
  author: 'CCO Toolkit',
  date: '2042-02-03',
  updated: '2042-02-03',
  locale: 'zh-tw',
};

describe('閱讀型內容 frontmatter schema', () => {
  it('只用 title 與 description 也能建立可發布內容', () => {
    for (const schema of [
      guideFrontmatterSchema,
      blogFrontmatterSchema,
      toolFrontmatterSchema,
    ]) {
      const result = schema.safeParse({
        title: '短篇內容',
        description: '適合短篇筆記或公告的摘要。',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
        expect(result.data.order).toBe(0);
        expect(result.data.contentStatus).toBe('complete');
      }
    }
  });

  it('接受 Guide、Blog、Tool 的完整合法欄位', () => {
    const guideResult = guideFrontmatterSchema.safeParse({
      ...sharedFields,
      section: 'overview',
    });

    expect(guideResult.success).toBe(true);
    if (guideResult.success) expect(guideResult.data.author).toBe('CCO Toolkit');

    expect(
      blogFrontmatterSchema.safeParse({
        ...sharedFields,
        author: 'CCO Toolkit',
        dataVersion: 'snapshot-1',
        dataReferences: ['search-rewards'],
      }).success,
    ).toBe(true);

    expect(
      toolFrontmatterSchema.safeParse({
        ...sharedFields,
        toolId: 'helper-overview',
        section: 'helper',
      }).success,
    ).toBe(true);
  });

  it('將 author 納入共用 schema，且各閱讀型內容仍可省略', () => {
    for (const schema of [
      guideFrontmatterSchema,
      blogFrontmatterSchema,
      toolFrontmatterSchema,
    ]) {
      const withAuthor = schema.safeParse({
        title: '有作者的內容',
        description: '測試共用作者欄位。',
        author: 'CCO Toolkit',
      });

      expect(withAuthor.success).toBe(true);
      if (withAuthor.success) expect(withAuthor.data.author).toBe('CCO Toolkit');
    }
  });

  it('對缺少必要欄位與錯誤型別回報可定位的 path', () => {
    const result = guideFrontmatterSchema.safeParse({
      ...sharedFields,
      order: -1,
      locale: 'zh',
      date: '27/08/2042',
      section: '',
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['order'] }),
        expect.objectContaining({ path: ['locale'] }),
        expect.objectContaining({ path: ['date'] }),
        expect.objectContaining({ path: ['section'] }),
      ]),
    );
  });

  it('接受 Blog 的 date 與未來擴充欄位，並保留欄位資料', () => {
    const result = blogFrontmatterSchema.safeParse({
      ...sharedFields,
      author: 'CCO Toolkit',
      audience: 'advanced',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.date).toBe('2042-02-03');
    expect(result.data.audience).toBe('advanced');
  });

  it('依資料集 ID 宣告內容依賴，未提供時使用空陣列', () => {
    const minimal = guideFrontmatterSchema.safeParse({
      title: '沒有資料依賴的內容',
      description: '只測試預設值。',
    });
    const referenced = guideFrontmatterSchema.safeParse({
      ...sharedFields,
      dataReferences: ['search-rewards'],
    });

    expect(minimal.success).toBe(true);
    if (minimal.success) expect(minimal.data.dataReferences).toEqual([]);
    expect(referenced.success).toBe(true);
    if (referenced.success) expect(referenced.data.dataReferences).toEqual(['search-rewards']);
  });

  it('拒絕不符合 dataset ID 格式的資料引用', () => {
    const result = guideFrontmatterSchema.safeParse({
      ...sharedFields,
      dataReferences: ['Search Rewards'],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['dataReferences', 0] })]),
    );
  });

  it('接受 Tool 的穩定 id', () => {
    const result = toolFrontmatterSchema.safeParse({
      title: '工具頁',
      description: '工具頁摘要。',
      toolId: 'search-reward',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.toolId).toBe('search-reward');
  });

  it('拒絕不穩定格式的 Tool id', () => {
    const result = toolFrontmatterSchema.safeParse({
      title: '工具頁',
      description: '工具頁摘要。',
      toolId: 'Search Reward',
    });

    expect(result.success).toBe(false);
  });

  it('只允許 contentStatus 使用 complete 或 incomplete，省略時預設 complete', () => {
    expect(contentStatusSchema.safeParse('complete').success).toBe(true);
    expect(contentStatusSchema.safeParse('incomplete').success).toBe(true);
    expect(contentStatusSchema.safeParse('draft').success).toBe(false);

    const result = guideFrontmatterSchema.safeParse({
      title: '未完成內容',
      description: '測試內容狀態。',
      contentStatus: 'incomplete',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contentStatus).toBe('incomplete');
  });
});
