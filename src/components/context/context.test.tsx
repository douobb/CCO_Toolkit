import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ContextSidebar,
  contextSidebarModes,
  isRightSidebarMode,
} from './context-sidebar';
import { ContextSheet } from './context-sheet';
import { ContextMobileItems } from './context-mobile';
import { MobileTOC } from './mobile-toc';

describe('context layout foundation', () => {
  it('supports all planned sidebar modes and omits none', () => {
    expect(contextSidebarModes).toEqual(['toc', 'tool', 'info', 'none']);
    expect(isRightSidebarMode('tool')).toBe(true);
    expect(isRightSidebarMode('unknown')).toBe(false);

    const toolMarkup = renderToStaticMarkup(
      <ContextSidebar mode="tool" title="Tool options">
        <p>Options</p>
      </ContextSidebar>,
    );
    const noneMarkup = renderToStaticMarkup(
      <ContextSidebar mode="none">
        <p>Hidden</p>
      </ContextSidebar>,
    );

    expect(toolMarkup).toContain('data-context-mode="tool"');
    expect(toolMarkup).toContain('Tool options');
    expect(noneMarkup).toBe('');
  });

  it('keeps TOC available when tool settings become the default context', () => {
    const markup = renderToStaticMarkup(
      <ContextSidebar
        items={[
          {
            id: 'toc',
            kind: 'toc',
            label: 'On this page',
            content: <p>Page progress</p>,
            keepMounted: true,
          },
          {
            id: 'tool-settings',
            kind: 'tool',
            label: 'Tool settings',
            content: <p>Secondary inputs</p>,
            keepMounted: true,
          },
        ]}
        defaultId="tool-settings"
        tabListLabel="Page context"
      />,
    );

    expect(markup).toContain('data-context-ids="toc tool-settings"');
    expect(markup).toContain('data-context-kinds="toc tool"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('On this page');
    expect(markup).toContain('Tool settings');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('Secondary inputs');
  });

  it('保留同 kind 的多個 panel，並以唯一 id 選取預設分頁', () => {
    const markup = renderToStaticMarkup(
      <ContextSidebar
        items={[
          {
            id: 'info-summary',
            kind: 'info',
            label: '摘要',
            content: <p>摘要內容</p>,
          },
          {
            id: 'info-source',
            kind: 'info',
            label: '來源',
            content: <p>來源內容</p>,
          },
        ]}
        defaultId="info-source"
        tabListLabel="頁面面板"
      />,
    );

    expect(markup).toContain('data-context-ids="info-summary info-source"');
    expect(markup).toContain('data-context-kinds="info info"');
    expect(markup).toContain('摘要');
    expect(markup).toContain('來源');
    expect(markup).toContain('aria-selected="true"');
  });

  it('遇到重複 id 時明確失敗，不靜默丟棄 panel', () => {
    expect(() =>
      renderToStaticMarkup(
        <ContextSidebar
          items={[
            { id: 'duplicate', kind: 'info', label: '一', content: <p>一</p> },
            { id: 'duplicate', kind: 'tool', label: '二', content: <p>二</p> },
          ]}
          tabListLabel="頁面面板"
        />,
      ),
    ).toThrow('Context Sidebar item id 不可重複');
  });

  it('讓行動版逐項選擇 sheet、inline 或 hidden 呈現策略', () => {
    const markup = renderToStaticMarkup(
      <ContextMobileItems
        closeLabel="關閉面板"
        items={[
          {
            id: 'tool-settings',
            kind: 'tool',
            label: '設定',
            content: <p>桌面設定</p>,
            mobile: {
              strategy: 'sheet',
              content: <p>行動設定</p>,
              openLabel: '開啟設定',
            },
          },
          {
            id: 'info-summary',
            kind: 'info',
            label: '摘要',
            content: <p>摘要內容</p>,
            mobile: { strategy: 'inline' },
          },
          {
            id: 'info-debug',
            kind: 'info',
            label: '除錯資訊',
            content: <p>不應顯示</p>,
            mobile: { strategy: 'hidden' },
          },
        ]}
      />,
    );

    expect(markup).toContain('data-context-mobile-item-id="tool-settings"');
    expect(markup).toContain('data-context-mobile-strategy="sheet"');
    expect(markup).toContain('開啟設定');
    expect(markup).toContain('data-context-mobile-item-id="info-summary"');
    expect(markup).toContain('data-context-mobile-strategy="inline"');
    expect(markup).toContain('摘要內容');
    expect(markup).not.toContain('info-debug');
    expect(markup).not.toContain('不應顯示');
  });

  it('可將工具面板入口呈現為 actions bar 內的設定 icon', () => {
    const markup = renderToStaticMarkup(
      <ContextMobileItems
        closeLabel="關閉面板"
        placement="header-actions"
        items={[
          {
            id: 'tool-settings',
            kind: 'tool',
            label: '設定',
            content: <p>桌面設定</p>,
            mobile: {
              strategy: 'sheet',
              content: <p>行動設定</p>,
              openLabel: '開啟設定',
            },
          },
        ]}
      />,
    );

    expect(markup).toContain('data-context-mobile-placement="header-actions"');
    expect(markup).toContain('aria-label="開啟設定"');
    expect(markup).toContain('title="開啟設定"');
    expect(markup).toContain('class="sr-only">設定</span>');
  });

  it('renders a mobile TOC from the supplied Fumadocs items', () => {
    const markup = renderToStaticMarkup(
      <MobileTOC
        label="On this page"
        items={[{ title: 'Introduction', url: '#introduction', depth: 2 }]}
      />,
    );

    expect(markup).toContain('<summary');
    expect(markup).toContain('On this page');
    expect(markup).toContain('href="#introduction"');
  });

  it('connects a sheet trigger to dialog semantics', () => {
    const markup = renderToStaticMarkup(
      <ContextSheet
        open
        title="Tool settings"
        closeLabel="Close settings"
        trigger={<button type="button">Open settings</button>}
      >
        <p>Settings content</p>
      </ContextSheet>,
    );

    expect(markup).toContain('Open settings');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
  });
});
