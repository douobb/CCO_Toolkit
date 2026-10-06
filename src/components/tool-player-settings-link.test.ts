// @vitest-environment happy-dom

import { act, createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  isToolPagePath,
  ToolPlayerSettingsHeaderLink,
  ToolPlayerSettingsLanguageSelect,
} from './tool-player-settings-link';

const pathnameState = vi.hoisted(() => ({ pathname: '/CCO_Toolkit/en/tools/mining/' }));

vi.mock('fumadocs-core/framework', () => ({
  usePathname: () => pathnameState.pathname,
}));
vi.mock('fumadocs-ui/contexts/i18n', () => ({
  useI18n: () => ({ locale: 'en' }),
}));
vi.mock('fumadocs-ui/layouts/shared/slots/language-select', () => ({
  LanguageSelect: ({ children }: { children: ReactNode }) => children,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedTool {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mountedTools: MountedTool[] = [];

const SharedUserInputsProviderForTest = SharedUserInputsProvider as ComponentType<{
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
  readonly children?: ReactNode;
}>;

afterEach(async () => {
  for (const mounted of mountedTools.splice(0)) {
    await act(async () => {
      mounted.root.unmount();
      await Promise.resolve();
    });
    mounted.store.dispose();
    mounted.container.remove();
  }
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
  pathnameState.pathname = '/CCO_Toolkit/en/tools/mining/';
  vi.restoreAllMocks();
});

async function mountMiningTool() {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  mountedTools.push({ container, root, store });

  await act(async () => {
    root.render(createElement(
      SharedUserInputsProviderForTest,
      { store },
      createElement(
        Fragment,
        null,
        createElement(
          'div',
          { 'data-tool': 'mining' },
          createElement('input', { id: 'mining-hash-price', defaultValue: '123' }),
          createElement('input', { id: 'mining-level', defaultValue: '1' }),
        ),
        createElement(ToolPlayerSettingsHeaderLink),
      ),
    ));
    await Promise.resolve();
  });

  return { container, store };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('input value setter is unavailable');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function updateInput(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    setInputValue(input, value);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

function getMobileTrigger(container: HTMLElement): HTMLButtonElement {
  const trigger = container.querySelector<HTMLButtonElement>(
    '[data-cco-player-settings-link="mobile"]',
  );
  if (!trigger) throw new Error('mobile player settings trigger is missing');
  return trigger;
}

function getDialog(): HTMLElement {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('quick settings dialog is missing');
  return dialog;
}

function getQuickInput(id: string): HTMLInputElement {
  const input = document.body.querySelector<HTMLInputElement>(`#tool-settings-mobile-${id}`);
  if (!input) throw new Error(`quick settings input is missing: ${id}`);
  return input;
}

function getSettingsViewButton(view: 'related' | 'all'): HTMLButtonElement {
  const button = document.body.querySelector<HTMLButtonElement>(
    `[data-testid="tool-settings-view-${view}"]`,
  );
  if (!button) throw new Error(`settings view button is missing: ${view}`);
  return button;
}

describe('工具頁玩家設定快速入口', () => {
  it('辨識工具總覽與已註冊的工具頁路徑', () => {
    expect(isToolPagePath('/zh-tw/tools')).toBe(true);
    expect(isToolPagePath('/en/tools/')).toBe(true);
    expect(isToolPagePath('/zh-tw/tools/search-reward')).toBe(true);
    expect(isToolPagePath('/en/tools/loot-box-analysis/')).toBe(true);
    expect(isToolPagePath('/zh-tw/guides/getting-started')).toBe(false);
    expect(isToolPagePath('/zh-tw/guides/tools')).toBe(false);
    expect(isToolPagePath('/zh-tw/tools/unknown')).toBe(false);
    expect(isToolPagePath('/CCO_Toolkit/en/tools/mining/')).toBe(true);
  });

  it('SSR 輸出桌面與手機按鈕入口，並保留語系選單', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(
          ToolPlayerSettingsLanguageSelect,
          null,
          createElement('span', null, 'Language options'),
        ),
        createElement(ToolPlayerSettingsHeaderLink),
      ),
    );

    expect(markup).toContain('data-cco-player-settings-link="desktop"');
    expect(markup).toContain('data-cco-player-settings-link="mobile"');
    expect(markup.match(/<button\b/g)).toHaveLength(2);
    expect(markup).not.toContain('<a ');
    expect(markup).not.toContain('href="/en/settings"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-label="Player &amp; calculation settings"');
    expect(markup).toContain('h-11');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('Language options');
  });

  it('預設顯示本工具欄位，可切換全部設定並編輯 cacheRates 而不丟失篩選外資料', async () => {
    window.history.replaceState(null, '', '/CCO_Toolkit/en/tools/mining/?view=compact#results');
    const { container, store } = await mountMiningTool();
    const tool = container.querySelector('[data-tool="mining"]');
    const customPriceInput = container.querySelector<HTMLInputElement>('#mining-hash-price');
    const customToolInput = container.querySelector<HTMLInputElement>('#mining-level');
    if (!tool || !customPriceInput || !customToolInput) {
      throw new Error('mining tool UI did not render');
    }

    await updateInput(customPriceInput, '');
    await updateInput(customToolInput, '80');
    expect(customToolInput.value).toBe('80');
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const trigger = getMobileTrigger(container);
    await click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(originalUrl);
    expect(getDialog().querySelector('[data-testid="shared-user-inputs-manager"][data-mode="quick"]'))
      .not.toBeNull();
    expect(getDialog().textContent).toContain(getMessages('en').settingsPage.title);
    expect(getSettingsViewButton('related').getAttribute('aria-pressed')).toBe('true');
    expect(getSettingsViewButton('all').getAttribute('aria-pressed')).toBe('false');
    expect(getQuickInput('shared-level-level')).not.toBeNull();
    expect(getQuickInput('shared-level-mining-skill')).not.toBeNull();
    expect(getQuickInput('shared-price-hash')).not.toBeNull();
    expect(getQuickInput('shared-price-tech-scrap')).not.toBeNull();
    expect(getQuickInput('shared-exchange-btc-per-ai')).not.toBeNull();
    expect(document.body.querySelector('#tool-settings-mobile-shared-cache-trash')).toBeNull();
    expect(document.body.querySelector('#tool-settings-mobile-shared-equipment-armor')).toBeNull();
    expect(getDialog().textContent).not.toContain(getMessages('en').settingsPage.resetTitle);

    await click(getSettingsViewButton('all'));
    expect(getSettingsViewButton('related').getAttribute('aria-pressed')).toBe('false');
    expect(getSettingsViewButton('all').getAttribute('aria-pressed')).toBe('true');
    expect(getQuickInput('shared-equipment-armor')).not.toBeNull();
    const cacheRate = getQuickInput('shared-cache-trash');
    await updateInput(cacheRate, '11');
    expect(store.getSnapshot().economy.cacheRates).toEqual([{ id: 'trash', value: 11 }]);

    await click(getSettingsViewButton('related'));
    expect(document.body.querySelector('#tool-settings-mobile-shared-cache-trash')).toBeNull();
    expect(store.getSnapshot().economy.cacheRates).toEqual([{ id: 'trash', value: 11 }]);

    const levelInput = getQuickInput('shared-level-level');
    await updateInput(levelInput, '120');
    expect(store.getSnapshot().progression.player.level).toBe(120);

    const sharedPriceInput = getQuickInput('shared-price-hash');
    await updateInput(sharedPriceInput, '99');
    expect(store.getSnapshot().economy.prices).toContainEqual({
      itemId: 'hash',
      currencyId: 'ai',
      amount: 99,
    });
    expect(customPriceInput.value).toBe('');
    expect(customToolInput.value).toBe('80');
    expect(container.querySelector('[data-tool="mining"]')).toBe(tool);

    const closeButton = getDialog().querySelector<HTMLButtonElement>(
      '[aria-label="Close shared settings"]',
    );
    if (!closeButton) throw new Error('quick settings close button is missing');
    await click(closeButton);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(originalUrl);
    expect(container.querySelector('[data-tool="mining"]')).toBe(tool);
    expect(customPriceInput.value).toBe('');
    expect(customToolInput.value).toBe('80');
  });

  it('無效 draft 遇 Escape/X 直接關閉且不保存，保留有效變更並在重開時讀取最新 store', async () => {
    window.history.replaceState(null, '', '/CCO_Toolkit/en/tools/mining/?view=compact#results');
    const { container, store } = await mountMiningTool();
    const trigger = getMobileTrigger(container);
    await click(trigger);

    const playerLevel = getQuickInput('shared-level-level');
    await updateInput(playerLevel, '120');
    expect(store.getSnapshot().progression.player.level).toBe(120);

    await act(async () => {
      store.update((current) => ({
        ...current,
        equipment: { ...current.equipment, maxHealth: 42 },
      }));
      await Promise.resolve();
    });
    const savedSnapshot = store.getSnapshot();

    const exchangeRate = getQuickInput('shared-exchange-btc-per-ai');
    await updateInput(exchangeRate, '0');

    expect(store.getSnapshot()).toBe(savedSnapshot);
    expect(getDialog().querySelector('[role="alert"]')?.textContent)
      .toContain(getMessages('en').settingsPage.validationSummary);

    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      .toBe(originalUrl);
    expect(store.getSnapshot()).toBe(savedSnapshot);
    expect(store.getSnapshot().progression.player.level).toBe(120);
    expect(store.getSnapshot().equipment.maxHealth).toBe(42);
    expect(document.activeElement).toBe(trigger);

    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          exchangeRates: [{ id: 'btc-per-ai', value: 777 }],
        },
      }));
      await Promise.resolve();
    });

    await click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(getQuickInput('shared-level-level').value).toBe('120');
    expect(getQuickInput('shared-exchange-btc-per-ai').value).toBe('777');
    expect(getDialog().querySelector('[role="alert"]')).toBeNull();

    const latestSnapshot = store.getSnapshot();
    const reopenedExchangeRate = getQuickInput('shared-exchange-btc-per-ai');
    await updateInput(reopenedExchangeRate, '0');
    expect(store.getSnapshot()).toBe(latestSnapshot);

    const closeButton = getDialog().querySelector<HTMLButtonElement>(
      '[aria-label="Close shared settings"]',
    );
    if (!closeButton) throw new Error('quick settings close button is missing');
    await click(closeButton);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(store.getSnapshot()).toBe(latestSnapshot);
    expect(document.activeElement).toBe(trigger);
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      .toBe(originalUrl);

    await click(trigger);
    expect(getQuickInput('shared-level-level').value).toBe('120');
    expect(getQuickInput('shared-exchange-btc-per-ai').value).toBe('777');
    expect(getDialog().querySelector('[role="alert"]')).toBeNull();

    const backdropSnapshot = store.getSnapshot();
    await updateInput(getQuickInput('shared-exchange-btc-per-ai'), '0');
    expect(store.getSnapshot()).toBe(backdropSnapshot);

    const backdrop = document.body.querySelector<HTMLElement>('.bg-fd-overlay');
    if (!backdrop) throw new Error('quick settings backdrop is missing');
    await click(backdrop);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(store.getSnapshot()).toBe(backdropSnapshot);
    expect(document.activeElement).toBe(trigger);
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      .toBe(originalUrl);

    await click(trigger);
    expect(getQuickInput('shared-exchange-btc-per-ai').value).toBe('777');
    expect(getDialog().querySelector('[role="alert"]')).toBeNull();
  });

  it('工具總覽預設全部設定，related 空範圍提供說明與全部設定入口', async () => {
    pathnameState.pathname = '/en/tools/';
    const { container } = await mountMiningTool();
    const trigger = getMobileTrigger(container);
    await click(trigger);

    expect(getSettingsViewButton('all').getAttribute('aria-pressed')).toBe('true');
    expect(getQuickInput('shared-cache-trash')).not.toBeNull();

    await click(getSettingsViewButton('related'));
    expect(getSettingsViewButton('related').getAttribute('aria-pressed')).toBe('true');
    expect(getDialog().querySelector('[role="status"]')?.textContent)
      .toContain('This tool has no shared settings');
    expect(document.body.querySelector('#tool-settings-mobile-shared-cache-trash')).toBeNull();
    expect(getSettingsViewButton('all').textContent).toContain('All settings');
  });
});
