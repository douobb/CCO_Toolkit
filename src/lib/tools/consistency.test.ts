import { describe, expect, it } from 'vitest';

import {
  assertToolRegistryConsistency,
  getToolRegistryConsistencyIssues,
} from './consistency';

describe('Tool definition 與 MDX 一致性', () => {
  const definition = {
    id: 'search-reward',
    path: 'tools/search-reward',
    renderer: 'search-reward',
  } as const;

  it('只有繁中工具頁時合法', () => {
    expect(
      getToolRegistryConsistencyIssues([definition], [
        { locale: 'zh-tw', slugs: ['tools'], data: {} },
        { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
      ]),
    ).toEqual([]);
  });

  it('繁中與英文工具頁都正確時合法', () => {
    expect(
      getToolRegistryConsistencyIssues([definition], [
        { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
        { locale: 'en', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
      ]),
    ).toEqual([]);
  });

  it('英文同路徑的錯誤 toolId 會指出英文位置', () => {
    const issues = getToolRegistryConsistencyIssues([definition], [
      { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
      { locale: 'en', slugs: ['tools', 'search-reward'], data: { toolId: 'wrong-id' } },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[en] tools/search-reward'),
        expect.stringContaining('wrong-id'),
      ]),
    );
  });

  it('英文尚未翻譯時不要求建立英文工具頁', () => {
    expect(
      getToolRegistryConsistencyIssues([definition], [
        { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
        { locale: 'en', slugs: ['tools'], data: {} },
      ]),
    ).toEqual([]);
  });

  it('不要求工具區段 index 提供 toolId', () => {
    expect(
      getToolRegistryConsistencyIssues([definition], [
        { locale: 'zh-tw', slugs: ['tools'], data: {} },
        { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'search-reward' } },
      ]),
    ).not.toContain(expect.stringContaining('tools'));
  });

  it('指出缺少 definition 或錯誤 toolId 的定位資訊', () => {
    const issues = getToolRegistryConsistencyIssues(
      [
        {
          id: 'search-reward',
          path: 'tools/search-reward',
          renderer: 'search-reward',
        },
      ],
      [
        { locale: 'en', slugs: ['tools', 'missing'], data: { toolId: 'missing-tool' } },
        { locale: 'zh-tw', slugs: ['tools', 'search-reward'], data: { toolId: 'wrong-id' } },
      ],
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing-tool'),
        expect.stringContaining('tools/search-reward'),
      ]),
    );
  });

  it('一致時不拋出 build-time assertion', () => {
    expect(() =>
      assertToolRegistryConsistency(
        [{ id: 'simple-tool', path: 'tools/simple-tool', renderer: 'simple-tool' }],
        [{ locale: 'zh-tw', slugs: ['tools', 'simple-tool'], data: { toolId: 'simple-tool' } }],
      ),
    ).not.toThrow();
  });
});
