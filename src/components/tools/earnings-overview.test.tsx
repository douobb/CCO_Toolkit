import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createNumberFormatter } from '@/lib/number-formatting';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  calculateEarningsOverviewTool,
  applyEarningsOverviewSharedValues,
  EarningsOverviewCalculator,
  EarningsOverviewResultTable,
  EarningsOverviewToolProvider,
    normalizeEarningsOverviewToolState,
  parseEarningsOverviewValues,
  selectEarningsOverviewSharedValues,
} from './earnings-overview';

function renderEarningsOverview(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <EarningsOverviewToolProvider>{children}</EarningsOverviewToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

describe('Earnings overview calculator', () => {
  it('呈現共用輸入、活動收益比較表與 16 筆活動', () => {
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const markup = renderEarningsOverview(
      <EarningsOverviewCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="earnings-overview"');
    expect(markup).toContain('id="earnings-overview-search-level"');
    expect(markup).toContain('id="earnings-overview-printing-level"');
    expect(markup).toContain('id="earnings-overview-mining-level"');
    expect(markup).toContain('id="earnings-overview-bargain-percent"');
    expect(markup).toContain('id="earnings-overview-btc-buff-percent"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('id="earnings-overview-comparison-mode"');
    expect(markup).toContain('比較方式');
    expect(markup).toContain('15 分鐘飛逝');
    expect(markup).toContain('data-result-layout="table"');
    expect(markup).toContain('data-comparison-mode="per-minute"');
    expect(markup).toContain('data-earnings-chart="true"');
    expect(markup).toContain('min-w-[40rem]');
    expect(markup.match(/<tr/g)).toHaveLength(17);
    expect(markup).toContain('活動收益');
    expect(markup).toContain('從共用設定填入');
    expect(markup).not.toContain('重設本工具');
  });

  it('由穩定設定 ID 投影共用等級，但不讀取 Shared Buff', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 500 },
        skills: [
          { id: 'printing-rank' as const, level: 450 },
          { id: 'mining-skill' as const, level: 420 },
        ],
      },
      effects: {
        buffs: [{ id: 'btc-buff-percent' as const, percentage: 80 as const }],
      },
      equipment: { bargainPercent: 40 },
    };

    expect(selectEarningsOverviewSharedValues(snapshot)).toEqual({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
    });
  });

  it('缺少 Buff 欄位時預設 100，既有值保留且填入共用設定不覆蓋 Buff', () => {
    const missingBuff = {
      searchLevel: '1',
      printingLevel: '1',
      miningLevel: '1',
      bargainPercent: '0',
    };
    expect(normalizeEarningsOverviewToolState(missingBuff)).toMatchObject({
      ...missingBuff,
      btcBuffPercent: '100',
      comparisonMode: 'per-minute',
    });
    expect(normalizeEarningsOverviewToolState({ ...missingBuff, btcBuffPercent: '100' }))
      .toMatchObject({ btcBuffPercent: '100' });

    const current = {
      ...missingBuff,
      btcBuffPercent: '40',
      comparisonMode: 'per-minute' as const,
    };
    expect(applyEarningsOverviewSharedValues(
      current,
      selectEarningsOverviewSharedValues(defaultSharedUserInputs),
    ).btcBuffPercent).toBe('40');
  });

  it('拒絕非整數或超出範圍的值，合法輸入可產生活動結果', () => {
    const values = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
    } as const;

    expect(parseEarningsOverviewValues({ ...values, searchLevel: '500.5' }).inputs).toBeNull();
    expect(parseEarningsOverviewValues({ ...values, bargainPercent: '41' }).inputs).toBeNull();
    expect(calculateEarningsOverviewTool(values).result?.activities).toHaveLength(16);
  });

  it('相容舊版五欄狀態並補上每分鐘比較方式', () => {
    const legacyValues = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
    };
    const originalValues = { ...legacyValues };

    expect(normalizeEarningsOverviewToolState(legacyValues)).toEqual({
      ...legacyValues,
      comparisonMode: 'per-minute',
    });
    expect(legacyValues).toEqual(originalValues);
  });

  it('依比較方式切換飛逝模式的動態欄位', () => {
    const values = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'elapsed-15' as const,
    };
    const calculation = calculateEarningsOverviewTool(values);
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const markup = renderToStaticMarkup(
      <EarningsOverviewResultTable
        labels={labels}
        locale="zh-tw"
        result={calculation.result!}
        formatNumber={createNumberFormatter('zh-tw')}
      />,
    );

    expect(markup).toContain('data-comparison-mode="elapsed-15"');
    expect(markup).toContain('可執行數量');
    expect(markup).toContain('實際使用時間');
    expect(markup).toContain('飛逝總淨收益');
    expect(markup).toContain('時間利用率');
    expect(markup).not.toContain('每批淨收益');
  });

  it('三語系都提供比較方式與飛逝選項文案', () => {
    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const labels = getMessages(locale).tools.earningsOverview;
      const markup = renderEarningsOverview(
        <EarningsOverviewCalculator labels={labels} locale={locale} />,
      );

      expect(markup).toContain(labels.comparisonMode);
      expect(markup).toContain(labels.elapsed105Option);
      expect(markup).toContain(labels.trendTitle);
      expect(markup).toContain(labels.trendGroup);
      expect(markup).toContain(labels.trendInteractionHint);
      expect(markup).not.toContain('checkbox');
      expect(markup).not.toContain('勾選');
      expect(markup).not.toContain('勾选');
      expect(labels.timeUtilization).not.toBe('');
    }
  });
});
