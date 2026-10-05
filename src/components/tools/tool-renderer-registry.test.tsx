import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('@/components/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/context')>();
  return {
    ...actual,
    ContextualDocsPage: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    ContextMobileItems: () => null,
  };
});

import {
  getToolRenderer,
  toolRendererKeys,
} from './tool-renderer-registry';
import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore } from '@/lib/storage';
import { toolRegistry } from '@/lib/tools';
import { getMessages } from '@/lib/translations';

function renderEarningsOverview(metadata: {
  author?: string;
  date?: string;
  updated?: string;
}) {
  const renderer = getToolRenderer('earnings-overview');
  if (!renderer) throw new Error('缺少 earnings-overview renderer');

  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      {renderer({
        page: {
          title: '收益總覽工具',
          description: '工具說明',
          toc: [],
          ...metadata,
        },
        locale: 'zh-tw',
        messages: getMessages('zh-tw'),
        body: <p>工具正文</p>,
        markdownUrl: '/content.md',
      })}
    </SharedUserInputsProvider>,
  );
  store.dispose();

  return markup;
}

describe('Tool renderer registry', () => {
  it('以 renderer key 對應可執行工具 renderer', () => {
    expect(toolRendererKeys).toContain('search-reward');
    expect(toolRendererKeys).toContain('mining');
    expect(toolRendererKeys).toContain('level-conversion');
    expect(toolRendererKeys).toContain('black-market');
    expect(toolRendererKeys).toContain('dungeon');
    expect(toolRendererKeys).toContain('earnings-overview');
    expect(toolRendererKeys).toContain('backpack-planner');
    expect(toolRendererKeys).toContain('loot-box-analysis');
    expect(getToolRenderer('search-reward')).toBeTypeOf('function');
    expect(getToolRenderer('mining')).toBeTypeOf('function');
    expect(getToolRenderer('level-conversion')).toBeTypeOf('function');
    expect(getToolRenderer('black-market')).toBeTypeOf('function');
    expect(getToolRenderer('dungeon')).toBeTypeOf('function');
    expect(getToolRenderer('earnings-overview')).toBeTypeOf('function');
    expect(getToolRenderer('backpack-planner')).toBeTypeOf('function');
    expect(getToolRenderer('loot-box-analysis')).toBeTypeOf('function');
    expect(getToolRenderer('unknown-renderer')).toBeUndefined();
    expect(toolRegistry.every((tool) => getToolRenderer(tool.renderer))).toBe(true);
  });

  it('將 frontmatter metadata 放在工具標題區，缺省時不產生 metadata markup', () => {
    const withMetadata = renderEarningsOverview({
      author: 'CCO Toolkit',
      date: '2042-03-04',
      updated: '2042-03-05',
    });
    const withoutMetadata = renderEarningsOverview({});
    const metadataIndex = withMetadata.indexOf('data-article-metadata=""');

    expect(metadataIndex).toBeGreaterThan(withMetadata.indexOf('data-docs-description'));
    expect(metadataIndex).toBeLessThan(withMetadata.indexOf('data-tool-page-actions'));
    expect(withMetadata).toContain('作者');
    expect(withMetadata).toContain('CCO Toolkit');
    expect(withMetadata).toContain('2042年3月4日');
    expect(withMetadata).toContain('2042年3月5日');
    expect(withMetadata).not.toContain('related-content-heading');
    expect(withoutMetadata).not.toContain('data-article-metadata=""');
  });

  it('將收益趨勢圖放在結果表格後、MDX 工具正文前', () => {
    const markup = renderEarningsOverview({});
    const tableIndex = markup.indexOf('data-result-layout="table"');
    const chartIndex = markup.indexOf('data-earnings-chart="true"');
    const bodyIndex = markup.indexOf('工具正文');

    expect(tableIndex).toBeGreaterThan(-1);
    expect(chartIndex).toBeGreaterThan(tableIndex);
    expect(bodyIndex).toBeGreaterThan(chartIndex);
  });

  it('繁中與英文都不保留已移除的工具副標題訊息鍵', () => {
    const removedKeys = {
      searchReward: ['settingsDescription', 'primaryHint', 'priceHint', 'ladderHint'],
      mining: ['settingsDescription', 'primaryHint', 'priceHint', 'buffHint'],
      levelConversion: ['settingsDescription', 'primaryHint', 'priceHint', 'buffHint', 'resultHint'],
      blackMarket: ['settingsDescription', 'primaryHint', 'amountHint', 'priceHint', 'quantityHint'],
      dungeon: ['settingsDescription', 'inputHint', 'summaryHint'],
      earningsOverview: ['primaryHint', 'resultHint'],
      backpackPlanner: ['primaryHint', 'inventoryHint', 'resultHint'],
      lootBoxAnalysis: ['settingsDescription', 'priceSyncHint', 'primaryHint', 'dropsHint', 'resultHint'],
    } as const;

    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const tools = getMessages(locale).tools;
      for (const [tool, keys] of Object.entries(removedKeys)) {
        const labels = tools[tool as keyof typeof tools] as Record<string, unknown>;
        for (const key of keys) {
          expect(labels).not.toHaveProperty(key);
        }
      }
    }
  });
});
