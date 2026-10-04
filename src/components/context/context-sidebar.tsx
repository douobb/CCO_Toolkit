'use client';

import { Tabs } from '@base-ui/react/tabs';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export const contextSidebarModes = ['toc', 'tool', 'info', 'none'] as const;

export type RightSidebarMode = (typeof contextSidebarModes)[number];
export type ContextSidebarContentMode = Exclude<RightSidebarMode, 'none'>;

export const contextSidebarMobileStrategies = ['sheet', 'inline', 'hidden'] as const;
export type ContextSidebarMobileStrategy = (typeof contextSidebarMobileStrategies)[number];

export type ContextSidebarMobileConfig =
  | {
      strategy: 'sheet';
      content?: ReactNode;
      title?: ReactNode;
      description?: ReactNode;
      openLabel?: string;
      closeLabel?: string;
      side?: 'right' | 'bottom';
    }
  | {
      strategy: 'inline';
      content?: ReactNode;
    }
  | {
      strategy: 'hidden';
    };

export function isRightSidebarMode(value: string): value is RightSidebarMode {
  return contextSidebarModes.includes(value as RightSidebarMode);
}

type ContextSidebarBaseProps = Omit<
  ComponentProps<'aside'>,
  'children' | 'title'
>;

export type ContextSidebarItem = {
  /** 同一頁面內的唯一分頁識別；不可用 kind 取代。 */
  id: string;
  /** 面板用途的語意分類；同一 kind 可以出現多次。 */
  kind: ContextSidebarContentMode;
  label: ReactNode;
  content: ReactNode;
  /** 未提供時，非 TOC item 預設以 sheet 提供行動版入口。 */
  mobile?: ContextSidebarMobileConfig;
  /** 只在確實需要保留未選取內容時開啟，避免所有 panel 永遠掛載。 */
  keepMounted?: boolean;
};

type SingleContextSidebarProps = ContextSidebarBaseProps & {
  mode: RightSidebarMode;
  title?: ReactNode;
  children?: ReactNode;
  items?: never;
  defaultMode?: never;
  tabListLabel?: never;
};

type MultiContextSidebarProps = ContextSidebarBaseProps & {
  items: readonly ContextSidebarItem[];
  defaultId?: string;
  tabListLabel: string;
  mode?: never;
  title?: never;
  children?: never;
};

export type ContextSidebarProps =
  | SingleContextSidebarProps
  | MultiContextSidebarProps;

function validateItems(items: readonly ContextSidebarItem[]) {
  const ids = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) {
      throw new Error('Context Sidebar item id 不可為空。');
    }

    if (ids.has(item.id)) {
      throw new Error(`Context Sidebar item id 不可重複：${item.id}`);
    }

    ids.add(item.id);
  }

  return items;
}

function SingleContextSidebar({
  mode,
  title,
  children,
  className,
  ...props
}: SingleContextSidebarProps) {
  if (mode === 'none') return null;

  return (
    <aside
      data-context-sidebar=""
      data-context-mode={mode}
      className={cn(
        'hidden min-w-0 flex-col text-sm text-foreground xl:flex',
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium text-muted-foreground">{title}</h2>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );
}

function MultiContextSidebar({
  items: suppliedItems,
  defaultId,
  tabListLabel,
  className,
  ...props
}: MultiContextSidebarProps) {
  const items = validateItems(suppliedItems);
  const initialId = items.some((item) => item.id === defaultId)
    ? defaultId
    : items[0]?.id;

  if (!initialId) return null;

  if (items.length === 1) {
    return (
      <aside
        data-context-sidebar=""
        data-context-id={items[0]?.id}
        data-context-kind={items[0]?.kind}
        data-context-ids={items[0]?.id}
        data-context-kinds={items[0]?.kind}
        className={cn(
          'hidden min-w-0 flex-col text-sm text-foreground xl:flex',
          className,
        )}
        {...props}
      >
        <div className="min-h-0 flex-1">{items[0]?.content}</div>
      </aside>
    );
  }

  return (
    <aside
      data-context-sidebar=""
      data-context-ids={items.map((item) => item.id).join(' ')}
      data-context-kinds={items.map((item) => item.kind).join(' ')}
      className={cn(
        'hidden min-w-0 flex-col text-sm text-foreground xl:flex',
        className,
      )}
      {...props}
    >
      <Tabs.Root
        defaultValue={initialId}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label={tabListLabel}
          activateOnFocus
          className="flex shrink-0 border-b border-border"
        >
          {items.map((item) => (
            <Tabs.Tab
              key={item.id}
              value={item.id}
              className="min-w-0 flex-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset aria-selected:border-foreground aria-selected:text-foreground"
            >
              <span className="truncate">{item.label}</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <div className="min-h-0 flex-1">
          {items.map((item) => (
            <Tabs.Panel
              key={item.id}
              value={item.id}
              keepMounted={item.keepMounted ?? false}
              className="h-full min-h-0 overflow-y-auto"
            >
              {item.content}
            </Tabs.Panel>
          ))}
        </div>
      </Tabs.Root>
    </aside>
  );
}

export function ContextSidebar(props: ContextSidebarProps) {
  if ('items' in props && props.items) {
    return <MultiContextSidebar {...props} />;
  }

  return <SingleContextSidebar {...props} />;
}
