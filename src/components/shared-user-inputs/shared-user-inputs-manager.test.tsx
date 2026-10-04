// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSharedUserInputsStore,
  defaultSharedUserInputs,
  type SharedUserInputs,
} from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import { SharedUserInputsManager } from './shared-user-inputs-manager';
import { SharedUserInputsProvider } from './shared-user-inputs-react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedManager {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mountedManagers: MountedManager[] = [];

afterEach(async () => {
  for (const mounted of mountedManagers.splice(0)) {
    await act(async () => {
      mounted.root.unmount();
      await Promise.resolve();
    });
    mounted.store.dispose();
    mounted.container.remove();
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function createSnapshot(
  prices: SharedUserInputs['economy']['prices'] = [],
  exchangeRates: SharedUserInputs['economy']['exchangeRates'] = [],
): SharedUserInputs {
  return {
    ...defaultSharedUserInputs,
    economy: {
      ...defaultSharedUserInputs.economy,
      prices,
      exchangeRates,
    },
  };
}

async function mountManager(snapshot: SharedUserInputs = defaultSharedUserInputs) {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  if (snapshot !== defaultSharedUserInputs) store.replace(snapshot);

  const root = createRoot(container);
  mountedManagers.push({ container, root, store });
  await act(async () => {
    root.render(
      <SharedUserInputsProvider store={store}>
        <SharedUserInputsManager labels={getMessages('zh-tw').settingsPage} locale="zh-tw" />
      </SharedUserInputsProvider>,
    );
    await Promise.resolve();
  });

  return { container, store };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

function getPriceInput(container: HTMLElement, itemId: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#shared-price-${itemId}`);
  if (!input) throw new Error(`找不到價格輸入欄位：${itemId}`);
  return input;
}

function getCurrencyButton(
  container: HTMLElement,
  currency: 'ai' | 'btc',
): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-testid="shared-market-price-currency-${currency}"]`,
  );
  if (!button) throw new Error(`找不到貨幣切換按鈕：${currency}`);
  return button;
}

function getUnitText(container: HTMLElement, itemId: string): string {
  const unit = container.querySelector(`#shared-price-${itemId}-unit`);
  if (!unit) throw new Error(`找不到價格單位：${itemId}`);
  return unit.textContent ?? '';
}

describe('Shared User Inputs market price currency display', () => {
  it('切換只改顯示狀態，不呼叫 store replace 或改變 snapshot', async () => {
    const mounted = await mountManager();
    const before = mounted.store.getSnapshot();
    const replace = vi.spyOn(mounted.store, 'replace');

    await click(getCurrencyButton(mounted.container, 'btc'));

    expect(replace).not.toHaveBeenCalled();
    expect(mounted.store.getSnapshot()).toBe(before);
    expect(getCurrencyButton(mounted.container, 'ai').getAttribute('aria-pressed')).toBe('false');
    expect(getCurrencyButton(mounted.container, 'btc').getAttribute('aria-pressed')).toBe('true');
  });

  it('依各項保存基準與目前匯率換算 AI／BTC，並保留材料與物品單位', async () => {
    const mounted = await mountManager(createSnapshot(
      [
        { itemId: 'tech-scrap', currencyId: 'btc', amount: 2 },
        { itemId: 'hash', currencyId: 'ai', amount: 1.85 },
      ],
      [{ id: 'btc-per-ai', value: 100 }],
    ));

    expect(getPriceInput(mounted.container, 'tech-scrap').value).toBe('0.02');
    expect(getPriceInput(mounted.container, 'hash').value).toBe('1.85');
    expect(getUnitText(mounted.container, 'tech-scrap')).toBe('AI/k');
    expect(getUnitText(mounted.container, 'hash')).toBe('AI/item');

    await click(getCurrencyButton(mounted.container, 'btc'));

    expect(getPriceInput(mounted.container, 'tech-scrap').value).toBe('2');
    expect(getPriceInput(mounted.container, 'hash').value).toBe('185');
    expect(getUnitText(mounted.container, 'tech-scrap')).toBe('BTC/k');
    expect(getUnitText(mounted.container, 'hash')).toBe('BTC/item');
  });

  it('編輯時以目前顯示貨幣保存 currencyId 與 amount', async () => {
    const mounted = await mountManager(createSnapshot(
      [],
      [{ id: 'btc-per-ai', value: 100 }],
    ));

    await click(getCurrencyButton(mounted.container, 'btc'));
    const input = getPriceInput(mounted.container, 'tech-scrap');
    setInputValue(input, '12.5');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mounted.store.getSnapshot().economy.prices).toEqual([
      { itemId: 'tech-scrap', currencyId: 'btc', amount: 12.5 },
    ]);
    expect(input.value).toBe('12.5');
  });

  it('匯率變動會重新計算顯示值，但不改寫價格的保存基準', async () => {
    const mounted = await mountManager();
    const lockedContainer = getPriceInput(mounted.container, 'locked-container');
    const exchangeRate = mounted.container.querySelector<HTMLInputElement>(
      '#shared-exchange-btc-per-ai',
    );
    if (!exchangeRate) throw new Error('找不到 BTC/AI 匯率欄位');

    expect(lockedContainer.value).toBe('0.368098159509202');
    setInputValue(exchangeRate, '10000');
    await act(async () => {
      await Promise.resolve();
    });

    expect(lockedContainer.value).toBe('0.3');
    expect(mounted.store.getSnapshot().economy.prices).toEqual([]);
    expect(mounted.store.getSnapshot().economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 10000 },
    ]);
  });

  it('匯率暫時空白或無效時沿用已保存匯率，恢復合法值後即時更新', async () => {
    const mounted = await mountManager(createSnapshot(
      [{ itemId: 'tech-scrap', currencyId: 'ai', amount: 123 }],
      [{ id: 'btc-per-ai', value: 100 }],
    ));
    const replace = vi.spyOn(mounted.store, 'replace');
    const price = getPriceInput(mounted.container, 'tech-scrap');
    const exchangeRate = mounted.container.querySelector<HTMLInputElement>(
      '#shared-exchange-btc-per-ai',
    );
    if (!exchangeRate) throw new Error('找不到 BTC/AI 匯率欄位');

    await click(getCurrencyButton(mounted.container, 'btc'));
    expect(price.value).toBe('12300');
    expect(getUnitText(mounted.container, 'tech-scrap')).toBe('BTC/k');

    setInputValue(exchangeRate, '');
    await act(async () => {
      await Promise.resolve();
    });
    expect(price.value).toBe('12300');
    expect(getUnitText(mounted.container, 'tech-scrap')).toBe('BTC/k');
    expect(replace).not.toHaveBeenCalled();
    expect(mounted.store.getSnapshot().economy.prices).toEqual([
      { itemId: 'tech-scrap', currencyId: 'ai', amount: 123 },
    ]);
    expect(mounted.store.getSnapshot().economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 100 },
    ]);

    setInputValue(exchangeRate, '0');
    await act(async () => {
      await Promise.resolve();
    });
    expect(price.value).toBe('12300');
    expect(replace).not.toHaveBeenCalled();
    expect(mounted.store.getSnapshot().economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 100 },
    ]);

    setInputValue(exchangeRate, '1.5');
    await act(async () => {
      await Promise.resolve();
    });
    expect(price.value).toBe('12300');
    expect(replace).not.toHaveBeenCalled();
    expect(mounted.store.getSnapshot().economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 100 },
    ]);

    setInputValue(exchangeRate, '200');
    await act(async () => {
      await Promise.resolve();
    });
    expect(price.value).toBe('24600');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(mounted.store.getSnapshot().economy.prices).toEqual([
      { itemId: 'tech-scrap', currencyId: 'ai', amount: 123 },
    ]);
    expect(mounted.store.getSnapshot().economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 200 },
    ]);
  });

  it('恢復預設會移除 sparse price override，且沿用目前顯示貨幣', async () => {
    const mounted = await mountManager(createSnapshot(
      [{ itemId: 'tech-scrap', currencyId: 'btc', amount: 2 }],
      [{ id: 'btc-per-ai', value: 100 }],
    ));

    await click(getCurrencyButton(mounted.container, 'btc'));
    expect(getPriceInput(mounted.container, 'tech-scrap').value).toBe('2');

    const restoreButton = [...mounted.container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes(getMessages('zh-tw').settingsPage.restorePrices));
    if (!(restoreButton instanceof HTMLButtonElement)) {
      throw new Error('找不到恢復物價預設值按鈕');
    }
    await click(restoreButton);

    expect(mounted.store.getSnapshot().economy.prices).toEqual([]);
    expect(getPriceInput(mounted.container, 'tech-scrap').value).toBe('11000');
    expect(getPriceInput(mounted.container, 'locked-container').value).toBe('3000');
    expect(getUnitText(mounted.container, 'tech-scrap')).toBe('BTC/k');
    expect(getUnitText(mounted.container, 'locked-container')).toBe('BTC/item');
  });

  it('提供有名稱且會反映目前狀態的可存取切換群組', async () => {
    const mounted = await mountManager();
    const labels = getMessages('zh-tw').settingsPage;
    const group = mounted.container.querySelector('[role="group"]');

    expect(group?.getAttribute('aria-label')).toBe(labels.marketPriceDisplayCurrency);
    expect(getCurrencyButton(mounted.container, 'ai').getAttribute('aria-pressed')).toBe('true');
    expect(getCurrencyButton(mounted.container, 'btc').getAttribute('aria-pressed')).toBe('false');

    await click(getCurrencyButton(mounted.container, 'btc'));

    expect(getCurrencyButton(mounted.container, 'ai').getAttribute('aria-pressed')).toBe('false');
    expect(getCurrencyButton(mounted.container, 'btc').getAttribute('aria-pressed')).toBe('true');
  });
});
