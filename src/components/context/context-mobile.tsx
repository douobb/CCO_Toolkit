'use client';

import { useSyncExternalStore, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { ContextSheet } from './context-sheet';
import type { ContextSidebarItem, ContextSidebarMobileConfig } from './context-sidebar';

export type ContextMobileItemsProps = {
  items: readonly ContextSidebarItem[];
  closeLabel: string;
  className?: string;
  /** 將工具面板入口放進頁面 actions bar 或固定 navbar，使用 icon-only trigger。 */
  placement?: 'flow' | 'header-actions' | 'navbar';
};

function getMobileConfig(item: ContextSidebarItem): ContextSidebarMobileConfig {
  return item.mobile ?? { strategy: 'sheet' };
}

function getMobileContent(item: ContextSidebarItem, config: ContextSidebarMobileConfig) {
  return 'content' in config && config.content !== undefined ? config.content : item.content;
}

const navbarSlotSelector = '#nd-subnav [data-cco-tool-header-settings-slot]';

function subscribeToNavbarSlot(onStoreChange: () => void) {
  if (typeof MutationObserver === 'undefined') return () => undefined;

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getNavbarSlot() {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(navbarSlotSelector);
}

function noNavbarSlotSubscription() {
  return () => undefined;
}

function noNavbarSlot() {
  return null;
}

function useNavbarSlot(enabled: boolean) {
  return useSyncExternalStore(
    enabled ? subscribeToNavbarSlot : noNavbarSlotSubscription,
    enabled ? getNavbarSlot : noNavbarSlot,
    noNavbarSlot,
  );
}

/**
 * 將非 TOC 的 Context item 映射成行動版入口。
 *
 * 每個 item 可以個別選擇 sheet、inline 或 hidden；未宣告時預設提供 sheet，
 * 確保新增的輔助面板不會因只支援桌面而在行動版悄悄消失。
 */
export function ContextMobileItems({
  items,
  closeLabel,
  className,
  placement = 'flow',
}: ContextMobileItemsProps) {
  const navbarTarget = useNavbarSlot(placement === 'navbar');
  const mobileItems = items.filter((item) => item.kind !== 'toc');
  const visibleItems = mobileItems.filter(
    (item) => getMobileConfig(item).strategy !== 'hidden',
  );
  const sheetItems = visibleItems.filter(
    (item) => getMobileConfig(item).strategy === 'sheet',
  );
  const inlineItems = visibleItems.filter(
    (item) => getMobileConfig(item).strategy === 'inline',
  );

  if (visibleItems.length === 0) return null;

  const content = (
    <div
      data-context-mobile=""
      data-context-mobile-placement={placement}
      className={cn(
        placement === 'navbar'
          ? 'not-prose'
          : placement === 'header-actions'
            ? 'not-prose xl:hidden'
            : 'not-prose mb-6 space-y-4 xl:hidden',
        className,
      )}
    >
      {sheetItems.length > 0 ? (
        <div
          data-context-mobile-controls=""
          className={cn(
            'flex gap-2',
            placement !== 'flow' ? 'items-center' : 'flex-wrap',
          )}
        >
          {sheetItems.map((item) => {
            const config = getMobileConfig(item);
            if (config.strategy !== 'sheet') return null;

            const trigger =
              placement !== 'flow' && item.kind === 'tool' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={config.openLabel}
                  title={config.openLabel}
                  className="size-9 p-2"
                >
                  <Settings aria-hidden="true" />
                  <span className="sr-only">{item.label}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={config.openLabel}
                >
                  {item.label}
                </Button>
              );

            return (
              <div
                key={item.id}
                data-context-mobile-item-id={item.id}
                data-context-mobile-strategy="sheet"
              >
                <ContextSheet
                  trigger={trigger as ReactElement}
                  title={config.title ?? item.label}
                  description={config.description}
                  closeLabel={config.closeLabel ?? closeLabel}
                  side={config.side ?? 'bottom'}
                >
                  {getMobileContent(item, config)}
                </ContextSheet>
              </div>
            );
          })}
        </div>
      ) : null}

      {inlineItems.map((item) => {
        const config = getMobileConfig(item);
        if (config.strategy !== 'inline') return null;

        return (
          <section
            key={item.id}
            data-context-mobile-item-id={item.id}
            data-context-mobile-strategy="inline"
            aria-label={typeof item.label === 'string' ? item.label : undefined}
          >
            {getMobileContent(item, config)}
          </section>
        );
      })}
    </div>
  );

  if (placement === 'navbar') {
    return navbarTarget ? createPortal(content, navbarTarget) : null;
  }

  return content;
}
