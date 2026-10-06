import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/context', () => ({
  ContextualDocsPage: ({
    contextItems = [],
    children,
  }: {
    contextItems?: readonly {
      id: string;
      kind: string;
      content: ReactNode;
      mobile?: { content?: ReactNode };
    }[];
    children: ReactNode;
  }) => {
    const items = [{ id: 'toc', kind: 'toc', content: null }, ...contextItems];

    return (
      <div data-context-ids={items.map((item) => item.id).join(' ')}>
        {items.map((item) => (
          <div key={item.id} data-context-id={item.id} data-context-kind={item.kind}>
            {item.content}
          </div>
        ))}
        {children}
      </div>
    );
  },
  ContextMobileItems: ({
    items,
    placement,
  }: {
    items?: readonly {
      id: string;
      mobile?: { content?: ReactNode };
    }[];
    placement?: string;
  }) => (
    <div data-context-mobile="" data-context-mobile-placement={placement ?? 'flow'}>
      {items?.map((item) => (
        <div key={item.id} data-context-mobile-id={item.id}>
          {item.mobile?.content}
        </div>
      ))}
    </div>
  ),
}));

import { ToolPage } from './tool-page';

describe('共用 Tool Page 模板', () => {
  it('將次要設定接到桌面側欄與行動版 Sheet', () => {
    const markup = renderToStaticMarkup(
      <ToolPage
        toc={[]}
        contextLabel="本頁內容"
        contextPanelLabel="工具頁面板"
        contextCloseLabel="關閉面板"
        header={
          <>
            <h1 data-docs-title="">搜索收益計算器</h1>
            <p data-docs-description="">依玩家等級估算搜索收益。</p>
          </>
        }
        headerActions={<button type="button">複製</button>}
        settings={{
          id: 'tool-settings',
          label: '設定',
          title: '計算設定',
          description: '調整低頻設定。',
          openLabel: '開啟工具設定',
          closeLabel: '關閉工具設定',
          idPrefix: 'search-reward-settings',
          render: ({ surface, idPrefix }) => (
            <div
              data-settings-order="buff assumption mode"
              data-settings-surface={surface}
              data-settings-id-prefix={idPrefix}
            >
              {surface === 'desktop' ? `桌面設定 ${idPrefix}` : `行動設定 ${idPrefix}`}
            </div>
          ),
        }}
        contextItems={[
          {
            id: 'info-summary',
            kind: 'info',
            label: '摘要',
            content: <p>摘要桌面內容</p>,
            mobile: { strategy: 'inline', content: <p>摘要行動內容</p> },
          },
        ]}
        defaultContextId="info-summary"
      >
        <section id="primary-inputs">主要輸入與結果</section>
      </ToolPage>,
    );

    expect(markup).toContain(
      '<h1 data-docs-title="">搜索收益計算器</h1><p data-docs-description="">依玩家等級估算搜索收益。</p>',
    );
    expect(markup).not.toContain('data-tool-page-header');
    expect(markup).toContain('data-tool-page-actions');
    expect(markup).toContain('data-context-mobile-placement="navbar"');
    expect(markup).toContain('data-context-mobile-id="tool-settings"');
    expect(markup).toContain('data-context-ids="toc tool-settings info-summary"');
    expect(markup).toContain('data-context-id="tool-settings"');
    expect(markup).toContain('桌面設定 search-reward-settings-desktop');
    expect(markup).toContain('行動設定 search-reward-settings-mobile');
    expect(markup.match(/data-settings-order="buff assumption mode"/g)).toHaveLength(2);
    expect(markup).toContain('data-settings-surface="desktop"');
    expect(markup).toContain('data-settings-surface="mobile"');
    expect(markup).toContain('data-context-mobile-id="info-summary"');
    expect(markup).toContain('摘要行動內容');
    expect(markup).toContain('主要輸入與結果');
  });

  it('沒有次要設定時不渲染工具設定入口，仍保留 TOC', () => {
    const markup = renderToStaticMarkup(
      <ToolPage
        toc={[]}
        contextLabel="本頁內容"
        contextPanelLabel="頁面內容"
        contextCloseLabel="關閉面板"
        header={<h1>工具</h1>}
      >
        <section id="content">內容</section>
      </ToolPage>,
    );

    expect(markup).toContain('data-context-kind="toc"');
    expect(markup).not.toContain('開啟工具設定');
  });
});
