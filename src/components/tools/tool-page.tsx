'use client';

import type { ReactNode } from 'react';

import {
  ContextMobileItems,
  ContextualDocsPage,
  type ContextSidebarMobileStrategy,
  type ContextSidebarItem,
  type ContextualDocsPageProps,
} from '@/components/context';
import { cn } from '@/lib/cn';

/**
 * 工具頁的次要設定契約。
 *
 * 同一個 render function 會收到目前 surface 與專用 idPrefix，讓桌面／
 * 行動版可以保有適合各自容器的 DOM，而不需要在呼叫端重複宣告內容。
 */
export type ToolPageSurface = 'desktop' | 'mobile';

export type ToolPageRenderContext = {
  readonly surface: ToolPageSurface;
  readonly idPrefix: string;
};

export interface ToolPageSettings {
  readonly id: string;
  readonly label: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly openLabel: string;
  readonly closeLabel: string;
  readonly idPrefix?: string;
  readonly render: (context: ToolPageRenderContext) => ReactNode;
  readonly mobileStrategy?: ContextSidebarMobileStrategy;
  readonly keepMounted?: boolean;
}

export type ToolPageProps = Omit<
  ContextualDocsPageProps,
  'contextItems' | 'defaultContextId' | 'mobileContext' | 'children'
> & {
  /**
   * 工具頁標題與描述區塊；renderer 應傳入 DocsTitle／DocsDescription 的
   * fragment，讓兩者維持為 DocsPage 的直接 children。
   */
  readonly header: ReactNode;
  /** 標題下方的操作區，例如複製 Markdown。 */
  readonly headerActions?: ReactNode;
  /** 工具的次要設定；會自動同步到桌面側欄與行動版 Bottom Sheet。 */
  readonly settings?: ToolPageSettings;
  /** 額外的 Context Sidebar 分頁，例如資訊或結果摘要。 */
  readonly contextItems?: readonly ContextSidebarItem[];
  readonly defaultContextId?: string;
  readonly headerActionsClassName?: string;
  readonly children: ReactNode;
};

function getSettingsItem(settings: ToolPageSettings): ContextSidebarItem {
  const baseIdPrefix = settings.idPrefix ?? `tool-${settings.id}`;
  const render = (surface: ToolPageSurface) =>
    settings.render({
      surface,
      idPrefix: `${baseIdPrefix}-${surface}`,
    });
  const mobileStrategy = settings.mobileStrategy ?? 'sheet';

  return {
    id: settings.id,
    kind: 'tool',
    label: settings.label,
    content: render('desktop'),
    keepMounted: settings.keepMounted,
    mobile:
      mobileStrategy === 'hidden'
        ? { strategy: 'hidden' }
        : mobileStrategy === 'inline'
          ? { strategy: 'inline', content: render('mobile') }
          : {
              strategy: 'sheet',
              content: render('mobile'),
              title: settings.title,
              description: settings.description,
              openLabel: settings.openLabel,
              closeLabel: settings.closeLabel,
              side: 'bottom',
            },
  };
}

/**
 * 共用工具頁模板：保留 Fumadocs 文件容器，集中處理工具 Context Sidebar
 * 與行動版設定入口；主要輸入與結果仍由工具自己的 children 組合。
 */
export function ToolPage({
  header,
  headerActions,
  settings,
  contextItems = [],
  defaultContextId,
  headerActionsClassName,
  children,
  ...docsProps
}: ToolPageProps) {
  const resolvedContextItems = settings
    ? [getSettingsItem(settings), ...contextItems]
    : contextItems;
  const mobileActionItems = resolvedContextItems.filter(
    (item) =>
      item.kind === 'tool' &&
      (item.mobile?.strategy ?? 'sheet') === 'sheet',
  );
  const mobileFlowItems = resolvedContextItems.filter(
    (item) =>
      item.kind !== 'tool' ||
      item.mobile?.strategy === 'inline',
  );
  const hasHeaderActions = headerActions !== undefined;

  return (
    <ContextualDocsPage
      {...docsProps}
      contextItems={resolvedContextItems}
      defaultContextId={defaultContextId ?? (settings?.id ?? 'toc')}
      mobileContext={null}
    >
      {header}
      {mobileActionItems.length > 0 ? (
        <ContextMobileItems
          items={mobileActionItems}
          closeLabel={docsProps.contextCloseLabel}
          placement="navbar"
        />
      ) : null}
      {hasHeaderActions ? (
        <div
          data-tool-page-actions=""
          className={cn(
            'flex flex-row items-center gap-2 border-b pb-6',
            headerActionsClassName,
          )}
        >
          {headerActions}
        </div>
      ) : null}
      {mobileFlowItems.length > 0 ? (
        <ContextMobileItems
          items={mobileFlowItems}
          closeLabel={docsProps.contextCloseLabel}
        />
      ) : null}
      {children}
    </ContextualDocsPage>
  );
}
