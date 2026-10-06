// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { getProgressionMethods } from '@/data/game/progression';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  calculateMiningTool,
  applyMiningPlayerValues,
  createMiningValues,
  MiningCalculator,
  MiningToolProvider,
  normalizeMiningToolState,
  selectMiningSharedValues,
} from './mining-calculator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MiningCardId = 'btc' | 'ai';

interface MountedMining {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mountedMinings: MountedMining[] = [];

afterEach(async () => {
  for (const mounted of mountedMinings.splice(0)) {
    await act(async () => {
      mounted.root.unmount();
      await Promise.resolve();
    });
    mounted.store.dispose();
    mounted.container.remove();
  }
  document.body.innerHTML = '';
});

function renderMining(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <MiningToolProvider>{children}</MiningToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

async function mountMiningCalculator() {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  mountedMinings.push({ container, root, store });

  const labels = getMessages('en').tools.mining;
  await act(async () => {
    root.render(
      <SharedUserInputsProvider store={store}>
        <MiningToolProvider>
          <MiningCalculator labels={labels} locale="en" />
        </MiningToolProvider>
      </SharedUserInputsProvider>,
    );
    await Promise.resolve();
  });

  return { container, store };
}

function getToggle(container: HTMLElement, card: MiningCardId): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-testid="mining-net-profit-toggle-${card}"]`,
  );
  if (!button) throw new Error(`找不到 ${card} 淨收益單位切換按鈕`);
  return button;
}

function getNetProfitElement(
  container: HTMLElement,
  card: MiningCardId,
  part: 'value' | 'amount' | 'unit',
): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `[data-testid="mining-net-profit-${part}-${card}"]`,
  );
  if (!element) throw new Error(`找不到 ${card} 淨收益 ${part}`);
  return element;
}

function readNetProfitAmount(container: HTMLElement, card: MiningCardId): number {
  const amount = Number(getNetProfitElement(container, card, 'amount').textContent?.replace(/,/g, ''));
  if (!Number.isFinite(amount)) throw new Error(`無法讀取 ${card} 淨收益金額`);
  return amount;
}

function getPerMinuteElement(container: HTMLElement, card: MiningCardId): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-testid="mining-per-minute-value-${card}"]`);
  if (!element) throw new Error(`找不到 ${card} 每分鐘收益`);
  return element;
}

function readPerMinuteAmount(container: HTMLElement, card: MiningCardId): number {
  const text = getPerMinuteElement(container, card).textContent?.replace(/,/g, '');
  const amount = Number(text?.match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount)) throw new Error(`無法讀取 ${card} 每分鐘收益金額`);
  return amount;
}

function getBreakdownSection(container: HTMLElement, card: MiningCardId): HTMLElement {
  const section = container
    .querySelector<HTMLElement>(`#mining-${card}-breakdown-title`)
    ?.closest<HTMLElement>('section');
  if (!section) throw new Error(`找不到 ${card} 結果明細`);
  return section;
}

function setInputValue(container: HTMLElement, id: string, value: string): void {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`找不到挖礦輸入欄位：${id}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function updateInputs(
  container: HTMLElement,
  values: readonly (readonly [id: string, value: string])[],
): Promise<void> {
  await act(async () => {
    for (const [id, value] of values) setInputValue(container, id, value);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickElement(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

describe('Mining calculator presentation', () => {
  it('使用共用 Tool UI 呈現主要輸入與兩組收益結果', () => {
    const labels = getMessages('zh-tw').tools.mining;
    const markup = renderMining(
      <MiningCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="mining"');
    expect(markup).toContain('id="mining-level"');
    expect(markup).toContain('id="mining-hash-price"');
    expect(markup).toContain('id="mining-btc-per-ai"');
    expect(markup).toContain('id="mining-trade-exploit"');
    expect(markup).toContain('id="mining-cortex-bonus"');
    expect(markup).toMatch(/for="mining-hash-price">[\s\S]*?Hash 價格[\s\S]*?共用/);
    expect(markup).toContain('id="mining-hash-price-range"');
    expect(markup).toMatch(/id="mining-hash-price-unit"[^>]*>AI／hash<\/span>/);
    expect(markup).toMatch(/for="mining-btc-per-ai">[\s\S]*?AI → BTC[\s\S]*?共用/);
    expect(markup).not.toContain('AI → BTC 匯率');
    expect(markup).toContain('id="mining-btc-per-ai-range"');
    expect(markup).toContain('>大於 0</span>');
    expect(markup).toMatch(/id="mining-btc-per-ai-unit"[^>]*>BTC\/AI<\/span>/);
    expect(markup).not.toContain('tech-scrap-price');
    expect(markup).toContain('data-tool-fill-player=""');
    expect(markup).toContain('data-tool-reset=""');
    expect(markup).toContain('帶入玩家等級');
    expect(markup).toContain('BTC 挖礦收益');
    expect(markup).toContain('AI 製作收益');
    expect(markup).toContain('結果拆解');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('data-breakdown-layout="rows"');
    expect(markup).toContain('每次 BTC 產出');
    expect(markup).toContain('每次 AI 產出');
    expect(markup).toContain('投資報酬率');
    expect(markup).not.toContain('依 Lv.');
    expect(markup).not.toContain('每次挖礦經驗');
    expect(markup).not.toContain('總成本');
    expect(markup).not.toContain('本機瀏覽器');
    expect(markup).not.toContain('CCO Found');
    expect(markup).not.toContain('資料版本');
  });

  it('HASH 價格與匯率共用標記清楚，兩種本工具 BUFF 都在主要卡片', () => {
    const labels = getMessages('zh-tw').tools.mining;
    const markup = renderMining(
      <MiningCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('id="mining-hash-price"');
    expect(markup).toContain('id="mining-btc-per-ai"');
    expect(markup).toContain('id="mining-trade-exploit"');
    expect(markup).toContain('id="mining-cortex-bonus"');
    expect(markup).toContain('>共用</span>');
    expect(markup).not.toContain('mining-settings');
    expect(markup).not.toContain('本機瀏覽器');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
  });

  it('將交易漏洞利用與額葉皮質增強相鄰排列於主要輸入的 BUFF 區', () => {
    const labels = getMessages('zh-tw').tools.mining;
    const markup = renderMining(
      <MiningCalculator labels={labels} locale="zh-tw" />,
    );
    const buffHeadingPosition = markup.indexOf(`>${labels.buffs}</h3>`);
    const tradeExploitPosition = markup.indexOf('id="mining-trade-exploit"');
    const cortexBonusPosition = markup.indexOf('id="mining-cortex-bonus"');

    expect(buffHeadingPosition).toBeGreaterThanOrEqual(0);
    expect(tradeExploitPosition).toBeGreaterThan(buffHeadingPosition);
    expect(cortexBonusPosition).toBeGreaterThan(tradeExploitPosition);
    expect(markup).toContain('grid gap-5 @min-[24rem]:grid-cols-2');
  });

  it('將本工具狀態與價格草稿組合成計算輸入', () => {
    expect(
      createMiningValues(
        {
          miningLevel: '400',
          cortexBonusPercent: '80',
          tradeExploitPercent: '100',
        },
        {
          miningLevel: '1',
          aiPerHash: '2',
          btcPerAi: '8150',
          aiPerThousandTechScrap: '120',
        },
      ),
    ).toEqual({
      miningLevel: '400',
      aiPerHash: '2',
      btcPerAi: '8150',
      aiPerThousandTechScrap: '120',
      cortexBonusPercent: '80',
      tradeExploitPercent: '100',
    });
  });

  it('缺少 Buff 欄位時預設 100，帶入玩家等級不覆蓋本工具 Buff', () => {
    const missingBuff = { miningLevel: '1' };
    expect(normalizeMiningToolState(missingBuff)).toMatchObject({
      miningLevel: '1',
      cortexBonusPercent: '100',
      tradeExploitPercent: '100',
    });
    expect(normalizeMiningToolState({
      ...missingBuff,
      cortexBonusPercent: '100',
      tradeExploitPercent: '100',
    })).toMatchObject({ cortexBonusPercent: '100', tradeExploitPercent: '100' });

    const applied = applyMiningPlayerValues(
      { ...missingBuff, cortexBonusPercent: '40', tradeExploitPercent: '80' },
      selectMiningSharedValues(defaultSharedUserInputs),
    );
    expect(applied).toMatchObject({ cortexBonusPercent: '40', tradeExploitPercent: '80' });
  });

  it('從穩定 skill／effect ID 與 resolved market model 投影共用值', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 99 },
        skills: [{ id: 'mining-skill' as const, level: 77 }],
      },
      economy: {
        ...defaultSharedUserInputs.economy,
        prices: [
          { itemId: 'hash' as const, currencyId: 'btc' as const, amount: 2 },
          { itemId: 'tech-scrap' as const, currencyId: 'ai' as const, amount: 222 },
        ],
        exchangeRates: [{ id: 'btc-per-ai' as const, value: 9000 }],
      },
      effects: {
        buffs: [
          { id: 'exp-buff-percent' as const, percentage: 80 as const },
          { id: 'btc-buff-percent' as const, percentage: 100 as const },
        ],
      },
    };

    expect(selectMiningSharedValues(snapshot)).toMatchObject({
      miningLevel: '77',
      aiPerHash: String(2 / 9000),
      btcPerAi: '9000',
      aiPerThousandTechScrap: '222',
    });
  });

  it('共用物價與匯率更新即時計算，但不覆蓋本地試算等級', async () => {
    const { container, store } = await mountMiningCalculator();
    await updateInputs(container, [['mining-level', '400']]);
    const before = readNetProfitAmount(container, 'btc');

    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          prices: [{ itemId: 'hash', currencyId: 'ai', amount: 4 }],
          exchangeRates: [{ id: 'btc-per-ai', value: 9000 }],
        },
      }));
      await Promise.resolve();
    });

    expect(container.querySelector<HTMLInputElement>('#mining-level')?.value).toBe('400');
    expect(readNetProfitAmount(container, 'btc')).not.toBeCloseTo(before, 2);
  });

  it('帶入玩家與重設只同步試算等級；重設將 BUFF 回滿但不改共享物價匯率', async () => {
    const { container, store } = await mountMiningCalculator();
    await updateInputs(container, [
      ['mining-level', '400'],
      ['mining-cortex-bonus', '1'],
      ['mining-trade-exploit', '2'],
    ]);

    await act(async () => {
      store.update((current) => ({
        ...current,
        progression: {
          ...current.progression,
          player: { ...current.progression.player, level: 77 },
          skills: [{ id: 'mining-skill', level: 77 }],
        },
      }));
      await Promise.resolve();
    });
    expect(selectMiningSharedValues(store.getSnapshot()).miningLevel).toBe('77');
    expect(container.querySelector<HTMLInputElement>('#mining-level')?.value).toBe('400');

    await clickElement(container.querySelector<HTMLButtonElement>('[data-tool-fill-player=""]')!);
    expect(container.querySelector<HTMLInputElement>('#mining-level')?.value).toBe('77');
    expect(container.querySelector<HTMLInputElement>(
      '#mining-cortex-bonus',
    )?.getAttribute('aria-valuenow')).toBe('40');
    expect(container.querySelector<HTMLInputElement>(
      '#mining-trade-exploit',
    )?.getAttribute('aria-valuenow')).toBe('80');

    const sharedEconomy = store.getSnapshot().economy;
    await updateInputs(container, [['mining-level', '500']]);
    expect(selectMiningSharedValues(store.getSnapshot()).miningLevel).toBe('77');
    await clickElement(container.querySelector<HTMLButtonElement>('[data-tool-reset=""]')!);
    expect(selectMiningSharedValues(store.getSnapshot()).miningLevel).toBe('77');
    expect(container.querySelector<HTMLInputElement>('#mining-level')?.value).toBe('77');
    expect(container.querySelector<HTMLInputElement>(
      '#mining-cortex-bonus',
    )?.getAttribute('aria-valuenow')).toBe('100');
    expect(container.querySelector<HTMLInputElement>(
      '#mining-trade-exploit',
    )?.getAttribute('aria-valuenow')).toBe('100');
    expect(store.getSnapshot().economy).toEqual(sharedEconomy);
  });

  it('無效輸入不產生部分計算，且維持挖礦欄位的整數／範圍規則', () => {
    const calculation = calculateMiningTool({
      miningLevel: '400.5',
      aiPerHash: '1.85',
      btcPerAi: '8150',
      aiPerThousandTechScrap: '110',
      cortexBonusPercent: '80',
      tradeExploitPercent: '0',
    });

    expect(calculation.inputs).toBeNull();
    expect(calculation.result).toBeNull();
    expect(calculation.errors.miningLevel).toBe('level');

    expect(
      calculateMiningTool({
        miningLevel: '400',
        aiPerHash: '1.85',
        btcPerAi: '0',
        aiPerThousandTechScrap: '110',
        cortexBonusPercent: '80',
        tradeExploitPercent: '0',
      }).errors.btcPerAi,
    ).toBe('rate');
  });
});

describe('Mining calculator net profit unit toggles', () => {
  it('預設 BTC 卡顯示 BTC、AI 卡顯示 AI，且按鈕有明確可及名稱與鍵盤焦點', async () => {
    const { container } = await mountMiningCalculator();
    const labels = getMessages('en').tools.mining;
    const btcToggle = getToggle(container, 'btc');
    const aiToggle = getToggle(container, 'ai');

    expect(btcToggle.type).toBe('button');
    expect(aiToggle.type).toBe('button');
    expect(btcToggle.textContent).toBe('');
    expect(aiToggle.textContent).toBe('');
    expect(btcToggle.childElementCount).toBe(1);
    expect(aiToggle.childElementCount).toBe(1);
    expect(btcToggle.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(aiToggle.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(getNetProfitElement(container, 'btc', 'unit').textContent).toBe('BTC / action');
    expect(getNetProfitElement(container, 'ai', 'unit').textContent).toBe('AI / action');
    expect(getPerMinuteElement(container, 'btc').textContent).toContain(labels.btcPerMinuteUnit);
    expect(getPerMinuteElement(container, 'ai').textContent).toContain(labels.aiPerMinuteUnit);
    expect(btcToggle.getAttribute('aria-label')).toBe(
      'BTC mining earnings currently shows BTC; switch to AI',
    );
    expect(aiToggle.getAttribute('aria-label')).toBe(
      'AI crafting earnings currently shows AI; switch to BTC',
    );
    expect(btcToggle.className).toContain('min-h-11');
    expect(btcToggle.className).toContain('min-w-11');
    expect(btcToggle.className).toContain('focus-visible:ring-2');
    expect(btcToggle.title).toBe(btcToggle.getAttribute('aria-label'));
    expect(container.textContent).not.toContain(labels.btcDescription);
    expect(container.textContent).not.toContain(labels.aiDescription);

    btcToggle.focus();
    expect(document.activeElement).toBe(btcToggle);
  });

  it('在 ROI 前呈現依 progression 時間換算的每分鐘淨收益', async () => {
    const { container } = await mountMiningCalculator();
    const labels = getMessages('en').tools.mining;
    const miningMethod = getProgressionMethods('mining-skill')
      .find((method) => method.id === 'mining');
    const aiCraftingMethod = getProgressionMethods('mining-skill')
      .find((method) => method.id === 'ai-crafting');

    if (!miningMethod?.unitMinutes || !aiCraftingMethod?.unitMinutes) {
      throw new Error('挖礦與 AI 製作 progression 必須提供 unitMinutes');
    }

    for (const card of ['btc', 'ai'] as const) {
      const breakdown = getBreakdownSection(container, card);
      const rowLabels = Array.from(breakdown.querySelectorAll('dt'), (row) => row.textContent);
      expect(rowLabels.indexOf(labels.perMinute)).toBeGreaterThanOrEqual(0);
      expect(rowLabels.indexOf(labels.perMinute)).toBeLessThan(rowLabels.indexOf(labels.roi));
    }

    expect(readPerMinuteAmount(container, 'btc')).toBeCloseTo(
      readNetProfitAmount(container, 'btc') / miningMethod.unitMinutes,
      1,
    );
    expect(readPerMinuteAmount(container, 'ai')).toBeCloseTo(
      readNetProfitAmount(container, 'ai') / 100 / aiCraftingMethod.unitMinutes,
      1,
    );
  });

  it('兩張卡各自獨立切換，且都能來回切換', async () => {
    const { container } = await mountMiningCalculator();
    const btcToggle = getToggle(container, 'btc');
    const aiToggle = getToggle(container, 'ai');

    await clickElement(btcToggle);
    expect(btcToggle.textContent).toBe('');
    expect(getNetProfitElement(container, 'btc', 'unit').textContent).toBe('AI / action');
    expect(getPerMinuteElement(container, 'btc').textContent).toContain('AI / minute');
    expect(aiToggle.textContent).toBe('');

    await clickElement(aiToggle);
    expect(aiToggle.textContent).toBe('');
    expect(getNetProfitElement(container, 'ai', 'unit').textContent).toBe('BTC / action');
    expect(getPerMinuteElement(container, 'ai').textContent).toContain('BTC / minute');
    expect(btcToggle.textContent).toBe('');

    await clickElement(btcToggle);
    expect(btcToggle.textContent).toBe('');
    expect(aiToggle.textContent).toBe('');

    await clickElement(aiToggle);
    expect(aiToggle.textContent).toBe('');
    expect(getNetProfitElement(container, 'btc', 'unit').textContent).toBe('BTC / action');
    expect(getNetProfitElement(container, 'ai', 'unit').textContent).toBe('AI / action');
  });

  it('依目前有效匯率重新計算兩種淨收益換算', async () => {
    const { container, store } = await mountMiningCalculator();
    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          exchangeRates: [{ id: 'btc-per-ai', value: 100 }],
        },
      }));
      await Promise.resolve();
    });

    const btcAtHundred = readNetProfitAmount(container, 'btc');
    const aiAtHundred = readNetProfitAmount(container, 'ai');
    const btcPerMinuteAtHundred = readPerMinuteAmount(container, 'btc');
    const aiPerMinuteAtHundred = readPerMinuteAmount(container, 'ai');
    await clickElement(getToggle(container, 'btc'));
    expect(readNetProfitAmount(container, 'btc')).toBeCloseTo(btcAtHundred / 100, 1);
    expect(readPerMinuteAmount(container, 'btc')).toBeCloseTo(btcPerMinuteAtHundred / 100, 1);
    await clickElement(getToggle(container, 'ai'));
    expect(readNetProfitAmount(container, 'ai')).toBeCloseTo(aiAtHundred * 100, 1);
    expect(readPerMinuteAmount(container, 'ai')).toBeCloseTo(aiPerMinuteAtHundred * 100, 1);

    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          exchangeRates: [{ id: 'btc-per-ai', value: 200 }],
        },
      }));
      await Promise.resolve();
    });
    await clickElement(getToggle(container, 'btc'));
    const btcAtTwoHundred = readNetProfitAmount(container, 'btc');
    const btcPerMinuteAtTwoHundred = readPerMinuteAmount(container, 'btc');
    await clickElement(getToggle(container, 'ai'));
    const aiAtTwoHundred = readNetProfitAmount(container, 'ai');
    const aiPerMinuteAtTwoHundred = readPerMinuteAmount(container, 'ai');

    await clickElement(getToggle(container, 'btc'));
    expect(readNetProfitAmount(container, 'btc')).toBeCloseTo(btcAtTwoHundred / 200, 1);
    expect(readPerMinuteAmount(container, 'btc')).toBeCloseTo(btcPerMinuteAtTwoHundred / 200, 1);
    await clickElement(getToggle(container, 'ai'));
    expect(readNetProfitAmount(container, 'ai')).toBeCloseTo(aiAtTwoHundred * 200, 1);
    expect(readPerMinuteAmount(container, 'ai')).toBeCloseTo(aiPerMinuteAtTwoHundred * 200, 1);
  });

  it('維持負收益紅色，並依收益正負更新文字顏色', async () => {
    const { container, store } = await mountMiningCalculator();
    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          prices: [{ itemId: 'hash', currencyId: 'ai', amount: 1.9 }],
          exchangeRates: [{ id: 'btc-per-ai', value: 10000 }],
        },
      }));
      await Promise.resolve();
    });
    await updateInputs(container, [
      ['mining-level', '800'],
      ['mining-trade-exploit', '0'],
    ]);

    expect(readNetProfitAmount(container, 'btc')).toBeLessThan(0);
    expect(readPerMinuteAmount(container, 'btc')).toBeLessThan(0);
    expect(getNetProfitElement(container, 'btc', 'value').className).toContain('text-destructive');
    expect(readNetProfitAmount(container, 'ai')).toBeGreaterThan(0);
    expect(readPerMinuteAmount(container, 'ai')).toBeGreaterThan(0);
    expect(getNetProfitElement(container, 'ai', 'value').className).toContain('text-foreground');

    await updateInputs(container, [['mining-trade-exploit', '100']]);
    expect(readNetProfitAmount(container, 'btc')).toBeGreaterThan(0);
    expect(readPerMinuteAmount(container, 'btc')).toBeGreaterThan(0);
    expect(getNetProfitElement(container, 'btc', 'value').className).toContain('text-foreground');
  });

  it('共用價格與匯率欄位即時寫回；非法草稿不污染 sharedStore', async () => {
    const { container, store } = await mountMiningCalculator();
    await updateInputs(container, [['mining-level', '400']]);
    const aiBeforePriceEdit = readNetProfitAmount(container, 'ai');
    await updateInputs(container, [['mining-hash-price', '3']]);
    expect(readNetProfitAmount(container, 'ai')).not.toBe(aiBeforePriceEdit);

    const btcBeforeRateEdit = readNetProfitAmount(container, 'btc');
    await updateInputs(container, [['mining-btc-per-ai', '9000']]);
    expect(readNetProfitAmount(container, 'btc')).not.toBe(btcBeforeRateEdit);

    expect(store.getSnapshot().economy.prices).toContainEqual({
      itemId: 'hash',
      currencyId: 'ai',
      amount: 3,
    });
    expect(store.getSnapshot().economy.exchangeRates).toContainEqual({
      id: 'btc-per-ai',
      value: 9000,
    });

    const beforeInvalid = store.getSnapshot();
    await updateInputs(container, [['mining-btc-per-ai', '0']]);
    expect(store.getSnapshot()).toEqual(beforeInvalid);
    expect(container.querySelector<HTMLInputElement>('#mining-btc-per-ai')?.getAttribute('aria-invalid'))
      .toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toBe(getMessages('en').settingsPage.sharedValueError);
  });
});
