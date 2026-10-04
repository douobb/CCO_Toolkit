'use client';

import {
  DocsPage,
  type DocsPageProps,
} from 'fumadocs-ui/layouts/docs/page';
import {
  TOC,
  TOCPopover,
  TOCProvider,
  type TOCProps,
} from 'fumadocs-ui/layouts/docs/page/slots/toc';
import type { ReactNode } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';

import { cn } from '@/lib/cn';

import {
  ContextSidebar,
  type ContextSidebarItem,
} from './context-sidebar';
import { ContextMobileItems } from './context-mobile';

export type ContextualDocsPageProps = {
  toc: TOCItemType[];
  full?: DocsPageProps['full'];
  contextLabel: string;
  contextPanelLabel: string;
  contextCloseLabel: string;
  contextItems?: readonly ContextSidebarItem[];
  defaultContextId?: string;
  /** 可由 ToolPage 將行動版入口放在標題／工具操作區；null 表示自行處理。 */
  mobileContext?: ReactNode;
  children: ReactNode;
};

export function ContextualDocsPage({
  toc,
  full,
  contextLabel,
  contextPanelLabel,
  contextCloseLabel,
  contextItems = [],
  defaultContextId = 'toc',
  mobileContext,
  children,
}: ContextualDocsPageProps) {
  const additionalItems = contextItems.filter((item) => item.kind !== 'toc');
  const hasMultipleItems = additionalItems.length > 0;
  const resolvedMobileContext =
    mobileContext === undefined ? (
      <ContextMobileItems items={additionalItems} closeLabel={contextCloseLabel} />
    ) : (
      mobileContext
    );

  return (
    <DocsPage
      toc={toc}
      full={full}
      slots={{
        toc: {
          provider: TOCProvider,
          main: (props: TOCProps) => {
            const tocContent = (
              <TOC
                {...props}
                container={{
                  ...props.container,
                  className: cn(
                    props.container?.className,
                    hasMultipleItems &&
                      'static h-full w-full pt-4 pe-0 pb-2 [&>#toc-title]:sr-only',
                  ),
                }}
              />
            );

            return (
              <ContextSidebar
                items={[
                  {
                    id: 'toc',
                    kind: 'toc',
                    label: contextLabel,
                    content: tocContent,
                  },
                  ...additionalItems,
                ]}
                defaultId={defaultContextId}
                tabListLabel={contextPanelLabel}
                aria-label={
                  hasMultipleItems ? contextPanelLabel : contextLabel
                }
                className={cn(
                  '[grid-area:toc]',
                  hasMultipleItems &&
                    'sticky top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px]',
                )}
              />
            );
          },
          popover: TOCPopover,
        },
      }}
    >
      {resolvedMobileContext}
      {children}
    </DocsPage>
  );
}
